// Admin page for Adzim's portfolio. Content lives in the Supabase table "content" as four JSON
// rows (site, portfolio, resume, preview); images go to the public Storage bucket "portfolio".
// The public site reads the same rows (see loadContent in ../app.js).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const cfg = window.SUPABASE || {};
const BUCKET = 'portfolio';
const DOCS = ['site', 'portfolio', 'resume', 'preview'];
const DOC_NAMES = { site: 'Teks', portfolio: 'Projek', resume: 'Education & Experience', preview: 'Preview gallery' };

// Same presets as CATEGORY_THEMES / FILTER_ICONS in ../app.js, used when importing and for new categories.
const THEMES = {
  'logo-folio': { accent: '#b8a0ff', label: 'Identity system', icon: 'logo-folio' },
  'brand-design': { accent: '#ddad82', label: 'Brand & food', icon: 'brand-design' },
  'social-media': { accent: '#f4a1ba', label: 'Campaign', icon: 'social-media' },
  'digital-art': { accent: '#a2d9ba', label: 'Character', icon: 'digital-art' },
  'print-media': { accent: '#d7c785', label: 'Production', icon: 'print-media' },
  'ui-ux': { accent: '#8dbaff', label: 'Interface', icon: 'ui-ux' },
  others: { accent: '#c9c4d6', label: 'Experimental', icon: 'others' },
};
const ICON_NAMES = {
  'logo-folio': 'Bintang', 'brand-design': 'Tag', 'social-media': 'Telefon',
  'digital-art': 'Pen', 'print-media': 'Pencetak', 'ui-ux': 'Skrin', others: 'Kilauan',
};
const SWATCHES = ['#b8a0ff', '#8dbaff', '#a2d9ba', '#d7c785', '#ddad82', '#f4a1ba', '#ff8a80', '#c9c4d6'];

/* ---------- Icons (static, trusted markup) ---------- */
const P = {
  text: '<path d="M4 6h16M4 12h10M4 18h7"/>',
  projects: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  resume: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  preview: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m2 15 5-4 4 3 4-5 7 6"/>',
  backup: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  theme: '<path d="M20.8 13.4A9 9 0 0 1 10.6 3.2 9 9 0 1 0 20.8 13.4Z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M5 20h14"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  moon: '<path d="M20.8 13.4A9 9 0 0 1 10.6 3.2 9 9 0 1 0 20.8 13.4Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
function ico(name) { const i = document.createElement('i'); i.className = 'ico'; i.innerHTML = svg(name); return i; }
const paintIcons = (scope = document) => $$('[data-icon]', scope).forEach(el => { el.className = 'ico'; el.innerHTML = svg(el.dataset.icon); });

/* ---------- Small DOM helpers (no innerHTML with user text) ---------- */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === undefined || v === null || v === false) return;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v; // textarea needs the property, not the attribute
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  children.flat().forEach(c => { if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c)); });
  return el;
}
const clone = v => JSON.parse(JSON.stringify(v));
const asset = src => (!src ? '' : /^(https?:|data:|blob:)/.test(src) ? src : `../${src}`);
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.replaceChildren(ico(bad ? 'info' : 'check'), h('span', {}, msg));
  t.classList.toggle('bad', bad);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), bad ? 5200 : 3200);
}

// In-page replacement for prompt() / confirm(). Resolves to the typed text, true, or null.
function ask({ title, text = '', label = '', value = '', ok = 'OK', danger = false }) {
  const dlg = $('#ask');
  $('#ask-title').textContent = title;
  $('#ask-text').textContent = text;
  $('#ask-text').hidden = !text;
  $('#ask-field').hidden = !label;
  $('#ask-label').textContent = label;
  const input = $('#ask-input');
  input.value = value;
  input.required = !!label;
  $('#ask-ok').textContent = ok;
  $('#ask-ok').classList.toggle('danger', danger);
  dlg.returnValue = ''; // Escape must not reuse the last answer
  dlg.showModal();
  if (label) { input.focus(); input.select(); }
  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      resolve(label ? input.value.trim() || null : true);
    }, { once: true });
  });
}

/* ---------- Theme (shared with the portfolio) ---------- */
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('adzim-theme', theme); } catch (_) {}
  const btn = $('#theme-toggle');
  btn.replaceChildren(ico(theme === 'light' ? 'moon' : 'sun'), h('span', {}, theme === 'light' ? 'Tema gelap' : 'Tema terang'));
}
$('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
paintIcons();

$('[data-show-pw]').addEventListener('click', e => {
  const input = e.target.closest('.pw').querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  e.target.textContent = show ? 'Sorok' : 'Tunjuk';
});

/* ---------- State ---------- */
const state = { docs: {}, remote: new Set(), dirty: new Set(), tab: 'text', cat: 0 };

function bundled() {
  const portfolio = clone(window.PORTFOLIO_DATA || []).map(p => ({ ...(THEMES[p.id] || {}), ...p }));
  const byId = id => portfolio.find(p => p.id === id) || {};
  const social = byId('social-media');
  return {
    site: clone(window.SITE || {}),
    portfolio,
    resume: clone(window.RESUME || {}),
    preview: { logo: clone(byId('logo-folio').preview || []), square: clone(social.previewSquare || []), portrait: clone(social.previewPortrait || []) },
  };
}

function updateSavebar() {
  const bar = $('#savebar');
  bar.hidden = !state.dirty.size;
  $('#save-status').textContent = 'Perubahan belum disimpan';
  $('#save-what').textContent = [...state.dirty].map(k => DOC_NAMES[k]).join(' · ');
  $$('#side-nav [data-doc]').forEach(b => b.classList.toggle('has-changes', state.dirty.has(b.dataset.doc)));
}
function markDirty(doc) { state.dirty.add(doc); updateSavebar(); }

window.addEventListener('beforeunload', e => {
  if (state.dirty.size) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- Supabase ---------- */
// Demo mode: on this computer only (localhost + ?demo), without Supabase, nothing is saved.
const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('demo');
if ((!cfg.url || !cfg.anonKey) && !DEMO) {
  $('#view-setup').hidden = false;
  await new Promise(() => {}); // stop here quietly: nothing below can work without Supabase
}
const sb = DEMO ? null : createClient(cfg.url, cfg.anonKey);

function deepFill(value, defaults) {
  if (Array.isArray(defaults) || typeof defaults !== 'object' || defaults === null) return value === undefined ? defaults : value;
  const out = { ...(value || {}) };
  Object.keys(defaults).forEach(k => { out[k] = deepFill(out[k], defaults[k]); });
  return out;
}

async function loadDocs() {
  const fallback = bundled();
  if (DEMO) {
    Object.assign(state.docs, fallback);
    $('#import-notice').hidden = true;
    return;
  }
  const { data, error } = await sb.from('content').select('key,data');
  if (error) toast(`Gagal baca Supabase: ${error.message}`, true);
  const rows = Object.fromEntries((data || []).map(r => [r.key, r.data]));
  state.remote = new Set(Object.keys(rows));
  DOCS.forEach(k => { state.docs[k] = rows[k] !== undefined ? rows[k] : fallback[k]; });
  // Site text: keep new keys from site-data.js even when the saved row is older.
  state.docs.site = deepFill(state.docs.site, fallback.site);
  $('#import-notice').hidden = DOCS.every(k => state.remote.has(k));
}

function summarise(portfolio) {
  portfolio.forEach(p => {
    p.category = p.id;
    const visuals = p.sections.reduce((n, s) => n + s.images.length, 0);
    p.type = `${p.sections.length} collection${p.sections.length === 1 ? '' : 's'} · ${visuals} visual${visuals === 1 ? '' : 's'}`;
  });
}

async function saveDocs(keys) {
  if (keys.includes('portfolio')) summarise(state.docs.portfolio);
  if (DEMO) throw new Error('Mod demo: tiada apa disimpan. Log masuk di laman sebenar untuk simpan.');
  const rows = keys.map(key => ({ key, data: state.docs[key], updated_at: new Date().toISOString() }));
  const { error } = await sb.from('content').upsert(rows);
  if (error) {
    const denied = /row-level security|permission/i.test(error.message);
    throw new Error(denied ? 'Tiada kebenaran: emel ini bukan admin dalam setup.sql.' : error.message);
  }
  keys.forEach(k => { state.dirty.delete(k); state.remote.add(k); });
  $('#import-notice').hidden = DOCS.every(k => state.remote.has(k));
}

async function saveAll() {
  if (!state.dirty.size) return;
  const btn = $('#save');
  btn.disabled = true;
  $('#save-status').textContent = 'Menyimpan…';
  try {
    await saveDocs([...state.dirty]);
    updateSavebar();
    toast('Disimpan. Laman awam kini guna kandungan baru.');
  } catch (err) {
    $('#save-status').textContent = 'Gagal simpan';
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}
$('#save').addEventListener('click', saveAll);
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !$('#view-app').hidden) { e.preventDefault(); saveAll(); }
});
$('#discard').addEventListener('click', async () => {
  const ok = await ask({ title: 'Buang semua perubahan?', text: 'Kandungan akan kembali kepada versi terakhir yang disimpan.', ok: 'Buang', danger: true });
  if (!ok) return;
  state.dirty.clear();
  await loadDocs();
  updateSavebar();
  showTab(state.tab);
  toast('Perubahan dibuang.');
});

/* ---------- Images: shrink in the browser, upload to Storage ---------- */
const SIZES = { full: 2400, display: 1600, thumb: 600 };

async function toWebp(bitmap, max) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height)); // never enlarge
  const w = Math.round(bitmap.width * scale);
  const hgt = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = hgt;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, hgt);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.86));
  return { blob, w, h: hgt };
}

async function uploadImage(file, folder, alt) {
  if (DEMO) throw new Error('Mod demo: muat naik perlukan log masuk sebenar.');
  const bitmap = await createImageBitmap(file);
  const base = `${folder}/${Date.now().toString(36)}-${slug(file.name.replace(/\.[^.]+$/, ''))}`;
  const out = { alt, dark: false, storage: [] };
  for (const [name, max] of Object.entries(SIZES)) {
    const { blob, w, h: hgt } = await toWebp(bitmap, max);
    const path = `${base}-${name}.webp`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
    if (error) throw new Error(error.message);
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    out.storage.push(path);
    if (name === 'full') { out.src = url; out.width = w; out.height = hgt; }
    else out[name] = url;
  }
  bitmap.close();
  return out;
}

async function removeStored(images) {
  const paths = images.flatMap(a => a.storage || []);
  if (paths.length && sb) await sb.storage.from(BUCKET).remove(paths);
}

/* ---------- Form controls bound to an object ---------- */
function field(obj, key, label, doc, { multi = false, hint = '', type = 'text', rows = 3, placeholder = '' } = {}) {
  const input = multi
    ? h('textarea', { rows, value: obj[key] ?? '', placeholder })
    : h('input', { type, value: obj[key] ?? '', placeholder });
  input.addEventListener('input', () => { obj[key] = input.value; markDirty(doc); });
  return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
}

const iconBtn = (name, label, onclick, extra = {}) =>
  h('button', { class: `icon-btn${extra.danger ? ' danger' : ''}`, type: 'button', title: label, 'aria-label': label, onclick, disabled: extra.disabled }, ico(name));

function moveBtns(list, i, doc, rerender) {
  const move = d => () => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    markDirty(doc);
    rerender();
  };
  return h('span', { class: 'row-tools' },
    iconBtn('up', 'Naik', move(-1), { disabled: i === 0 }),
    iconBtn('down', 'Turun', move(1), { disabled: i === list.length - 1 }));
}

function delBtn(onConfirm, what = 'item ini') {
  return iconBtn('trash', `Padam ${what}`, async () => {
    const ok = await ask({ title: `Padam ${what}?`, text: 'Tindakan ini tak boleh dibatalkan selepas disimpan.', ok: 'Padam', danger: true });
    if (ok) onConfirm();
  }, { danger: true });
}

const addBtn = (label, onclick) => h('button', { class: 'btn add', type: 'button', onclick }, ico('plus'), label);

// A list of objects edited as rows of fields.
function listEditor(list, doc, fields, blank, title) {
  const wrap = h('div', { class: 'list-editor' });
  const draw = () => {
    wrap.replaceChildren(
      ...list.map((item, i) => h('div', { class: 'list-row' },
        h('span', { class: 'row-num' }, String(i + 1)),
        typeof item === 'string'
          ? field(list, i, title, doc)
          : h('div', { class: 'list-fields' }, fields.map(f => f.render ? f.render(item, doc) : field(item, f.key, f.label, doc, f))),
        h('div', { class: 'list-side' }, moveBtns(list, i, doc, draw), delBtn(() => { list.splice(i, 1); markDirty(doc); draw(); }, title.toLowerCase())))),
      list.length ? null : h('p', { class: 'empty' }, `Belum ada ${title.toLowerCase()}.`),
      addBtn(`Tambah ${title.toLowerCase()}`, () => { list.push(clone(blank)); markDirty(doc); draw(); }));
  };
  draw();
  return wrap;
}

function card(title, where, ...body) {
  return h('section', { class: 'card', id: `card-${slug(title)}` },
    h('header', { class: 'card-head' }, h('h2', {}, title), where ? h('p', { class: 'where' }, where) : null),
    ...body);
}

// Chips that jump to each card of a long tab.
function jumpNav(cards) {
  return h('nav', { class: 'jump', 'aria-label': 'Lompat ke bahagian' },
    cards.map(c => h('a', { href: `#${c.id}`, onclick: e => { e.preventDefault(); c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, c.querySelector('h2').textContent)));
}

/* ---------- Tab: Teks ---------- */
function renderText() {
  const s = state.docs.site;
  const d = 'site';
  const levelSelect = item => {
    const sel = h('select', {}, [1, 2, 3].map(n => h('option', { value: n, selected: Number(item.level) === n }, ['', 'Basic', 'Intermediate', 'Advanced'][n])));
    sel.addEventListener('change', () => { item.level = Number(sel.value); markDirty(d); });
    return h('label', { class: 'field' }, h('span', {}, 'Tahap'), sel);
  };
  const cards = [
    card('Hero', 'Bahagian paling atas laman.',
      h('div', { class: 'grid2' }, field(s.hero, 'hi', 'Salam', d), field(s.hero, 'name', 'Nama (tebal)', d)),
      field(s.hero, 'title', 'Tajuk besar', d),
      field(s.hero, 'intro', 'Ayat pendek', d, { multi: true, rows: 2 }),
      h('div', { class: 'grid2' }, field(s.hero, 'searchPlaceholder', 'Teks dalam kotak carian', d), field(s.hero, 'searchHint', 'Petunjuk selepas "Type /"', d)),
      field(s.hero, 'seeMore', 'Butang See More', d)),
    card('Menu & brand', 'Header di atas setiap halaman.',
      h('div', { class: 'grid3' }, ...[['home', 'Home'], ['about', 'About'], ['education', 'Education'], ['experience', 'Experience'], ['projects', 'Projects'], ['resume', 'Butang Resume']].map(([k, l]) => field(s.nav, k, l, d))),
      h('div', { class: 'grid2' }, field(s.brand, 'name', 'Brand', d), field(s.brand, 'suffix', 'Brand (bahagian pudar)', d))),
    card('Preview gallery', 'Nota di bawah 3 baris gambar bergerak.',
      field(s.gallery, 'note', 'Nota', d, { multi: true, rows: 2, hint: 'Tulis **perkataan** untuk tebal. Tekan Enter untuk pecah baris (desktop sahaja).' })),
    card('About', 'Bahagian About Me.',
      h('div', { class: 'grid2' }, field(s.about, 'title', 'Tajuk bahagian', d), field(s.about, 'cardTitle', 'Tajuk kad', d)),
      field(s.about, 'body', 'Perenggan', d, { multi: true, rows: 4 }),
      field(s.about, 'availability', 'Pil hijau (status)', d),
      h('div', { class: 'sub' }, field(s.about, 'languagesTitle', 'Tajuk senarai bahasa', d),
        listEditor(s.about.languages, d, [{ key: 'name', label: 'Bahasa' }, { key: 'level', label: 'Tahap' }], { name: '', level: '' }, 'Bahasa')),
      h('div', { class: 'sub' }, field(s.about, 'softwareTitle', 'Tajuk senarai software', d),
        listEditor(s.about.software, d, [{ key: 'name', label: 'Software' }, { render: levelSelect }], { name: '', level: 2 }, 'Software')),
      h('div', { class: 'sub' }, field(s.about, 'fieldsTitle', 'Tajuk pil fields', d),
        listEditor(s.about.fields, d, [], '', 'Field'))),
    card('Tajuk bahagian', 'Tajuk Education dan Experience.',
      h('div', { class: 'grid2' },
        field(s.education, 'title', 'Education', d),
        field(s.experience, 'title', 'Experience', d),
        field(s.experience, 'workTitle', 'Experience: lajur kerja', d),
        field(s.experience, 'awardsTitle', 'Experience: lajur awards', d))),
    card('Projects', 'Bahagian senarai projek.',
      h('div', { class: 'grid2' }, field(s.projects, 'title', 'Tajuk', d), field(s.projects, 'cta', 'Butang pada kad', d)),
      field(s.projects, 'sub', 'Ayat bawah tajuk', d, { multi: true, rows: 2 }),
      h('div', { class: 'grid3' }, field(s.projects, 'emptyTitle', 'Tiada hasil: tajuk', d), field(s.projects, 'emptyText', 'Tiada hasil: ayat', d), field(s.projects, 'emptyButton', 'Tiada hasil: butang', d))),
    card('Contact & footer', 'Bahagian paling bawah laman.',
      field(s.contact, 'line', 'Ayat besar', d),
      field(s.contact, 'sub', 'Ayat kecil', d),
      h('div', { class: 'grid3' }, field(s.contact, 'email', 'Emel', d, { type: 'email' }), field(s.contact, 'linkedin', 'Pautan LinkedIn', d, { type: 'url' }), field(s.contact, 'instagram', 'Instagram (tanpa @)', d)),
      h('div', { class: 'grid2' }, field(s.footer, 'tagline', 'Footer: ayat', d), field(s.footer, 'copyright', 'Footer: hak cipta', d))),
    card('Resume', 'Tetingkap pratonton Resume.',
      h('div', { class: 'grid3' }, field(s.resume, 'dialogTitle', 'Tajuk tetingkap', d), field(s.resume, 'download', 'Butang muat turun', d), field(s.resume, 'pdfName', 'Nama fail PDF', d))),
    card('Google & tab pelayar', 'Apa yang muncul di tab pelayar dan carian Google.',
      field(s.meta, 'title', 'Tajuk tab', d),
      field(s.meta, 'description', 'Penerangan Google', d, { multi: true, rows: 2, hint: 'Sebaiknya bawah 160 aksara.' })),
  ];
  return [jumpNav(cards), ...cards];
}

/* ---------- Tab: Projek ---------- */
function renderProjects() {
  const list = state.docs.portfolio;
  const d = 'portfolio';
  state.cat = Math.min(state.cat, Math.max(0, list.length - 1));
  const rerender = () => showTab('projects');
  const visuals = p => p.sections.reduce((n, s) => n + s.images.length, 0);

  const side = h('aside', { class: 'cat-list' },
    h('p', { class: 'eyebrow' }, `${list.length} kategori`),
    ...list.map((p, i) => h('div', { class: `cat-item${i === state.cat ? ' active' : ''}` },
      h('button', { class: 'cat-name', type: 'button', onclick: () => { state.cat = i; rerender(); } },
        h('i', { class: 'swatch', style: `background:${p.accent || '#c9c4d6'}` }),
        h('span', {}, h('b', {}, p.title || '(tanpa nama)'), h('small', {}, `${p.sections.length} koleksi · ${visuals(p)} gambar`))),
      moveBtns(list, i, d, () => { state.cat = i + 0; rerender(); }))),
    addBtn('Kategori baru', async () => {
      const name = await ask({ title: 'Kategori baru', label: 'Nama kategori', ok: 'Cipta' });
      if (!name) return;
      let id = slug(name);
      while (list.some(p => p.id === id)) id += '-2';
      list.push({ id, category: id, title: name, desc: '', label: '', accent: '#b8a0ff', icon: 'others', sections: [] });
      state.cat = list.length - 1;
      markDirty(d);
      rerender();
    }));

  const p = list[state.cat];
  if (!p) return [h('div', { class: 'split' }, side, h('div', { class: 'card' }, h('p', { class: 'empty' }, 'Belum ada kategori. Tekan "Kategori baru" untuk mula.')))];

  const iconSel = h('select', {}, Object.entries(ICON_NAMES).map(([k, label]) => h('option', { value: k, selected: (p.icon || p.id) === k }, label)));
  iconSel.addEventListener('change', () => { p.icon = iconSel.value; markDirty(d); });
  const swatchRow = h('div', { class: 'swatches' });
  const drawSwatches = () => swatchRow.replaceChildren(
    ...SWATCHES.map(c => h('button', { type: 'button', class: `swatch-btn${(p.accent || '').toLowerCase() === c ? ' on' : ''}`, style: `background:${c}`, title: c, 'aria-label': `Warna ${c}`,
      onclick: () => { p.accent = c; markDirty(d); drawSwatches(); } })),
    h('label', { class: 'swatch-custom', title: 'Warna lain' }, h('input', { type: 'color', value: p.accent || '#b8a0ff', oninput: e => { p.accent = e.target.value; markDirty(d); } }), '+'));
  drawSwatches();

  const editor = h('div', { class: 'cat-editor' },
    card(p.title || 'Kategori', `Muncul sebagai kad dan butang penapis dalam Projects. Pautan: #project/${p.id}`,
      h('div', { class: 'grid2' }, field(p, 'title', 'Nama', d), field(p, 'label', 'Label kecil (atas kad)', d)),
      field(p, 'desc', 'Penerangan', d, { multi: true, rows: 2 }),
      h('div', { class: 'grid2' },
        h('div', { class: 'field' }, h('span', {}, 'Warna aksen'), swatchRow),
        h('label', { class: 'field' }, h('span', {}, 'Ikon penapis'), iconSel)),
      h('div', { class: 'card-foot' },
        h('button', { class: 'btn ghost danger', type: 'button', onclick: async () => {
          const ok = await ask({ title: `Padam kategori "${p.title}"?`, text: 'Semua koleksi dan gambar dalam kategori ini akan dibuang.', ok: 'Padam kategori', danger: true });
          if (!ok) return;
          await removeStored(p.sections.flatMap(s => s.images));
          list.splice(state.cat, 1);
          state.cat = 0;
          markDirty(d);
          rerender();
        } }, ico('trash'), 'Padam kategori'))),
    h('div', { class: 'section-title' }, h('h2', {}, 'Koleksi'), h('span', { class: 'muted' }, `${p.sections.length} koleksi`)),
    ...p.sections.map((s, si) => collectionCard(p, s, si, rerender)),
    p.sections.length ? null : h('p', { class: 'empty card' }, 'Belum ada koleksi dalam kategori ini.'),
    addBtn('Koleksi baru', async () => {
      const name = await ask({ title: 'Koleksi baru', label: 'Nama koleksi', ok: 'Cipta' });
      if (!name) return;
      p.sections.push({ title: name, images: [] });
      markDirty(d);
      rerender();
    }));
  return [h('div', { class: 'split' }, side, editor)];
}

function collectionCard(p, s, si, rerender) {
  const d = 'portfolio';
  const status = h('span', {}, 'Seret gambar ke sini, atau ', h('u', {}, 'pilih fail'));
  const drop = h('label', { class: 'drop' },
    h('input', { type: 'file', accept: 'image/*', multiple: true, onchange: e => addFiles(e.target.files) }),
    ico('upload'), status, h('small', {}, 'JPG, PNG atau WebP. Diperkecil automatik ke WebP.'));
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });

  async function addFiles(files) {
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    drop.classList.add('busy');
    let done = 0;
    for (const f of imgs) {
      status.textContent = `Memuat naik ${done + 1} daripada ${imgs.length}…`;
      try {
        s.images.push(await uploadImage(f, `${p.id}/${slug(s.title)}`, `${s.title} — visual ${s.images.length + 1}`));
        done++;
        markDirty(d);
      } catch (err) {
        toast(`Gagal muat naik ${f.name}: ${err.message}`, true);
      }
    }
    if (done) toast(`${done} gambar dimuat naik. Tekan Simpan untuk terbitkan.`);
    rerender();
  }

  const thumbs = h('div', { class: 'thumbs' }, s.images.map((a, i) => {
    const dark = h('input', { type: 'checkbox', checked: !!a.dark });
    dark.addEventListener('change', () => { a.dark = dark.checked; markDirty(d); });
    const alt = h('input', { value: a.alt || '', placeholder: 'Penerangan gambar', title: 'Teks alt (untuk pembaca skrin)' });
    alt.addEventListener('input', () => { a.alt = alt.value; markDirty(d); });
    return h('figure', { class: 'thumb' },
      h('div', { class: 'thumb-img' },
        h('img', { src: asset(a.thumb || a.display || a.src), alt: '', loading: 'lazy' }),
        h('span', { class: 'thumb-num' }, String(i + 1)),
        h('div', { class: 'thumb-tools' },
          moveBtns(s.images, i, d, rerender),
          delBtn(async () => { await removeStored([a]); s.images.splice(i, 1); markDirty(d); rerender(); }, 'gambar ini'))),
      alt,
      h('label', { class: 'check', title: 'Tanda kalau gambar gelap dan perlu latar terang' }, dark, 'Gambar gelap'));
  }));

  const heading = h('b', { class: 'coll-name' }, s.title || '(tanpa nama)');
  const nameField = field(s, 'title', 'Nama koleksi', d);
  nameField.querySelector('input').addEventListener('input', e => { heading.textContent = e.target.value || '(tanpa nama)'; });

  return h('details', { class: 'card collection', open: s.images.length < 9 },
    h('summary', {},
      h('span', { class: 'chev', 'aria-hidden': 'true' }),
      heading,
      h('span', { class: 'count' }, `${s.images.length} gambar`),
      h('span', { class: 'row-tools', onclick: e => e.preventDefault() },
        moveBtns(p.sections, si, d, rerender),
        delBtn(async () => { await removeStored(s.images); p.sections.splice(si, 1); markDirty(d); rerender(); }, `koleksi "${s.title}"`))),
    h('div', { class: 'coll-body' }, nameField, s.images.length ? thumbs : null, drop));
}

/* ---------- Tab: Education & Experience ---------- */
function renderResume() {
  const r = state.docs.resume;
  const d = 'resume';
  r.education = r.education || [];
  r.experience = r.experience || [];
  r.honors = r.honors || [];
  const pointsField = item => {
    const ta = h('textarea', { rows: 3, value: (item.points || []).join('\n'), placeholder: 'Satu poin setiap baris' });
    ta.addEventListener('input', () => { item.points = ta.value.split('\n').map(t => t.trim()).filter(Boolean); markDirty(d); });
    return h('label', { class: 'field wide' }, h('span', {}, 'Butiran (satu baris = satu poin)'), ta);
  };
  const startField = { key: 'start', label: 'Mula (YYYY-MM)', placeholder: '2024-09' };
  const logoField = item => {
    const preview = h('img', { class: 'logo-preview', src: asset(item.logo), alt: '' });
    const input = h('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      try {
        const a = await uploadImage(f, 'education', item.school);
        item.logo = a.display; item.logoW = a.width; item.logoH = a.height; delete item.logoDark;
        preview.src = a.display;
        markDirty(d);
        toast('Logo dimuat naik. Tekan Simpan.');
      } catch (err) { toast(err.message, true); }
    });
    return h('label', { class: 'field logo-field' }, h('span', {}, 'Logo'), h('span', { class: 'logo-box' }, preview, h('span', { class: 'btn ghost small' }, ico('upload'), 'Tukar')), input);
  };
  const current = r.current || (r.current = { role: '', org: '', date: '', start: '', points: [] });
  return [
    card('Education', 'Kad sekolah dengan logo. Disusun dari lama ke baru.',
      listEditor(r.education, d, [
        { key: 'school', label: 'Sekolah' }, { key: 'award', label: 'Program' }, { key: 'cgpa', label: 'CGPA' },
        { key: 'date', label: 'Tarikh' }, startField, { render: logoField }],
      { school: '', award: '', cgpa: '', date: '', start: '' }, 'Sekolah')),
    card('Kerja semasa', 'Item paling baru dalam timeline Experience. Kosongkan "Mula" untuk sembunyikan.',
      h('div', { class: 'grid2' }, field(current, 'role', 'Jawatan', d), field(current, 'org', 'Organisasi', d),
        field(current, 'date', 'Tarikh', d), field(current, 'start', startField.label, d, { placeholder: '2026-09' }))),
    card('Work, curricular & leadership', 'Timeline kiri dalam Experience. Susunan ikut tarikh "Mula".',
      listEditor(r.experience, d, [
        { key: 'role', label: 'Jawatan' }, { key: 'org', label: 'Organisasi' }, { key: 'date', label: 'Tarikh' }, startField, { render: pointsField }],
      { role: '', org: '', date: '', start: '', points: [] }, 'Pengalaman')),
    card('Awards & certificates', 'Timeline kanan dalam Experience.',
      listEditor(r.honors, d, [
        { key: 'title', label: 'Anugerah' }, { key: 'org', label: 'Penganjur' }, { key: 'date', label: 'Tarikh' }, startField, { render: pointsField }],
      { title: '', org: '', date: '', start: '', points: [] }, 'Anugerah')),
    card('Maklumat Resume', 'Bahagian atas pratonton Resume.',
      h('div', { class: 'grid2' }, field(r, 'name', 'Nama penuh', d), field(r, 'location', 'Lokasi', d),
        field(r, 'email', 'Emel', d), field(r, 'availability', 'Availability', d))),
  ];
}

/* ---------- Tab: Preview gallery ---------- */
function renderPreview() {
  const pv = state.docs.preview;
  const d = 'preview';
  const rows = [['logo', 'Baris 1 · Logo', 'Logo dalam kotak putih, bergerak ke kanan.'], ['square', 'Baris 2 · Segi empat', 'Poster segi empat, bergerak ke kiri.'], ['portrait', 'Baris 3 · Potret', 'Poster potret, bergerak ke kanan.']];
  const rerender = () => showTab('preview');
  const ref = a => ({ thumb: a.thumb || a.display || a.src, width: a.width, height: a.height, alt: a.alt });

  const picker = rowKey => {
    const dlg = h('dialog', { class: 'picker' });
    const grid = h('div', { class: 'picker-body' });
    state.docs.portfolio.forEach(p => {
      const imgs = p.sections.flatMap(s => s.images);
      if (!imgs.length) return;
      grid.append(h('p', { class: 'eyebrow' }, p.title), h('div', { class: 'picker-grid' }, imgs.map(a => h('button', { type: 'button', title: a.alt, onclick: () => {
        pv[rowKey].push(rowKey === 'logo' ? { light: ref(a) } : ref(a));
        markDirty(d);
        dlg.close();
        rerender();
        toast('Gambar ditambah ke baris.');
      } }, h('img', { src: asset(a.thumb || a.display || a.src), alt: a.alt, loading: 'lazy' })))));
    });
    dlg.append(h('div', { class: 'picker-head' }, h('h2', {}, 'Pilih gambar'), iconBtn('close', 'Tutup', () => dlg.close())), grid);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  };

  return rows.map(([key, title, where]) => {
    pv[key] = pv[key] || [];
    const list = pv[key];
    return card(title, where,
      list.length ? h('div', { class: 'thumbs small' }, list.map((item, i) => {
        const a = key === 'logo' ? item.light : item;
        return h('figure', { class: 'thumb' }, h('div', { class: 'thumb-img' }, h('img', { src: asset(a.thumb), alt: '' }),
          h('span', { class: 'thumb-num' }, String(i + 1)),
          h('div', { class: 'thumb-tools' }, moveBtns(list, i, d, rerender), delBtn(() => { list.splice(i, 1); markDirty(d); rerender(); }, 'gambar ini dari baris'))));
      })) : h('p', { class: 'empty' }, 'Baris ini kosong.'),
      addBtn('Tambah gambar', () => picker(key)));
  });
}

/* ---------- Tab: Sandaran ---------- */
function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  h('a', { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderBackup() {
  const imported = DOCS.filter(k => state.remote.has(k));
  return [
    card('Import kandungan semasa', 'Sekali sahaja, untuk mula guna Supabase.',
      h('p', {}, imported.length
        ? `Sudah ada dalam Supabase: ${imported.map(k => DOC_NAMES[k]).join(', ')}. Import akan menggantikannya dengan kandungan fail laman.`
        : 'Belum ada kandungan dalam Supabase. Import sekali untuk mula.'),
      h('div', {}, h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        if (imported.length && !await ask({ title: 'Ganti kandungan dalam Supabase?', text: 'Semua perubahan yang dibuat melalui admin akan diganti dengan kandungan fail laman.', ok: 'Ganti', danger: true })) return;
        Object.assign(state.docs, bundled());
        try { await saveDocs(DOCS); toast('Import selesai.'); showTab('backup'); }
        catch (err) { toast(err.message, true); }
      } }, 'Import kandungan semasa'))),
    card('Muat turun', 'Simpan salinan kandungan di komputer anda.',
      h('div', { class: 'backup-grid' },
        h('div', { class: 'backup-item' }, h('b', {}, 'Sandaran JSON'), h('p', { class: 'muted' }, 'Satu fail dengan semua kandungan. Simpan sebagai sandaran.'),
          h('button', { class: 'btn', type: 'button', onclick: () => download(`portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state.docs, null, 2)) }, ico('backup'), 'Muat turun JSON')),
        h('div', { class: 'backup-item' }, h('b', {}, 'Fail fallback'), h('p', { class: 'muted' }, 'Tiga fail untuk folder dist sebelum deploy. Laman guna fail ini bila Supabase tak menjawab.'),
          h('button', { class: 'btn', type: 'button', onclick: () => {
            summarise(state.docs.portfolio);
            download('site-data.js', `window.SITE = ${JSON.stringify(state.docs.site, null, 2)};\n`, 'text/javascript');
            setTimeout(() => download('portfolio-data.js', `window.PORTFOLIO_DATA = ${JSON.stringify(state.docs.portfolio)};\n`, 'text/javascript'), 300);
            setTimeout(() => download('resume-data.js', `window.RESUME = ${JSON.stringify(state.docs.resume, null, 2)};\n`, 'text/javascript'), 600);
          } }, ico('backup'), 'Muat turun fail fallback')))),
  ];
}

/* ---------- Tabs and views ---------- */
const TABS = {
  text: { title: 'Teks laman', desc: 'Ubah ayat di setiap bahagian laman: hero, About, Projects, Contact dan lain-lain.', icon: 'text', doc: 'site', render: renderText },
  projects: { title: 'Projek', desc: 'Tambah kategori dan koleksi, muat naik gambar, dan susun semula.', icon: 'projects', doc: 'portfolio', render: renderProjects },
  resume: { title: 'Education & Experience', desc: 'Sekolah, kerja dan anugerah. Juga muncul dalam pratonton Resume.', icon: 'resume', doc: 'resume', render: renderResume },
  preview: { title: 'Preview gallery', desc: 'Pilih gambar untuk 3 baris gambar bergerak di bawah hero.', icon: 'preview', doc: 'preview', render: renderPreview },
  backup: { title: 'Sandaran', desc: 'Import kandungan dan muat turun salinan.', icon: 'backup', render: renderBackup },
};

$('#side-nav').append(...Object.entries(TABS).map(([key, t]) =>
  h('button', { type: 'button', 'data-tab': key, 'data-doc': t.doc, onclick: () => { showTab(key); window.scrollTo(0, 0); } },
    ico(t.icon), h('span', {}, t.title), h('i', { class: 'change-dot', title: 'Ada perubahan belum disimpan' }))));

function showTab(tab) {
  state.tab = tab;
  const t = TABS[tab];
  $$('#side-nav [data-tab]').forEach(b => b.setAttribute('aria-current', String(b.dataset.tab === tab)));
  $('#page-title').textContent = t.title;
  $('#page-desc').textContent = t.desc;
  const y = window.scrollY;
  $('#panel').replaceChildren(...t.render());
  window.scrollTo(0, y);
}

async function enterApp(session) {
  $('#view-login').hidden = true;
  $('#view-app').hidden = false;
  
  $('#who-email').textContent = 'Admin';
  $('#avatar').textContent = 'A';
  $('#mode-badge').hidden = !DEMO;
  $('#panel').replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Memuatkan kandungan…'));
  await loadDocs();
  showTab(state.tab);
}

function showLogin() {
  $('#view-app').hidden = true;
  $('#view-login').hidden = false;
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Sedang log masuk…';
  $('#login-error').textContent = '';
  const { data, error } = await sb.auth.signInWithPassword({ email: toLoginEmail(f.get('email')), password: f.get('password') });
  btn.disabled = false;
  btn.textContent = 'Log masuk';
  if (error) { $('#login-error').textContent = 'Emel atau kata laluan salah.'; return; }
  enterApp(data.session);
});

$('#logout').addEventListener('click', async () => {
  if (state.dirty.size && !await ask({ title: 'Log keluar?', text: 'Ada perubahan belum disimpan. Perubahan itu akan hilang.', ok: 'Log keluar', danger: true })) return;
  state.dirty.clear();
  updateSavebar();
  if (sb) await sb.auth.signOut();
  showLogin();
});

if (DEMO) {
  enterApp({ user: { email: 'demo@localhost' } });
} else {
  const { data: { session } } = await sb.auth.getSession();
  if (session) enterApp(session); else showLogin();
}

// The admin types the username "admin@adzim" (or "admin"); Supabase Auth signs in with the real account email.
const ADMIN_LOGIN = 'ahmadzaidadzim11@gmail.com';
function toLoginEmail(v) { v = String(v || '').trim().toLowerCase(); return (v === 'admin' || v === 'admin@adzim') ? ADMIN_LOGIN : v; }
