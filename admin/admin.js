// Admin page for Adzim's portfolio. Content lives in the Supabase table "content" as four JSON
// rows (site, portfolio, resume, preview); images go to the public Storage bucket "portfolio".
// The public site reads the same rows (see loadContent in ../app.js).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const cfg = window.SUPABASE || {};
const BUCKET = 'portfolio';
const DOCS = ['site', 'portfolio', 'resume', 'preview'];
const DOC_NAMES = { site: 'Text', portfolio: 'Projects', resume: 'Education & Experience', preview: 'Preview gallery' };

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
  'logo-folio': 'Star', 'brand-design': 'Tag', 'social-media': 'Phone',
  'digital-art': 'Pen', 'print-media': 'Printer', 'ui-ux': 'Screen', others: 'Sparkle',
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
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
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

// Red error box used for every error (login and toasts).
function errorAlert(msg, onClose) {
  return h('div', { class: 'alert-error', role: 'alert' },
    h('button', { type: 'button', class: 'alert-close', 'aria-label': 'Close error', onclick: onClose }, ico('close')),
    h('p', {}, ico('alert'), msg));
}

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  const hide = () => t.classList.remove('show');
  if (bad) t.replaceChildren(errorAlert(msg, hide));
  else t.replaceChildren(ico('check'), h('span', {}, msg));
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
  btn.replaceChildren(ico(theme === 'light' ? 'moon' : 'sun'), h('span', {}, theme === 'light' ? 'Dark theme' : 'Light theme'));
}
$('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
paintIcons();

$('[data-show-pw]').addEventListener('click', e => {
  const input = e.target.closest('.pw').querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  e.target.textContent = show ? 'Hide' : 'Show';
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
  $('#save-status').textContent = 'Unsaved changes';
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
  if (error) toast(`Could not read Supabase: ${error.message}`, true);
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
  if (DEMO) throw new Error('Demo mode: nothing is saved. Log in on the real site to save.');
  const rows = keys.map(key => ({ key, data: state.docs[key], updated_at: new Date().toISOString() }));
  const { error } = await sb.from('content').upsert(rows);
  if (error) {
    const denied = /row-level security|permission/i.test(error.message);
    throw new Error(denied ? 'Permission denied: this account is not the admin in setup.sql.' : error.message);
  }
  keys.forEach(k => { state.dirty.delete(k); state.remote.add(k); });
  $('#import-notice').hidden = DOCS.every(k => state.remote.has(k));
}

async function saveAll() {
  if (!state.dirty.size) return;
  const btn = $('#save');
  btn.disabled = true;
  $('#save-status').textContent = 'Saving…';
  try {
    await saveDocs([...state.dirty]);
    updateSavebar();
    toast('Saved. The public site now shows the new content.');
  } catch (err) {
    $('#save-status').textContent = 'Save failed';
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
  const ok = await ask({ title: 'Discard all changes?', text: 'Content goes back to the last saved version.', ok: 'Discard', danger: true });
  if (!ok) return;
  state.dirty.clear();
  await loadDocs();
  updateSavebar();
  showTab(state.tab);
  toast('Changes discarded.');
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
  if (DEMO) throw new Error('Demo mode: uploading needs a real login.');
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
    iconBtn('up', 'Move up', move(-1), { disabled: i === 0 }),
    iconBtn('down', 'Move down', move(1), { disabled: i === list.length - 1 }));
}

function delBtn(onConfirm, what = 'this item') {
  return iconBtn('trash', `Delete ${what}`, async () => {
    const ok = await ask({ title: `Delete ${what}?`, text: 'This cannot be undone once saved.', ok: 'Delete', danger: true });
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
      list.length ? null : h('p', { class: 'empty' }, `No ${title.toLowerCase()} yet.`),
      addBtn(`Add ${title.toLowerCase()}`, () => { list.push(clone(blank)); markDirty(doc); draw(); }));
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
  return h('nav', { class: 'jump', 'aria-label': 'Jump to section' },
    cards.map(c => h('a', { href: `#${c.id}`, onclick: e => { e.preventDefault(); c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, c.querySelector('h2').textContent)));
}

/* ---------- Tab: Teks ---------- */
function renderText() {
  const s = state.docs.site;
  const d = 'site';
  const levelSelect = item => {
    const sel = h('select', {}, [1, 2, 3].map(n => h('option', { value: n, selected: Number(item.level) === n }, ['', 'Basic', 'Intermediate', 'Advanced'][n])));
    sel.addEventListener('change', () => { item.level = Number(sel.value); markDirty(d); });
    return h('label', { class: 'field' }, h('span', {}, 'Level'), sel);
  };
  const cards = [
    card('Hero', 'The top of the page.',
      h('div', { class: 'grid2' }, field(s.hero, 'hi', 'Greeting', d), field(s.hero, 'name', 'Name (bold)', d)),
      field(s.hero, 'title', 'Big title', d),
      field(s.hero, 'intro', 'Short line', d, { multi: true, rows: 2 }),
      h('div', { class: 'grid2' }, field(s.hero, 'searchPlaceholder', 'Search box text', d), field(s.hero, 'searchHint', 'Hint after "Type /"', d)),
      field(s.hero, 'seeMore', 'See More button', d)),
    card('Menu & brand', 'The header at the top of every page.',
      h('div', { class: 'grid3' }, ...[['home', 'Home'], ['about', 'About'], ['education', 'Education'], ['experience', 'Experience'], ['projects', 'Projects'], ['resume', 'Resume button']].map(([k, l]) => field(s.nav, k, l, d))),
      h('div', { class: 'grid2' }, field(s.brand, 'name', 'Brand', d), field(s.brand, 'suffix', 'Brand (faded part)', d))),
    card('Preview gallery', 'The note under the 3 moving image rows.',
      field(s.gallery, 'note', 'Note', d, { multi: true, rows: 2, hint: 'Write **words** for bold. Press Enter for a line break (desktop only).' })),
    card('About', 'The About Me section.',
      h('div', { class: 'grid2' }, field(s.about, 'title', 'Section title', d), field(s.about, 'cardTitle', 'Card title', d)),
      field(s.about, 'body', 'Paragraph', d, { multi: true, rows: 4 }),
      field(s.about, 'availability', 'Green pill (status)', d),
      h('div', { class: 'sub' }, field(s.about, 'languagesTitle', 'Languages list title', d),
        listEditor(s.about.languages, d, [{ key: 'name', label: 'Language' }, { key: 'level', label: 'Level' }], { name: '', level: '' }, 'Language')),
      h('div', { class: 'sub' }, field(s.about, 'softwareTitle', 'Software list title', d),
        listEditor(s.about.software, d, [{ key: 'name', label: 'Software' }, { render: levelSelect }], { name: '', level: 2 }, 'Software')),
      h('div', { class: 'sub' }, field(s.about, 'fieldsTitle', 'Fields pills title', d),
        listEditor(s.about.fields, d, [], '', 'Field'))),
    card('Section titles', 'Education and Experience titles.',
      h('div', { class: 'grid2' },
        field(s.education, 'title', 'Education', d),
        field(s.experience, 'title', 'Experience', d),
        field(s.experience, 'workTitle', 'Experience: work column', d),
        field(s.experience, 'awardsTitle', 'Experience: awards column', d))),
    card('Projects', 'The project list section.',
      h('div', { class: 'grid2' }, field(s.projects, 'title', 'Title', d), field(s.projects, 'cta', 'Card button', d)),
      field(s.projects, 'sub', 'Line under the title', d, { multi: true, rows: 2 }),
      h('div', { class: 'grid3' }, field(s.projects, 'emptyTitle', 'No results: title', d), field(s.projects, 'emptyText', 'No results: text', d), field(s.projects, 'emptyButton', 'No results: button', d))),
    card('Contact & footer', 'The bottom of the page.',
      field(s.contact, 'line', 'Big line', d),
      field(s.contact, 'sub', 'Small line', d),
      h('div', { class: 'grid3' }, field(s.contact, 'email', 'Email', d, { type: 'email' }), field(s.contact, 'linkedin', 'LinkedIn link', d, { type: 'url' }), field(s.contact, 'instagram', 'Instagram (without @)', d)),
      h('div', { class: 'grid2' }, field(s.footer, 'tagline', 'Footer: tagline', d), field(s.footer, 'copyright', 'Footer: copyright', d))),
    card('Resume', 'The Resume preview window.',
      h('div', { class: 'grid3' }, field(s.resume, 'dialogTitle', 'Window title', d), field(s.resume, 'download', 'Download button', d), field(s.resume, 'pdfName', 'PDF file name', d))),
    card('Google & browser tab', 'What shows in the browser tab and Google search.',
      field(s.meta, 'title', 'Tab title', d),
      field(s.meta, 'description', 'Google description', d, { multi: true, rows: 2, hint: 'Best under 160 characters.' })),
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
    h('p', { class: 'eyebrow' }, `${list.length} ${list.length === 1 ? 'category' : 'categories'}`),
    ...list.map((p, i) => h('div', { class: `cat-item${i === state.cat ? ' active' : ''}` },
      h('button', { class: 'cat-name', type: 'button', onclick: () => { state.cat = i; rerender(); } },
        h('i', { class: 'swatch', style: `background:${p.accent || '#c9c4d6'}` }),
        h('span', {}, h('b', {}, p.title || '(untitled)'), h('small', {}, `${p.sections.length} collections · ${visuals(p)} images`))),
      moveBtns(list, i, d, () => { state.cat = i + 0; rerender(); }))),
    addBtn('New category', async () => {
      const name = await ask({ title: 'New category', label: 'Category name', ok: 'Create' });
      if (!name) return;
      let id = slug(name);
      while (list.some(p => p.id === id)) id += '-2';
      list.push({ id, category: id, title: name, desc: '', label: '', accent: '#b8a0ff', icon: 'others', sections: [] });
      state.cat = list.length - 1;
      markDirty(d);
      rerender();
    }));

  const p = list[state.cat];
  if (!p) return [h('div', { class: 'split' }, side, h('div', { class: 'card' }, h('p', { class: 'empty' }, 'No categories yet. Click "New category" to start.')))];

  const iconSel = h('select', {}, Object.entries(ICON_NAMES).map(([k, label]) => h('option', { value: k, selected: (p.icon || p.id) === k }, label)));
  iconSel.addEventListener('change', () => { p.icon = iconSel.value; markDirty(d); });
  const swatchRow = h('div', { class: 'swatches' });
  const drawSwatches = () => swatchRow.replaceChildren(
    ...SWATCHES.map(c => h('button', { type: 'button', class: `swatch-btn${(p.accent || '').toLowerCase() === c ? ' on' : ''}`, style: `background:${c}`, title: c, 'aria-label': `Colour ${c}`,
      onclick: () => { p.accent = c; markDirty(d); drawSwatches(); } })),
    h('label', { class: 'swatch-custom', title: 'Other colour' }, h('input', { type: 'color', value: p.accent || '#b8a0ff', oninput: e => { p.accent = e.target.value; markDirty(d); } }), '+'));
  drawSwatches();

  const editor = h('div', { class: 'cat-editor' },
    card(p.title || 'Category', `Shows as a card and a filter button in Projects. Link: #project/${p.id}`,
      h('div', { class: 'grid2' }, field(p, 'title', 'Name', d), field(p, 'label', 'Small label (top of card)', d)),
      field(p, 'desc', 'Description', d, { multi: true, rows: 2 }),
      h('div', { class: 'grid2' },
        h('div', { class: 'field' }, h('span', {}, 'Accent colour'), swatchRow),
        h('label', { class: 'field' }, h('span', {}, 'Filter icon'), iconSel)),
      h('div', { class: 'card-foot' },
        h('button', { class: 'btn ghost danger', type: 'button', onclick: async () => {
          const ok = await ask({ title: `Delete category "${p.title}"?`, text: 'All collections and images in this category will be removed.', ok: 'Delete category', danger: true });
          if (!ok) return;
          await removeStored(p.sections.flatMap(s => s.images));
          list.splice(state.cat, 1);
          state.cat = 0;
          markDirty(d);
          rerender();
        } }, ico('trash'), 'Delete category'))),
    h('div', { class: 'section-title' }, h('h2', {}, 'Collections'), h('span', { class: 'muted' }, `${p.sections.length} collections`)),
    ...p.sections.map((s, si) => collectionCard(p, s, si, rerender)),
    p.sections.length ? null : h('p', { class: 'empty card' }, 'No collections in this category yet.'),
    addBtn('New collection', async () => {
      const name = await ask({ title: 'New collection', label: 'Collection name', ok: 'Create' });
      if (!name) return;
      p.sections.push({ title: name, images: [] });
      markDirty(d);
      rerender();
    }));
  return [h('div', { class: 'split' }, side, editor)];
}

function collectionCard(p, s, si, rerender) {
  const d = 'portfolio';
  const status = h('span', {}, 'Drag images here, or ', h('u', {}, 'choose files'));
  const drop = h('label', { class: 'drop' },
    h('input', { type: 'file', accept: 'image/*', multiple: true, onchange: e => addFiles(e.target.files) }),
    ico('upload'), status, h('small', {}, 'JPG, PNG or WebP. Resized to WebP automatically.'));
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });

  async function addFiles(files) {
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    drop.classList.add('busy');
    let done = 0;
    for (const f of imgs) {
      status.textContent = `Uploading ${done + 1} of ${imgs.length}…`;
      try {
        s.images.push(await uploadImage(f, `${p.id}/${slug(s.title)}`, `${s.title} — visual ${s.images.length + 1}`));
        done++;
        markDirty(d);
      } catch (err) {
        toast(`Could not upload ${f.name}: ${err.message}`, true);
      }
    }
    if (done) toast(`${done} image${done === 1 ? '' : 's'} uploaded. Click Save to publish.`);
    rerender();
  }

  const thumbs = h('div', { class: 'thumbs' }, s.images.map((a, i) => {
    const dark = h('input', { type: 'checkbox', checked: !!a.dark });
    dark.addEventListener('change', () => { a.dark = dark.checked; markDirty(d); });
    const alt = h('input', { value: a.alt || '', placeholder: 'Image description', title: 'Alt text (for screen readers)' });
    alt.addEventListener('input', () => { a.alt = alt.value; markDirty(d); });
    return h('figure', { class: 'thumb' },
      h('div', { class: 'thumb-img' },
        h('img', { src: asset(a.thumb || a.display || a.src), alt: '', loading: 'lazy' }),
        h('span', { class: 'thumb-num' }, String(i + 1)),
        h('div', { class: 'thumb-tools' },
          moveBtns(s.images, i, d, rerender),
          delBtn(async () => { await removeStored([a]); s.images.splice(i, 1); markDirty(d); rerender(); }, 'this image'))),
      alt,
      h('label', { class: 'check', title: 'Tick if the image is dark and needs a light background' }, dark, 'Dark image'));
  }));

  const heading = h('b', { class: 'coll-name' }, s.title || '(untitled)');
  const nameField = field(s, 'title', 'Collection name', d);
  nameField.querySelector('input').addEventListener('input', e => { heading.textContent = e.target.value || '(untitled)'; });

  return h('details', { class: 'card collection', open: s.images.length < 9 },
    h('summary', {},
      h('span', { class: 'chev', 'aria-hidden': 'true' }),
      heading,
      h('span', { class: 'count' }, `${s.images.length} images`),
      h('span', { class: 'row-tools', onclick: e => e.preventDefault() },
        moveBtns(p.sections, si, d, rerender),
        delBtn(async () => { await removeStored(s.images); p.sections.splice(si, 1); markDirty(d); rerender(); }, `collection "${s.title}"`))),
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
    const ta = h('textarea', { rows: 3, value: (item.points || []).join('\n'), placeholder: 'One point per line' });
    ta.addEventListener('input', () => { item.points = ta.value.split('\n').map(t => t.trim()).filter(Boolean); markDirty(d); });
    return h('label', { class: 'field wide' }, h('span', {}, 'Details (one line = one point)'), ta);
  };
  const startField = { key: 'start', label: 'Start (YYYY-MM)', placeholder: '2024-09' };
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
        toast('Logo uploaded. Click Save.');
      } catch (err) { toast(err.message, true); }
    });
    return h('label', { class: 'field logo-field' }, h('span', {}, 'Logo'), h('span', { class: 'logo-box' }, preview, h('span', { class: 'btn ghost small' }, ico('upload'), 'Change')), input);
  };
  const current = r.current || (r.current = { role: '', org: '', date: '', start: '', points: [] });
  return [
    card('Education', 'School cards with logos. Ordered oldest to newest.',
      listEditor(r.education, d, [
        { key: 'school', label: 'School' }, { key: 'award', label: 'Program' }, { key: 'cgpa', label: 'CGPA' },
        { key: 'date', label: 'Date' }, startField, { render: logoField }],
      { school: '', award: '', cgpa: '', date: '', start: '' }, 'School')),
    card('Current job', 'The newest item in the Experience timeline. Leave "Start" empty to hide it.',
      h('div', { class: 'grid2' }, field(current, 'role', 'Role', d), field(current, 'org', 'Organisation', d),
        field(current, 'date', 'Date', d), field(current, 'start', startField.label, d, { placeholder: '2026-09' }))),
    card('Work, curricular & leadership', 'Left timeline in Experience. Ordered by "Start" date.',
      listEditor(r.experience, d, [
        { key: 'role', label: 'Role' }, { key: 'org', label: 'Organisation' }, { key: 'date', label: 'Date' }, startField, { render: pointsField }],
      { role: '', org: '', date: '', start: '', points: [] }, 'Experience')),
    card('Awards & certificates', 'Right timeline in Experience.',
      listEditor(r.honors, d, [
        { key: 'title', label: 'Award' }, { key: 'org', label: 'Organiser' }, { key: 'date', label: 'Date' }, startField, { render: pointsField }],
      { title: '', org: '', date: '', start: '', points: [] }, 'Award')),
    card('Resume details', 'The top of the Resume preview.',
      h('div', { class: 'grid2' }, field(r, 'name', 'Full name', d), field(r, 'location', 'Location', d),
        field(r, 'email', 'Email', d), field(r, 'availability', 'Availability', d))),
  ];
}

/* ---------- Tab: Preview gallery ---------- */
function renderPreview() {
  const pv = state.docs.preview;
  const d = 'preview';
  const rows = [['logo', 'Row 1 · Logos', 'Logos in white boxes, moving right.'], ['square', 'Row 2 · Square', 'Square posters, moving left.'], ['portrait', 'Row 3 · Portrait', 'Portrait posters, moving right.']];
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
        toast('Image added to the row.');
      } }, h('img', { src: asset(a.thumb || a.display || a.src), alt: a.alt, loading: 'lazy' })))));
    });
    dlg.append(h('div', { class: 'picker-head' }, h('h2', {}, 'Choose an image'), iconBtn('close', 'Close', () => dlg.close())), grid);
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
          h('div', { class: 'thumb-tools' }, moveBtns(list, i, d, rerender), delBtn(() => { list.splice(i, 1); markDirty(d); rerender(); }, 'this image from the row'))));
      })) : h('p', { class: 'empty' }, 'This row is empty.'),
      addBtn('Add image', () => picker(key)));
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
    card('Import current content', 'Once only, to start using Supabase.',
      h('p', {}, imported.length
        ? `Already in Supabase: ${imported.map(k => DOC_NAMES[k]).join(', ')}. Importing replaces it with the content from the site files.`
        : 'No content in Supabase yet. Import once to start.'),
      h('div', {}, h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        if (imported.length && !await ask({ title: 'Replace the content in Supabase?', text: 'Every change made through the admin will be replaced with the content from the site files.', ok: 'Replace', danger: true })) return;
        Object.assign(state.docs, bundled());
        try { await saveDocs(DOCS); toast('Import complete.'); showTab('backup'); }
        catch (err) { toast(err.message, true); }
      } }, 'Import current content'))),
    card('Download', 'Keep a copy of the content on your computer.',
      h('div', { class: 'backup-grid' },
        h('div', { class: 'backup-item' }, h('b', {}, 'JSON backup'), h('p', { class: 'muted' }, 'One file with all the content. Keep it as a backup.'),
          h('button', { class: 'btn', type: 'button', onclick: () => download(`portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state.docs, null, 2)) }, ico('backup'), 'Download JSON')),
        h('div', { class: 'backup-item' }, h('b', {}, 'Fallback files'), h('p', { class: 'muted' }, 'Three files for the dist folder before deploying. The site uses them when Supabase does not answer.'),
          h('button', { class: 'btn', type: 'button', onclick: () => {
            summarise(state.docs.portfolio);
            download('site-data.js', `window.SITE = ${JSON.stringify(state.docs.site, null, 2)};\n`, 'text/javascript');
            setTimeout(() => download('portfolio-data.js', `window.PORTFOLIO_DATA = ${JSON.stringify(state.docs.portfolio)};\n`, 'text/javascript'), 300);
            setTimeout(() => download('resume-data.js', `window.RESUME = ${JSON.stringify(state.docs.resume, null, 2)};\n`, 'text/javascript'), 600);
          } }, ico('backup'), 'Download fallback files')))),
  ];
}

/* ---------- Tabs and views ---------- */
const TABS = {
  text: { title: 'Site text', desc: 'Edit the text in every part of the site: hero, About, Projects, Contact and more.', icon: 'text', doc: 'site', render: renderText },
  projects: { title: 'Projects', desc: 'Add categories and collections, upload images and reorder them.', icon: 'projects', doc: 'portfolio', render: renderProjects },
  resume: { title: 'Education & Experience', desc: 'Schools, work and awards. Also shown in the Resume preview.', icon: 'resume', doc: 'resume', render: renderResume },
  preview: { title: 'Preview gallery', desc: 'Choose images for the 3 moving rows under the hero.', icon: 'preview', doc: 'preview', render: renderPreview },
  backup: { title: 'Backup', desc: 'Import content and download copies.', icon: 'backup', render: renderBackup },
};

$('#side-nav').append(...Object.entries(TABS).map(([key, t]) =>
  h('button', { type: 'button', 'data-tab': key, 'data-doc': t.doc, onclick: () => { showTab(key); window.scrollTo(0, 0); } },
    ico(t.icon), h('span', {}, t.title), h('i', { class: 'change-dot', title: 'Unsaved changes' }))));

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
  $('#panel').replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Loading content…'));
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
  btn.textContent = 'Logging in…';
  $('#login-error').replaceChildren();
  const { data, error } = await sb.auth.signInWithPassword({ email: toLoginEmail(f.get('email')), password: f.get('password') });
  btn.disabled = false;
  btn.textContent = 'Log in';
  if (error) { $('#login-error').replaceChildren(errorAlert('Wrong username or password.', () => $('#login-error').replaceChildren())); return; }
  enterApp(data.session);
});

$('#logout').addEventListener('click', async () => {
  if (state.dirty.size && !await ask({ title: 'Log out?', text: 'You have unsaved changes. They will be lost.', ok: 'Log out', danger: true })) return;
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
