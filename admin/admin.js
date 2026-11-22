// Admin page for Adzim's portfolio. Content lives in the Supabase table "content" as four JSON
// rows (site, portfolio, resume, preview); images go to the public Storage bucket "portfolio".
// The public site reads the same rows (see loadContent in ../app.js).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const cfg = window.SUPABASE || {};
const BUCKET = 'portfolio';
const DOCS = ['site', 'portfolio', 'resume', 'preview'];
const DOC_NAMES = { site: 'Text & FAQ', portfolio: 'Projects', resume: 'Education & Experience', preview: 'Preview gallery' };

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
const SWATCHES = ['#b8a0ff', '#8dbaff', '#a2d9ba', '#d7c785', '#ddad82', '#f4a1ba', '#ff8a80', '#c9c4d6', '#7fd6c9', '#ffb470', '#d79bff', '#b5d86b'];

/* ---------- Icons (static, trusted markup) ---------- */
const P = {
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
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
  play: '<path d="M8 5.5v13l11-6.5Z" fill="currentColor"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  moon: '<path d="M20.8 13.4A9 9 0 0 1 10.6 3.2 9 9 0 1 0 20.8 13.4Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
  insights: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 18h2"/>',
  desktop: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
function ico(name) { const i = document.createElement('i'); i.className = 'ico'; i.innerHTML = svg(name); return i; }
const paintIcons = (scope = document) => $$('[data-icon]', scope).forEach(el => { el.className = 'ico'; el.innerHTML = svg(el.dataset.icon); });

/* ---------- Loader ----------
   From Uiverse.io by mobinkakei - https://uiverse.io/mobinkakei/grumpy-turtle-41
   MIT License, Copyright (c) mobinkakei (Mobeen). Styles: .ball-loader in admin.css. */
function loaderEl() {
  const el = document.createElement('div');
  el.className = 'ball-loader';
  el.setAttribute('aria-hidden', 'true');
  ['circle', 'circle', 'circle', 'shadow', 'shadow', 'shadow'].forEach(cls => { const d = document.createElement('div'); d.className = cls; el.append(d); });
  return el;
}

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

// The admin uses the site's accent colours too (site.theme, set in Site text › Colours & theme).
// The last ones seen are kept in this browser, so the login screen has them before the content loads.
const ADMIN_COLORS = 'adz:admin-colors';
function applyAdminColors(t) {
  const hex = /^#[0-9a-f]{6}$/i;
  t = t || {};
  let css = '';
  if (hex.test(t.dark || '')) css += `:root:root{--accent:${t.dark};--accent-soft:color-mix(in srgb,${t.dark} 14%,transparent)}`;
  if (hex.test(t.light || '')) css += `:root:root[data-theme="light"]{--accent:${t.light};--accent-soft:color-mix(in srgb,${t.light} 10%,transparent)}`;
  let el = document.getElementById('admin-colors');
  if (!el) { el = document.createElement('style'); el.id = 'admin-colors'; document.head.append(el); }
  el.textContent = css;
  try { localStorage.setItem(ADMIN_COLORS, JSON.stringify({ dark: t.dark, light: t.light })); } catch (_) {}
}
try { applyAdminColors(JSON.parse(localStorage.getItem(ADMIN_COLORS) || 'null')); } catch (_) {}
paintIcons();

$('[data-show-pw]').addEventListener('click', e => {
  const input = e.target.closest('.pw').querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  e.target.textContent = show ? 'Hide' : 'Show';
});

/* ---------- State ---------- */
const state = { docs: {}, remote: new Set(), dirty: new Set(), tab: 'insights', cat: 0 };

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
  if (state.dirty.size || state.wizard?.hasContent()) { e.preventDefault(); e.returnValue = ''; }
});
// A file dropped outside a drop zone must not open in the tab (that would lose unsaved work).
['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => {
  if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault();
}));

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
  applyAdminColors(state.docs.site.theme);
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

/* ---------- Favicon: any image becomes round tab icons (and a square home-screen icon) ---------- */
// The picture is cropped to fill a square from its centre; tab icons are clipped to a circle on transparency.
async function iconPng(bitmap, size, round, crop) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (round) {
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    g.clip();
  } else {
    g.fillStyle = '#ffffff'; // iPhone home screens show black behind transparency
    g.fillRect(0, 0, size, size);
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const c = crop || { x: (bitmap.width - side) / 2, y: (bitmap.height - side) / 2, size: side };
  g.drawImage(bitmap, c.x, c.y, c.size, c.size, 0, 0, size, size);
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}

// Crop editor: move and zoom the picture under a round frame with a rule-of-thirds grid.
// Resolves to the chosen square in the picture's own pixels, or null when cancelled.
function cropImage(bitmap, { w: W = 300, h: H = 300, round = true, title = 'Crop your icon' } = {}) {
  const canvas = h('canvas', { class: 'crop-img', width: bitmap.width, height: bitmap.height });
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const minS = Math.max(W / bitmap.width, H / bitmap.height);
  let s = minS;
  let ox = (W - bitmap.width * s) / 2;
  let oy = (H - bitmap.height * s) / 2;
  const clamp = () => {
    ox = Math.min(0, Math.max(W - bitmap.width * s, ox));
    oy = Math.min(0, Math.max(H - bitmap.height * s, oy));
    canvas.style.width = `${bitmap.width * s}px`;
    canvas.style.height = `${bitmap.height * s}px`;
    canvas.style.transform = `translate(${ox}px, ${oy}px)`;
  };
  const zoomTo = (next, cx = W / 2, cy = H / 2) => {
    next = Math.min(minS * 5, Math.max(minS, next));
    ox = cx - (cx - ox) * (next / s);
    oy = cy - (cy - oy) * (next / s);
    s = next;
    clamp();
    range.value = String(s / minS);
  };
  const range = h('input', { type: 'range', min: '1', max: '5', step: '0.01', value: '1', 'aria-label': 'Zoom' });
  range.addEventListener('input', () => zoomTo(minS * Number(range.value)));
  const stage = h('div', { class: 'crop-stage', style: `width:${W}px;height:${H}px` }, canvas, round ? h('span', { class: 'crop-mask', 'aria-hidden': 'true' }) : null, h('span', { class: 'crop-grid', 'aria-hidden': 'true' }));
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId);
    const sx = e.clientX - ox;
    const sy = e.clientY - oy;
    const move = ev => { ox = ev.clientX - sx; oy = ev.clientY - sy; clamp(); };
    const up = () => { stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerup', up); };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
  });
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const b = stage.getBoundingClientRect();
    zoomTo(s * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - b.left, e.clientY - b.top);
  }, { passive: false });
  clamp();
  const dlg = h('dialog', { class: 'crop-dialog' });
  return new Promise(resolve => {
    const done = value => { dlg.close(); dlg.remove(); resolve(value); };
    dlg.append(
      h('h2', {}, title),
      h('p', { class: 'muted' }, 'Drag to move, use the slider or scroll to zoom. The lines split the frame in thirds.'),
      stage,
      h('label', { class: 'crop-zoom' }, h('span', {}, '−'), range, h('span', {}, '+')),
      h('div', { class: 'ask-actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => done({ x: -ox / s, y: -oy / s, size: W / s, w: W / s, h: H / s }) }, 'Use this crop'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => done(null) }, 'Cancel')));
    dlg.addEventListener('cancel', e => { e.preventDefault(); done(null); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/* ---------- About photo: crop (rule of thirds), remove the background, upload ---------- */
// Background removal for a person on a plain backdrop: flood-fill the backdrop colour in from the edges
// (so a white shirt inside the outline stays), then soften the cut edge by one pixel.
function removeBackground(src, tol) {
  const { width: w, height: hgt } = src;
  const out = new ImageData(new Uint8ClampedArray(src.data), w, hgt);
  const d = out.data;
  // Backdrop colour: median of the top edge and the upper sides (the bottom edge is usually the body).
  const rs = [], gs = [], bs = [];
  const addPx = i => { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); };
  for (let x = 0; x < w; x++) addPx(x * 4);
  for (let y = 0; y < hgt * 0.6; y++) { addPx(y * w * 4); addPx((y * w + w - 1) * 4); }
  const median = list => list.sort((m, k) => m - k)[list.length >> 1];
  const r = median(rs), g = median(gs), b = median(bs);
  const dist = i => Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b);
  const bg = new Uint8Array(w * hgt);
  const stack = [];
  const seed = p => { if (!bg[p] && dist(p * 4) < tol) { bg[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((hgt - 1) * w + x); }
  for (let y = 0; y < hgt; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < w * (hgt - 1)) seed(p + w);
  }
  // Two rings of pixels along the cut fade by how close they are to the backdrop colour (no light halo).
  const near = (p, mark) => { const x = p % w; return (x > 0 && mark[p - 1]) || (x < w - 1 && mark[p + 1]) || (p >= w && mark[p - w]) || (p < w * (hgt - 1) && mark[p + w]); };
  const ring1 = new Uint8Array(w * hgt);
  for (let p = 0; p < w * hgt; p++) if (!bg[p] && near(p, bg)) ring1[p] = 1;
  for (let p = 0; p < w * hgt; p++) {
    if (bg[p]) { d[p * 4 + 3] = 0; continue; }
    const fade = (dist(p * 4) - tol * 0.8) / (tol * 2.2);
    if (ring1[p]) d[p * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, fade)));
    else if (near(p, ring1)) d[p * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0.6, fade + 0.3)));
  }
  return out;
}

// Crop, then preview the cut-out on a checkerboard with a strength slider. Resolves to a WebP blob (or null).
async function preparePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const crop = await cropImage(bitmap, { w: 280, h: 350, round: false, title: 'Crop your photo' });
  if (!crop) { bitmap.close(); return null; }
  const scale = Math.min(1, 1250 / crop.h);
  const cw = Math.round(crop.w * scale);
  const ch = Math.round(crop.h * scale);
  const canvas = h('canvas', { width: cw, height: ch, class: 'cut-canvas' });
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, cw, ch);
  bitmap.close();
  const original = g.getImageData(0, 0, cw, ch);
  const remove = h('input', { type: 'checkbox', checked: true });
  const tol = h('input', { type: 'range', min: '8', max: '120', step: '1', value: '42', 'aria-label': 'Background strength' });
  const draw = () => g.putImageData(remove.checked ? removeBackground(original, Number(tol.value)) : original, 0, 0);
  remove.addEventListener('change', draw);
  tol.addEventListener('input', draw);
  draw();
  const dlg = h('dialog', { class: 'crop-dialog cut-dialog' });
  return new Promise(resolve => {
    const done = ok => {
      dlg.close();
      dlg.remove();
      if (!ok) return resolve(null);
      canvas.toBlob(blob => resolve(blob && { blob, width: cw, height: ch }), 'image/webp', 0.9);
    };
    dlg.append(
      h('h2', {}, 'Remove background'),
      h('p', { class: 'muted' }, 'Works best on a plain background. Raise the strength if some backdrop is left, lower it if the edge of your hair or clothes is cut.'),
      h('div', { class: 'cut-stage' }, canvas),
      h('label', { class: 'check' }, remove, 'Remove background'),
      h('label', { class: 'crop-zoom' }, h('span', {}, 'Strength'), tol),
      h('div', { class: 'ask-actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => done(true) }, 'Use this photo'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => done(false) }, 'Cancel')));
    dlg.addEventListener('cancel', e => { e.preventDefault(); done(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

function aboutPhotoField(about, doc) {
  const img = h('img', { class: 'about-photo-prev', alt: '' });
  const status = h('small', {}, 'A photo of you on a plain background (portrait). You crop it, then the background is removed.');
  const removeBtn = h('button', { class: 'btn ghost small', type: 'button' }, 'Remove photo');
  const draw = () => {
    img.hidden = !(about.photo && about.photo.src);
    if (!img.hidden) img.src = asset(about.photo.src);
    removeBtn.hidden = img.hidden;
  };
  const input = h('input', { type: 'file', accept: 'image/*' });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    try {
      const made = await preparePhoto(f);
      if (!made) return;
      status.textContent = 'Uploading…';
      let src = URL.createObjectURL(made.blob);
      const storage = [];
      if (!DEMO) {
        const path = `about/photo-${Date.now().toString(36)}.webp`;
        const { error } = await sb.storage.from(BUCKET).upload(path, made.blob, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
        if (error) throw new Error(error.message);
        storage.push(path);
        src = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      about.photo = { src, width: made.width, height: made.height, storage };
      markDirty(doc);
      draw();
      status.textContent = 'New photo ready. Click Save to publish.';
    } catch (err) {
      status.textContent = 'Upload failed.';
      toast(`Could not upload the photo: ${err.message}`, true);
    }
  });
  removeBtn.addEventListener('click', () => { delete about.photo; markDirty(doc); draw(); status.textContent = 'Photo removed. Click Save to publish.'; });
  draw();
  return h('div', { class: 'field' }, h('span', {}, 'Your photo'),
    h('div', { class: 'fav-row' }, img,
      h('div', { class: 'fav-side' }, h('div', { class: 'fav-actions' }, h('label', { class: 'btn small' }, ico('upload'), 'Upload photo', input), removeBtn), status)));
}

// The box behind the About photo: colour, uploaded image, shader or CSS animation (../backdrop.js draws it).
function backdropField(about, doc) {
  const BD = window.AboutBackdrop;
  if (!BD) return null;
  const b = about.backdrop || (about.backdrop = { type: 'color', colors: BD.DEFAULT_COLORS.slice() });
  if (!Array.isArray(b.colors)) b.colors = BD.DEFAULT_COLORS.slice();
  const preview = h('div', { class: 'bd-preview' }, h('span', { class: 'bd-preview-word' }, about.word || ''));
  const extra = h('div', { class: 'bd-extra' });
  const changed = () => { markDirty(doc); BD.render(preview, b); };
  const types = [['color', 'Colour'], ['image', 'Image'], ['shader', 'Shader'], ['animated', 'Animated']];
  const seg = h('div', { class: 'bd-seg', role: 'group', 'aria-label': 'Backdrop type' });
  const drawSeg = () => seg.replaceChildren(...types.map(([k, label]) => h('button', {
    type: 'button', class: 'btn small' + (b.type === k ? ' primary' : ' ghost'), 'aria-pressed': String(b.type === k),
    onclick: () => { b.type = k; drawSeg(); drawExtra(); changed(); },
  }, label)));
  const colorRow = () => h('div', { class: 'bd-colors' }, ...[0, 1, 2].map(i => {
    if (b.type === 'color' && i > 0) return null;
    if (b.type === 'image' && i > 0) return null;
    const input = h('input', { type: 'color', value: b.colors[i] || BD.DEFAULT_COLORS[i], title: `Colour ${i + 1}` });
    input.addEventListener('input', () => { b.colors[i] = input.value; changed(); });
    return h('label', { class: 'bd-color' }, input, h('small', {}, b.type === 'image' ? 'Behind the image' : `Colour ${i + 1}`));
  }));
  const pick = (key, options) => {
    const sel = h('select', {}, Object.entries(options).map(([k, label]) => h('option', { value: k, selected: b[key] === k }, label)));
    if (!options[b[key]]) b[key] = Object.keys(options)[0];
    sel.addEventListener('change', () => { b[key] = sel.value; changed(); });
    return h('label', { class: 'field' }, h('span', {}, key === 'shader' ? 'Shader' : 'Animation'), sel);
  };
  const imageRow = () => {
    const status = h('small', {}, b.image && b.image.src ? 'Image set. Upload another to replace it.' : 'JPG, PNG or WebP. It fills the box behind your photo.');
    const input = h('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      input.value = '';
      if (!f) return;
      status.textContent = 'Uploading…';
      try {
        const a = await uploadImage(f, 'about', 'About backdrop');
        b.image = { src: a.display || a.src, storage: a.storage || [] };
        changed();
        status.textContent = 'Image ready. Click Save to publish.';
      } catch (err) { status.textContent = 'Upload failed.'; toast(err.message, true); }
    });
    return h('div', { class: 'fav-actions' }, h('label', { class: 'btn small' }, ico('upload'), 'Upload image', input), status);
  };
  const drawExtra = () => extra.replaceChildren(...[
    b.type === 'image' ? imageRow() : null,
    b.type === 'shader' ? pick('shader', BD.SHADERS) : null,
    b.type === 'animated' ? pick('animated', BD.ANIMATED) : null,
    colorRow()].filter(Boolean));
  drawSeg();
  drawExtra();
  BD.render(preview, b);
  return h('div', { class: 'field' }, h('span', {}, 'Box behind your photo'),
    h('div', { class: 'bd-row' }, preview, h('div', { class: 'bd-side' }, seg, extra,
      h('small', {}, 'Shaders and animations pause when off screen and stay still for visitors who prefer less motion.'))));
}

async function uploadFavicon(file) {
  const bitmap = await createImageBitmap(file);
  const crop = await cropImage(bitmap);
  if (!crop) { bitmap.close(); return null; }
  const sizes = { icon: [64, true], large: [512, true], apple: [180, false] };
  const out = { storage: [] };
  const stamp = Date.now().toString(36);
  for (const [name, [size, round]] of Object.entries(sizes)) {
    const blob = await iconPng(bitmap, size, round, crop);
    if (DEMO) { out[name] = URL.createObjectURL(blob); continue; }
    const path = `site/favicon-${stamp}-${name}.png`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false, cacheControl: '31536000' });
    if (error) throw new Error(error.message);
    out.storage.push(path);
    out[name] = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  bitmap.close();
  return out;
}

// Shows the saved icon in the admin's own tab too.
function setPageIcon(href) {
  const link = document.querySelector('link[rel="icon"]');
  if (link) link.href = href || '../assets/favicon-32.png';
}

function faviconField(meta, doc) {
  const fallback = '../assets/favicon-32.png';
  const current = () => (meta.favicon && meta.favicon.large) || fallback;
  const big = h('img', { class: 'fav-big', alt: '' });
  const tabIcon = h('img', { class: 'fav-tab-icon', alt: '' });
  const tabTitle = h('span', {});
  const status = h('small', {}, 'PNG, JPG or WebP. Square pictures work best; others are cropped from the centre into a circle.');
  const reset = h('button', { class: 'btn ghost small', type: 'button' }, 'Use default');
  const draw = () => {
    big.src = asset(current());
    tabIcon.src = asset(current());
    tabTitle.textContent = meta.title || 'Tab title';
    reset.hidden = !meta.favicon;
  };
  const input = h('input', { type: 'file', accept: 'image/*' });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    status.textContent = 'Making the icon…';
    try {
      // The old files stay in Storage (a few KB): the live site uses them until this is saved.
      const made = await uploadFavicon(f);
      if (!made) { draw(); status.textContent = 'Cancelled.'; return; }
      meta.favicon = made;
      markDirty(doc);
      draw();
      setPageIcon(meta.favicon.icon);
      status.textContent = 'New icon ready. Click Save to publish.';
    } catch (err) {
      status.textContent = 'Upload failed.';
      toast(`Could not upload the icon: ${err.message}`, true);
    }
  });
  reset.addEventListener('click', async () => {
    if (!meta.favicon) return;
    delete meta.favicon;
    markDirty(doc);
    draw();
    setPageIcon('');
    status.textContent = 'Back to the default icon. Click Save to publish.';
  });
  draw();
  return h('div', { class: 'field fav-field' },
    h('span', {}, 'Favicon (tab icon)'),
    h('div', { class: 'fav-row' },
      big,
      h('div', { class: 'fav-side' },
        h('div', { class: 'fav-tab', 'aria-hidden': 'true' }, tabIcon, tabTitle, h('i', {}, '×')),
        h('div', { class: 'fav-actions' },
          h('label', { class: 'btn small' }, ico('upload'), 'Upload icon', input),
          reset),
        status)));
}

async function uploadImage(file, folder, alt) {
  const bitmap = await createImageBitmap(file);
  if (DEMO) { // nothing leaves this computer: the page shows the file itself until reload
    const url = URL.createObjectURL(file);
    const local = { alt, dark: false, storage: [], src: url, display: url, thumb: url, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return local;
  }
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

// Videos: the file is uploaded as it is (no re-encoding); a frame near the start becomes the poster,
// stored in src/display/thumb like an image so every image-only place keeps working.
const VIDEO_MAX_MB = 50; // Supabase free plan: 50 MB per file
const fmtDuration = sec => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
function videoPoster(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const fail = () => { URL.revokeObjectURL(url); reject(new Error('This video could not be read. Try an MP4 (H.264) file.')); };
    v.onerror = fail;
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 0) / 4); };
    v.onseeked = () => {
      try {
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        if (!c.width || !c.height) { fail(); return; }
        c.getContext('2d').drawImage(v, 0, 0);
        c.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob) { reject(new Error('Could not make a poster frame.')); return; }
          resolve({ poster: new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-poster.png`, { type: 'image/png' }), duration: v.duration || 0 });
        }, 'image/png');
      } catch (err) { fail(); }
    };
    v.src = url;
  });
}
async function uploadVideo(file, folder, alt) {
  if (file.size > VIDEO_MAX_MB * 1024 * 1024) throw new Error(`Video is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${VIDEO_MAX_MB} MB; export it smaller (e.g. 1080p H.264).`);
  const { poster, duration } = await videoPoster(file);
  const a = await uploadImage(poster, folder, alt);
  a.duration = Math.round(duration * 10) / 10;
  if (DEMO) { a.video = URL.createObjectURL(file); return a; }
  const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [0, 'mp4'])[1].toLowerCase();
  const path = `${folder}/${Date.now().toString(36)}-${slug(file.name.replace(/\.[^.]+$/, ''))}.${ext}`;
  const type = file.type || (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false, cacheControl: '31536000' });
  if (error) { await removeStored([a]); throw new Error(error.message); }
  a.storage.push(path);
  a.video = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return a;
}

async function removeStored(images) {
  const paths = images.flatMap(a => a.storage || []);
  if (paths.length && sb) await sb.storage.from(BUCKET).remove(paths);
}

/* ---------- Form controls bound to an object ---------- */
function field(obj, key, label, doc, { multi = false, hint = '', type = 'text', rows = 3, placeholder = '', wide = false } = {}) {
  const input = multi
    ? h('textarea', { rows, value: obj[key] ?? '', placeholder })
    : h('input', { type, value: obj[key] ?? '', placeholder });
  input.addEventListener('input', () => { obj[key] = input.value; markDirty(doc); });
  return h('label', { class: `field${wide ? ' wide' : ''}` }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
}

const iconBtn = (name, label, onclick, extra = {}) =>
  h('button', { class: `icon-btn${extra.danger ? ' danger' : ''}`, type: 'button', title: label, 'aria-label': label, onclick, disabled: extra.disabled }, ico(name));

function moveBtns(list, i, doc, rerender) {
  const move = d => () => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    markDirty(doc);
    rerender(j); // j: where the moved item is now
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
      ...(list.length ? [] : [h('p', { class: 'empty' }, `No ${title.toLowerCase()} yet.`)]),
      addBtn(`Add ${title.toLowerCase()}`, () => { list.push(clone(blank)); markDirty(doc); draw(); }));
  };
  draw();
  return wrap;
}

/* ---------- Social media list (Contact & footer) ---------- */
// Brand platforms use their own logo (../socials.js); "Custom link" uses any Google Material Symbol by name.
function socialsEditor(contact, doc) {
  const P = window.SOCIALS || {};
  if (!Array.isArray(contact.socials)) {
    contact.socials = [
      { type: 'email', url: '' },
      contact.linkedin ? { type: 'linkedin', url: contact.linkedin } : null,
      contact.instagram ? { type: 'instagram', url: contact.instagram } : null,
    ].filter(Boolean);
  }
  ensureSymbolsFont();
  const preview = item => {
    const brand = P[item.type];
    if (item.type === 'custom' || !brand) return h('span', { class: 'material-symbols-rounded soc-prev' }, (item.icon || 'link').trim().toLowerCase());
    const i = h('span', { class: 'soc-prev', style: `color:${brand.color}` });
    i.innerHTML = `<svg viewBox="${brand.vb}" width="22" height="22" ${brand.stroke ? 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"'}><path d="${brand.d}"/></svg>`;
    return i;
  };
  const platform = item => {
    const wrap = h('div', { class: 'soc-edit' });
    const draw = () => {
      const sel = h('select', {}, [...Object.entries(P).map(([k, v]) => h('option', { value: k, selected: item.type === k }, v.name)),
        h('option', { value: 'custom', selected: item.type === 'custom' }, 'Custom link (Google icon)')]);
      sel.addEventListener('change', () => { item.type = sel.value; markDirty(doc); draw(); });
      const hint = item.type === 'email' ? 'Leave empty to use the Email above.' : item.type === 'instagram' ? 'Link or @username.' : 'Full link, e.g. https://…';
      const url = h('input', { value: item.url || '', placeholder: item.type === 'email' ? contact.email || 'you@example.com' : 'https://' });
      url.addEventListener('input', () => { item.url = url.value; markDirty(doc); });
      const parts = [
        h('label', { class: 'field' }, h('span', {}, 'Platform'), h('div', { class: 'soc-sel' }, preview(item), sel)),
        h('label', { class: 'field' }, h('span', {}, item.type === 'email' ? 'Email (optional)' : 'Link'), url, h('small', {}, hint)),
      ];
      if (item.type === 'custom') {
        const label = h('input', { value: item.label || '', placeholder: 'e.g. Portfolio PDF' });
        label.addEventListener('input', () => { item.label = label.value; markDirty(doc); });
        const icon = h('input', { value: item.icon || '', placeholder: 'e.g. language, palette, photo_camera' });
        const prev = h('span', { class: 'material-symbols-rounded soc-prev big' }, (item.icon || 'link').trim().toLowerCase());
        icon.addEventListener('input', () => { item.icon = icon.value.trim().toLowerCase().replace(/\s+/g, '_'); prev.textContent = item.icon || 'link'; markDirty(doc); });
        parts.push(
          h('label', { class: 'field' }, h('span', {}, 'Name (tooltip)'), label),
          h('label', { class: 'field' }, h('span', {}, 'Google icon name'), h('div', { class: 'soc-sel' }, prev, icon),
            h('small', {}, 'Pick an icon at ', h('a', { href: 'https://fonts.google.com/icons?icon.style=Rounded', target: '_blank', rel: 'noopener' }, 'Google Fonts › Icons ↗'), ', then copy its name here.')));
        // Or any SVG: cleaned (shapes only) and coloured to match; it replaces the Google icon when filled.
        const svgPrev = h('span', { class: 'soc-prev big' });
        const svgNote = h('small', {}, 'Optional. Paste <svg>…</svg> code; it replaces the Google icon. Colours become the icon colour.');
        const showSvg = () => {
          const clean = item.svg ? window.cleanSvg(item.svg) : '';
          svgPrev.innerHTML = clean;
          svgPrev.hidden = !clean;
          prev.style.opacity = clean ? '.3' : '';
          if (item.svg && !clean) svgNote.textContent = 'That code has no usable SVG shapes.';
          else svgNote.textContent = 'Optional. Paste <svg>…</svg> code; it replaces the Google icon. Colours become the icon colour.';
        };
        const svgInput = h('textarea', { rows: 3, value: item.svg || '', placeholder: '<svg viewBox="0 0 24 24">…</svg>', spellcheck: 'false' });
        svgInput.addEventListener('input', () => { item.svg = svgInput.value.trim(); markDirty(doc); showSvg(); });
        parts.push(h('label', { class: 'field soc-svg' }, h('span', {}, 'Or SVG code'), h('div', { class: 'soc-sel' }, svgPrev, svgInput), svgNote));
        showSvg();
      }
      wrap.replaceChildren(...parts);
    };
    draw();
    return wrap;
  };
  return h('div', { class: 'sub' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Social media'), h('p', { class: 'where' }, 'Round icons at the bottom of the page. The name pops up on hover in the platform colour.')),
    listEditor(contact.socials, doc, [{ render: platform }], { type: 'instagram', url: '' }, 'Social link'));
}

// The full Material Symbols font (admin only), so any icon name shows while typing.
function ensureSymbolsFont() {
  if (document.getElementById('material-symbols')) return;
  document.head.append(h('link', { id: 'material-symbols', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0&display=block' }));
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
/* ---------- Colours & theme (site.theme) ---------- */
// The site's accent colour for each theme, and the theme a first-time visitor sees. index.html applies them
// before the first paint; a visitor's own light/dark choice still wins.
const THEME_DEFAULT = { mode: 'dark', dark: '#b7a0ff', light: '#7250aa' };
const PRESETS = [
  ['Purple', '#b7a0ff', '#7250aa'], ['Blue', '#8dbaff', '#2f5fb3'], ['Green', '#7fd6a8', '#1f7a4d'],
  ['Pink', '#f4a1ba', '#b0386a'], ['Orange', '#f0b37e', '#a8521a'], ['Teal', '#6fd6d0', '#1b6f6b'],
];
const HEX = /^#[0-9a-f]{6}$/i;
function contrast(a, b) {
  const lum = hex => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function colorsCard(s, d) {
  s.theme = { ...THEME_DEFAULT, ...(s.theme || {}) };
  const t = s.theme;
  const body = h('div', { class: 'colors' });
  const set = changes => { Object.assign(t, changes); markDirty(d); applyAdminColors(t); draw(); };
  // One colour: picker + hex box + a warning when buttons and links would be hard to read.
  const colorField = (key, label, bg, bgName) => {
    const ok = HEX.test(t[key]) && contrast(t[key], bg) >= 4.5;
    const picker = h('input', { type: 'color', value: HEX.test(t[key]) ? t[key] : THEME_DEFAULT[key], 'aria-label': `${label} (picker)` });
    const text = h('input', { type: 'text', value: t[key], maxlength: 7, spellcheck: 'false', 'aria-label': label });
    picker.addEventListener('change', () => set({ [key]: picker.value }));
    text.addEventListener('change', () => {
      const v = text.value.trim().replace(/^([0-9a-f]{6})$/i, '#$1').toLowerCase();
      if (HEX.test(v)) set({ [key]: v });
      else { toast('Use a colour like #b7a0ff.', true); text.value = t[key]; }
    });
    return h('div', { class: 'field' }, h('span', {}, label),
      h('div', { class: 'color-row' }, picker, text),
      h('small', { class: ok ? '' : 'warn' }, ok ? `Easy to read on ${bgName}.` : `Hard to read on ${bgName}: pick a ${key === 'dark' ? 'lighter' : 'darker'} colour.`));
  };
  const preview = (mode, accent) => h('div', { class: `color-preview ${mode}`, style: `--a:${accent}` },
    h('span', { class: 'cp-btn' }, 'Resume'), h('span', { class: 'cp-link' }, 'See More'), h('span', { class: 'cp-dot' }));
  function draw() {
    body.replaceChildren(
      h('div', { class: 'presets', role: 'group', 'aria-label': 'Ready-made colours' }, PRESETS.map(([name, dark, light]) =>
        h('button', { type: 'button', class: 'preset', 'aria-pressed': String(t.dark === dark && t.light === light), onclick: () => set({ dark, light }) },
          h('i', { style: `background:linear-gradient(135deg,${dark} 50%,${light} 50%)` }), name))),
      h('div', { class: 'grid2' },
        h('div', {}, colorField('dark', 'Accent in the dark theme', '#000000', 'the black background'), preview('dark', t.dark)),
        h('div', {}, colorField('light', 'Accent in the light theme', '#ffffff', 'white'), preview('light', t.light))),
      h('div', { class: 'field' }, h('span', {}, 'Theme a first-time visitor sees'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Default theme' }, [['dark', 'Dark'], ['light', 'Light']].map(([k, label]) =>
          h('button', { type: 'button', 'aria-pressed': String(t.mode === k), onclick: () => { if (t.mode !== k) set({ mode: k }); } }, label))),
        h('small', {}, 'Visitors who switch the theme themselves keep their choice.')),
      h('div', {}, h('button', { class: 'btn small ghost', type: 'button', onclick: () => set({ ...THEME_DEFAULT }) }, ico('refresh'), 'Back to the original colours')));
  }
  draw();
  return card('Colours & theme', 'The accent colour of buttons, links and highlights, and the theme new visitors see first.', body);
}

function renderText() {
  const s = state.docs.site;
  const d = 'site';
  const levelSelect = item => {
    const sel = h('select', {}, [1, 2, 3].map(n => h('option', { value: n, selected: Number(item.level) === n }, ['', 'Basic', 'Intermediate', 'Advanced'][n])));
    sel.addEventListener('change', () => { item.level = Number(sel.value); markDirty(d); });
    return h('label', { class: 'field' }, h('span', {}, 'Level'), sel);
  };
  const cards = [
    colorsCard(s, d),
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
      field(s.about, 'title', 'Section title', d),
      aboutPhotoField(s.about, d),
      backdropField(s.about, d),
      h('div', { class: 'grid3' }, field(s.about, 'hello', 'Highlighted greeting', d), field(s.about, 'name', 'Big name', d), field(s.about, 'word', 'Big word behind the photo', d)),
      field(s.about, 'availability', 'Green online pill (Currently…)', d),
      field(s.about, 'body', 'Paragraph', d, { multi: true, rows: 4 }),
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
      field(s.contact, 'email', 'Email', d, { type: 'email', hint: 'Used by the Email icon and the chatbox.' }),
      socialsEditor(s.contact, d),
      h('div', { class: 'grid2' }, field(s.footer, 'tagline', 'Footer: tagline', d), field(s.footer, 'copyright', 'Footer: copyright', d)),
      field(s.footer, 'privacy', 'Footer: privacy note', d, { multi: true, rows: 2, hint: 'Tells visitors that their visits and chat questions are recorded. Leave it empty to hide it.' })),
    card('Resume', 'The Resume preview window.',
      h('div', { class: 'grid3' }, field(s.resume, 'dialogTitle', 'Window title', d), field(s.resume, 'download', 'Download button', d), field(s.resume, 'pdfName', 'PDF file name', d))),
    card('Google & browser tab', 'What shows in the browser tab and Google search.',
      faviconField(s.meta, d),
      field(s.meta, 'title', 'Tab title', d),
      field(s.meta, 'description', 'Google description', d, { multi: true, rows: 2, hint: 'Best under 160 characters.' })),
  ];
  return [jumpNav(cards), ...cards];
}

/* ---------- Tab: Projects (folders) ---------- */
// Each item of the "portfolio" row is one folder card in Projects; its sections are its collections.

// Folder icons: the same set as FILTER_ICONS in ../app.js, so the preview matches the site.
const FOLDER_ICONS = {
  'logo-folio': '<circle cx="12" cy="12" r="9"/><path d="m12 7 1.5 3.2 3.5.5-2.5 2.4.6 3.4L12 15l-3.1 1.5.6-3.4L7 10.7l3.5-.5Z"/>',
  'brand-design': '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle cx="8" cy="8" r="1.5"/>',
  'social-media': '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  'digital-art': '<path d="M12 19l7-7 3 3-7 7Z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18Z"/><circle cx="11" cy="11" r="2"/>',
  'print-media': '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6Z"/>',
  'ui-ux': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  others: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>',
};
const folderIconSvg = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FOLDER_ICONS[key] || FOLDER_ICONS.others}</svg>`;
const iconOf = p => (FOLDER_ICONS[p.icon] ? p.icon : FOLDER_ICONS[p.id] ? p.id : 'others');
const accentOf = p => p.accent || THEMES[p.id]?.accent || '#c9c4d6';
const labelOf = p => p.label ?? THEMES[p.id]?.label ?? '';
const visualsOf = p => p.sections.reduce((n, s) => n + s.images.length, 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const nameTaken = (list, name, except) => !!norm(name) && list.some(p => p !== except && norm(p.title) === norm(name));
const LIGHT_ART_TIP = 'Tick for white or very light artwork. The site shows it on a dark background so it stays visible.';
const OPEN_HINT = window.matchMedia('(hover: hover)').matches ? 'Hover it to open.' : 'Tap it to open.';
// Cache version of this file (deploy.sh sets it), passed on so the preview loads the matching style.css.
const ASSET_V = new URL(import.meta.url).searchParams.get('v') || '';

function uniqueId(list, name) {
  const base = slug(name);
  let id = base;
  for (let n = 2; list.some(p => p.id === id); n++) id = `${base}-${n}`;
  return id;
}

// A colour no other folder uses yet.
function freeAccent(list) {
  const used = new Set(list.map(p => accentOf(p).toLowerCase()));
  return SWATCHES.find(c => !used.has(c)) || SWATCHES[list.length % SWATCHES.length];
}

// New folders go before a last "Others" folder, else at the end.
const newFolderIndex = list => (list.length && list[list.length - 1].id === 'others' ? list.length - 1 : list.length);

// Guesses from the folder name. First match wins; the order keeps "poster" from reading as a social "post".
const ICON_GUESS = [
  ['logo-folio', /logo|identit|emblem|monogram|wordmark/],
  ['ui-ux', /\bui\b|\bux\b|interface|\bapps?\b|web|dashboard|wireframe|prototype|mobile/],
  ['print-media', /print|poster|flyer|leaflet|banner|bunting|brochure|booklet|magazine|editorial|signage|merch/],
  ['social-media', /social|instagram|tiktok|facebook|\bposts?\b|feed|stor(y|ies)|carousel|campaign/],
  ['brand-design', /brand|packag|label|food|menu|product/],
  ['digital-art', /\bart\b|artwork|illustrat|drawing|paint|character|sketch|comic|digital/],
];
const guessIcon = name => (ICON_GUESS.find(([, re]) => re.test(name.toLowerCase())) || ['others'])[0];
const LABEL_GUESS = [
  [/poster/, 'Poster'], [/flyer|leaflet/, 'Flyer'], [/banner|bunting/, 'Banner'], [/brochure|booklet|magazine|editorial/, 'Editorial'],
  [/identit/, 'Identity system'], [/logo|wordmark|monogram/, 'Logo'], [/packag/, 'Packaging'], [/brand/, 'Branding'],
  [/campaign/, 'Campaign'], [/social|instagram|tiktok|facebook|carousel/, 'Social media'],
  [/\bui\b|\bux\b|interface|dashboard|wireframe/, 'Interface'], [/web/, 'Website'], [/\bapps?\b|mobile/, 'App'],
  [/character/, 'Character'], [/illustrat|drawing|paint/, 'Illustration'], [/comic/, 'Comic'],
  [/video|motion|animation/, 'Motion'], [/photo/, 'Photography'], [/\b3d\b/, '3D'], [/print/, 'Print'],
];
function guessLabel(name) {
  const hit = LABEL_GUESS.find(([re]) => re.test(name.toLowerCase()));
  if (hit) return hit[1];
  return name.replace(/\b(designs?|projects?|works?|collections?|folio|portfolio)\b|&/gi, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
}

/* Reading dropped images and Finder folders */
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|tiff?)$/i;
const isImageFile = f => !f.name.startsWith('.') && !/svg/.test(f.type) && (f.type.startsWith('image/') || IMAGE_EXT.test(f.name));
const VIDEO_EXT = /\.(mp4|m4v|webm|mov)$/i;
const isVideoFile = f => !f.name.startsWith('.') && (/^video\/(mp4|webm|quicktime)$/.test(f.type) || VIDEO_EXT.test(f.name));
const isMediaFile = f => isImageFile(f) || isVideoFile(f);
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
const allFiles = dir => [...dir.files, ...dir.dirs.flatMap(allFiles)];
const skipName = name => name.startsWith('.') || name === '__MACOSX';

// The entries of a drop must be taken during the drop event itself; reading them can wait.
function dropEntries(dt) {
  const entries = [...(dt.items || [])].filter(i => i.kind === 'file').map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  return entries.length && entries.every(Boolean) ? entries : null;
}
const entryFile = entry => new Promise((res, rej) => entry.file(res, rej));
async function readDir(dirEntry, keep = isImageFile) {
  const reader = dirEntry.createReader();
  const entries = [];
  for (;;) { // readEntries answers in batches until it returns an empty one
    const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    entries.push(...batch);
  }
  return readTree(entries, dirEntry.name, keep);
}
// A drop as a small tree of images, sorted like Finder: { name, files, dirs: [{ name, files, dirs }] }.
async function readTree(entries, name = '', keep = isImageFile) {
  const node = { name, files: [], dirs: [] };
  for (const e of entries) {
    if (skipName(e.name)) continue;
    if (e.isDirectory) node.dirs.push(await readDir(e, keep));
    else if (e.isFile) {
      const f = await entryFile(e).catch(() => null);
      if (f && keep(f)) node.files.push(f);
    }
  }
  node.files.sort(byName);
  node.dirs.sort(byName);
  return node;
}
const readDrop = (entries, files, keep = isImageFile) => (entries ? readTree(entries, '', keep) : Promise.resolve({ name: '', files: files.filter(keep).sort(byName), dirs: [] }));

// <input webkitdirectory> gives a flat list with paths like "Folder/Sub folder/image.png".
function treeFromPicked(fileList) {
  const top = { name: '', files: [], dirs: [] };
  [...fileList].forEach(f => {
    const parts = (f.webkitRelativePath || f.name).split('/');
    if (!isImageFile(f) || parts.some(skipName)) return;
    top.name = top.name || (parts.length > 1 ? parts[0] : '');
    if (parts.length <= 2) { top.files.push(f); return; }
    let sub = top.dirs.find(x => x.name === parts[1]);
    if (!sub) top.dirs.push(sub = { name: parts[1], files: [], dirs: [] });
    sub.files.push(f);
  });
  top.files.sort(byName);
  top.dirs.sort(byName).forEach(x => x.files.sort(byName));
  return top.name ? { name: '', files: [], dirs: [top] } : top;
}

// Reads an image once: its size, a small preview and two hints for the gallery on the site.
// opaque: no see-through pixels, so it fills its frame. dark: mostly white or light artwork on a
// transparent background, which the site puts on a dark stage (.dark-art) so it stays visible.
async function analyseImage(file, { preview = true } = {}) {
  const bmp = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const hgt = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = hgt;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, hgt);
    const px = ctx.getImageData(0, 0, w, hgt).data;
    let clear = 0, seen = 0, light = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 250) clear++;
      if (px[i + 3] > 40) {
        seen++;
        if (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] > 204) light++;
      }
    }
    const opaque = clear / (w * hgt) < 0.02;
    const out = { width: bmp.width, height: bmp.height, opaque, dark: !opaque && seen > 0 && light / seen > 0.75 };
    if (preview) out.preview = URL.createObjectURL(await new Promise(res => canvas.toBlob(res, 'image/webp', 0.82)) || file);
    return out;
  } finally {
    bmp.close();
  }
}

// Files and Finder folders dropped on el (the highlight goes on mark).
function wireDrop(el, onDrop, mark = el) {
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    mark.classList.add('over');
  }));
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) mark.classList.remove('over'); });
  el.addEventListener('drop', e => {
    mark.classList.remove('over');
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    onDrop(dropEntries(e.dataTransfer), [...e.dataTransfer.files]);
  });
}

/* Pickers shared by the wizard and the folder editor */
function swatchPicker(get, set) {
  const row = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Colour' });
  const draw = () => {
    const now = (get() || '').toLowerCase();
    const custom = !SWATCHES.includes(now);
    row.replaceChildren(
      ...SWATCHES.map(c => h('button', { type: 'button', role: 'radio', 'aria-checked': String(now === c), class: `swatch-btn${now === c ? ' on' : ''}`,
        style: `background:${c}`, title: c, 'aria-label': `Colour ${c}`, onclick: () => { set(c); draw(); } })),
      h('label', { class: `swatch-custom${custom ? ' on' : ''}`, title: 'Other colour', style: custom ? `background:${now}` : null },
        h('input', { type: 'color', value: /^#[0-9a-f]{6}$/.test(now) ? now : '#b8a0ff', 'aria-label': 'Other colour',
          oninput: e => { set(e.target.value); e.target.parentElement.style.background = e.target.value; }, onchange: draw }),
        custom ? '' : '+'));
  };
  draw();
  return { el: row, draw };
}

function iconPicker(get, set) {
  const row = h('div', { class: 'icon-pick', role: 'radiogroup', 'aria-label': 'Icon' });
  const draw = () => row.replaceChildren(...Object.entries(ICON_NAMES).map(([key, name]) => {
    const on = get() === key;
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: `icon-opt${on ? ' on' : ''}`, title: name, 'aria-label': name,
      onclick: () => { set(key); draw(); } });
    b.innerHTML = folderIconSvg(key);
    return b;
  }));
  draw();
  return { el: row, draw };
}

function switchField(label, checked, onChange) {
  const hint = h('small');
  const input = h('input', { type: 'checkbox', role: 'switch', checked, onchange: () => onChange(input.checked) });
  const el = h('label', { class: 'switch-field' }, input, h('span', { class: 'switch', 'aria-hidden': 'true' }),
    h('span', { class: 'switch-text' }, h('b', {}, label), hint));
  return { el, input, setHint: text => { hint.textContent = text; } };
}

// The folder card exactly as the site draws it: folder-preview.html loads the site's own style.css.
function folderPreview() {
  const query = new URLSearchParams({ theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark' });
  if (ASSET_V) query.set('v', ASSET_V);
  const frame = h('iframe', { class: 'fd-preview', title: 'Preview of the folder card', src: `folder-preview.html?${query}` });
  let data = null;
  const push = () => {
    const win = frame.contentWindow;
    if (data && win && typeof win.renderFolder === 'function') win.renderFolder({ ...data, theme: document.documentElement.dataset.theme });
  };
  frame.addEventListener('load', () => {
    frame.contentWindow.onFolderSize = px => { frame.style.height = `${px}px`; };
    push();
  });
  // Follow the admin's light/dark switch while the frame is on the page.
  const watch = new MutationObserver(() => (frame.isConnected ? push() : watch.disconnect()));
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return {
    el: frame,
    update(p, collections, visuals) {
      data = { title: (p.title || '').trim() || 'Folder name', label: labelOf(p), desc: p.desc || '', color: accentOf(p),
        icon: folderIconSvg(iconOf(p)), collections, visuals };
      push();
    },
  };
}

/* New folder: one dialog with three short steps and a live preview. Nothing is uploaded until
   "Create & publish", so closing it leaves no stray files in Storage. */
function openFolderWizard() {
  const list = state.docs.portfolio;
  const d = 'portfolio';
  const f = { title: '', label: '', desc: '', accent: freeAccent(list), icon: 'others', hidden: false };
  const touched = { label: false, icon: false };
  // own: receives loose images. auto: named after the folder until renamed.
  const cols = []; // { title, own, auto, items: [{ file, name, size, width, height, opaque, dark, preview }] }
  let busy = false;
  let queue = Promise.resolve();

  const preview = folderPreview();
  const filled = () => cols.filter(c => c.items.length);
  const imageCount = () => cols.reduce((n, c) => n + c.items.length, 0);
  const hasContent = () => !!(f.title.trim() || imageCount());

  /* ① Details */
  const nameInput = h('input', { class: 'name-input', placeholder: 'e.g. Poster Design', autocomplete: 'off', maxlength: '60' });
  const nameWarn = h('p', { class: 'warn', role: 'status', hidden: true });
  const labelInput = h('input', { placeholder: 'Shown small, above the name' });
  const descInput = h('textarea', { rows: 2, placeholder: 'One or two lines about this work (optional)' });
  const colours = swatchPicker(() => f.accent, c => { f.accent = c; refresh(); });
  const icons = iconPicker(() => f.icon, k => { f.icon = k; touched.icon = true; refresh(); });

  function setName(value, typed = false) {
    f.title = value;
    if (!typed) nameInput.value = value;
    if (!touched.label) labelInput.value = f.label = guessLabel(value.trim());
    if (!touched.icon) { f.icon = guessIcon(value); icons.draw(); }
    cols.forEach(c => {
      if (!c.auto) return;
      c.title = value.trim();
      if (c.input) c.input.value = c.title;
    });
    const taken = nameTaken(list, value);
    nameWarn.hidden = !taken;
    if (taken) nameWarn.replaceChildren(ico('alert'), h('span', {}, `A folder called “${value.trim()}” already exists. You can still create this one.`));
    refresh();
  }
  nameInput.addEventListener('input', () => setName(nameInput.value, true));
  labelInput.addEventListener('input', () => { f.label = labelInput.value; touched.label = true; refresh(); });
  descInput.addEventListener('input', () => { f.desc = descInput.value; refresh(); });

  /* ② Images */
  const zoneText = h('b', {}, 'Drop images or a whole folder here');
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true });
  const dirInput = h('input', { type: 'file', multiple: true });
  dirInput.webkitdirectory = true;
  fileInput.addEventListener('change', () => { add({ name: '', files: [...fileInput.files].filter(isImageFile).sort(byName), dirs: [] }); fileInput.value = ''; });
  dirInput.addEventListener('change', () => { add(treeFromPicked(dirInput.files)); dirInput.value = ''; });
  const zone = h('div', { class: 'drop wz-drop' },
    ico('upload'), zoneText,
    h('small', {}, 'A folder from Finder works best: each sub-folder becomes a collection.'),
    h('span', { class: 'drop-actions' },
      h('button', { type: 'button', class: 'btn small', onclick: () => fileInput.click() }, ico('image'), 'Choose images'),
      h('button', { type: 'button', class: 'btn small', onclick: () => dirInput.click() }, ico('folder'), 'Choose a folder')));
  zone.addEventListener('click', e => { if (!e.target.closest('button')) fileInput.click(); });
  const colsBox = h('div', { class: 'wz-cols' });
  const addColBtn = addBtn('Add a collection', () => {
    cols.push({ title: `Collection ${cols.length + 1}`, own: false, auto: false, items: [] });
    drawCols();
    refresh();
    colsBox.lastElementChild?.querySelector('input')?.select();
  });

  const ownCollection = () => cols.find(c => c.own)
    || (cols.unshift({ title: f.title.trim(), own: true, auto: true, items: [] }), cols[0]);
  const namedCollection = name => cols.find(c => !c.own && norm(c.title) === norm(name))
    || (cols.push({ title: name, own: false, auto: false, items: [] }), cols[cols.length - 1]);

  // Loose images go to the folder's own collection; each sub-folder becomes a collection.
  function add(tree) {
    let groups;
    if (!tree.files.length && tree.dirs.length === 1) { // one folder dropped: it is the new folder
      const top = tree.dirs[0];
      if (!f.title.trim() && top.name) setName(top.name);
      groups = [[null, top.files], ...top.dirs.map(x => [x.name, allFiles(x)])];
    } else {
      groups = [[null, tree.files], ...tree.dirs.map(x => [x.name, allFiles(x)])];
    }
    return ingest(groups);
  }
  // Each group: [target, files]. target null = the folder's own collection, a string = the
  // collection with that name (made if new), or a collection object.
  function ingest(groups) {
    queue = queue.catch(() => {}).then(async () => {
      const total = groups.reduce((n, [, files]) => n + files.length, 0);
      if (!total) { toast('No images found there. Use JPG, PNG, WebP or GIF files.', true); return; }
      zone.classList.add('busy');
      const failed = [];
      let n = 0;
      for (const [target, files] of groups) {
        if (!files.length) continue;
        const col = target === null ? ownCollection() : typeof target === 'string' ? namedCollection(target) : target;
        for (const file of files) {
          zoneText.textContent = `Reading ${++n} of ${total}…`;
          if (col.items.some(it => it.name === file.name && it.size === file.size)) continue; // the same file twice
          try { col.items.push({ file, name: file.name, size: file.size, ...(await analyseImage(file)) }); }
          catch (_) { failed.push(file.name); }
          if (n % 12 === 0) drawCols();
        }
      }
      zone.classList.remove('busy');
      zoneText.textContent = 'Drop more images or folders here';
      if (failed.length) toast(`Could not read ${failed.length === 1 ? failed[0] : plural(failed.length, 'file')}. Use JPG, PNG, WebP or GIF.`, true);
      drawCols();
      refresh();
    });
    return queue;
  }

  function drawCols() {
    colsBox.replaceChildren(...cols.map((c, ci) => {
      const name = h('input', { value: c.title, placeholder: f.title.trim() || 'Collection name', 'aria-label': 'Collection name' });
      name.addEventListener('input', () => { c.title = name.value; c.auto = false; });
      c.input = name;
      const more = h('input', { type: 'file', accept: 'image/*', multiple: true });
      more.addEventListener('change', () => { ingest([[c, [...more.files].filter(isImageFile).sort(byName)]]); more.value = ''; });
      return h('section', { class: 'wz-col' },
        h('div', { class: 'wz-col-head' },
          ico('folder'), name,
          h('span', { class: 'count' }, plural(c.items.length, 'image')),
          iconBtn('plus', 'Add images to this collection', () => more.click()),
          iconBtn('trash', 'Remove this collection', () => {
            c.items.forEach(it => URL.revokeObjectURL(it.preview));
            cols.splice(ci, 1);
            drawCols();
            refresh();
          }, { danger: true }),
          more),
        c.items.length
          ? h('div', { class: 'wz-thumbs' }, c.items.map((it, ii) => {
            const dark = h('input', { type: 'checkbox', checked: it.dark });
            const frame = h('div', { class: `thumb-img${it.dark ? ' on-dark' : ''}` },
              h('img', { src: it.preview, alt: '', draggable: 'false' }),
              h('button', { type: 'button', class: 'wz-x', title: 'Remove image', 'aria-label': `Remove ${it.name}`, onclick: () => {
                URL.revokeObjectURL(it.preview);
                c.items.splice(ii, 1);
                drawCols();
                refresh();
              } }, ico('close')));
            dark.addEventListener('change', () => { it.dark = dark.checked; frame.classList.toggle('on-dark', it.dark); });
            return h('figure', { class: 'wz-thumb', title: it.name }, frame, h('label', { class: 'check', title: LIGHT_ART_TIP }, dark, 'Light art'));
          }))
          : h('p', { class: 'empty' }, 'Empty. Use + to add images.'));
    }));
  }

  /* ③ Publish */
  const show = switchField('Show on the site now', true, on => { f.hidden = !on; refresh(); });
  const summaryLine = h('p', { class: 'wz-summary' });
  const otherChanges = state.dirty.has(d) ? h('p', { class: 'muted note' }, 'Your other unsaved Projects changes are saved at the same time.') : null;

  const statusText = h('span', {}, 'Only the name is needed. Everything else is filled in for you.');
  const fill = h('span');
  const progress = h('div', { class: 'wz-progress', role: 'progressbar', 'aria-label': 'Upload progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', hidden: true }, fill);
  const cancelBtn = h('button', { type: 'button', class: 'btn ghost', onclick: () => tryClose() }, 'Cancel');
  const createLabel = h('span', {}, 'Create & publish');
  const createBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => publish() }, ico('check'), createLabel);

  function refresh() {
    const n = imageCount();
    preview.update(f, filled().length, n);
    summaryLine.replaceChildren(h('b', {}, f.title.trim() || 'New folder'), ` · ${plural(filled().length, 'collection')} · ${plural(n, 'image')}`);
    show.setHint(f.hidden ? 'Saved as a hidden draft. Show it later from the folder settings.' : 'Visitors see it in Projects as soon as it is created.');
    createLabel.textContent = f.hidden ? 'Create hidden draft' : 'Create & publish';
    createBtn.disabled = busy || !f.title.trim();
  }

  const step = (n, title, text, ...body) => h('section', { class: 'wz-step' },
    h('h3', {}, h('span', { class: 'wz-num' }, String(n)), title), text ? h('p', { class: 'muted step-text' }, text) : null, ...body);
  const dlg = h('dialog', { class: 'wizard', 'aria-labelledby': 'wz-title' },
    h('header', { class: 'wz-head' },
      h('div', {}, h('p', { class: 'crumb' }, 'Projects'), h('h2', { id: 'wz-title' }, 'New folder')),
      iconBtn('close', 'Close', () => tryClose())),
    h('div', { class: 'wz-body' },
      h('div', { class: 'wz-form' },
        step(1, 'Details', 'Only the name is needed. The label, colour and icon are picked from it, and you can change any of them.',
          h('label', { class: 'field' }, h('span', {}, 'Folder name'), nameInput), nameWarn,
          h('label', { class: 'field' }, h('span', {}, 'Small label'), labelInput),
          h('div', { class: 'field' }, h('span', {}, 'Colour'), colours.el),
          h('div', { class: 'field' }, h('span', {}, 'Icon'), icons.el),
          h('label', { class: 'field' }, h('span', {}, 'Description'), descInput)),
        step(2, 'Images', '', zone, colsBox, addColBtn, fileInput, dirInput),
        step(3, 'Publish', '', show.el, summaryLine, otherChanges)),
      h('aside', { class: 'wz-aside' },
        h('p', { class: 'eyebrow' }, 'Live preview'),
        preview.el,
        h('p', { class: 'muted preview-note' }, `This is how the folder looks on the site. ${OPEN_HINT}`))),
    h('footer', { class: 'wz-foot' }, h('div', { class: 'wz-status' }, statusText, progress), cancelBtn, createBtn));
  wireDrop(dlg, (entries, files) => readDrop(entries, files).then(add).catch(err => toast(err.message, true)), zone);

  async function tryClose() {
    if (busy) return;
    if (hasContent() && !await ask({ title: 'Discard this new folder?', text: 'Nothing has been uploaded yet, so nothing changes on the site.', ok: 'Discard', danger: true })) return;
    finish();
  }
  let closed = false;
  function finish() {
    if (closed) return;
    closed = true;
    cols.forEach(c => c.items.forEach(it => URL.revokeObjectURL(it.preview)));
    state.wizard = null;
    document.body.append($('#toast'));
    if (dlg.open) dlg.close();
    dlg.remove();
  }
  dlg.addEventListener('cancel', e => { e.preventDefault(); tryClose(); });
  dlg.addEventListener('close', () => { if (!busy) finish(); });

  async function publish() {
    const title = f.title.trim();
    if (!title || busy) { nameInput.focus(); return; }
    busy = true;
    dlg.classList.add('is-busy');
    cancelBtn.disabled = true;
    refresh();
    statusText.textContent = 'Getting the images ready…';
    await queue.catch(() => {});
    const id = uniqueId(list, title);
    const folder = { id, category: id, title, label: f.label.trim(), desc: f.desc.trim(), accent: f.accent, icon: f.icon, sections: [] };
    if (f.hidden) folder.hidden = true;
    const total = imageCount();
    const failed = [];
    let n = 0;
    progress.hidden = !total;
    for (const c of filled()) {
      const name = c.title.trim() || title;
      const section = { title: name, images: [] };
      for (const it of c.items) {
        statusText.textContent = `Uploading ${++n} of ${total}…`;
        try {
          const a = await uploadImage(it.file, `${id}/${slug(name)}`, `${name} — visual ${section.images.length + 1}`);
          a.dark = !!it.dark;
          a.opaque = !!it.opaque;
          section.images.push(a);
        } catch (err) {
          failed.push(it.name);
          console.warn(`Upload failed: ${it.name}`, err);
        }
        const pct = Math.round((n / total) * 100);
        fill.style.width = `${pct}%`;
        progress.setAttribute('aria-valuenow', String(pct));
      }
      if (section.images.length) folder.sections.push(section);
    }
    if (total && failed.length === total) { // nothing went up: keep everything here to try again
      busy = false;
      dlg.classList.remove('is-busy');
      cancelBtn.disabled = false;
      progress.hidden = true;
      statusText.textContent = 'No image could be uploaded. Check the connection and try again.';
      refresh();
      toast('Upload failed. Nothing was created.', true);
      return;
    }
    list.splice(newFolderIndex(list), 0, folder);
    state.cat = list.indexOf(folder);
    markDirty(d);
    let saveError = null;
    if (!DEMO) {
      statusText.textContent = 'Saving…';
      try { await saveDocs([d]); } catch (err) { saveError = err; }
      updateSavebar();
    }
    busy = false;
    finish();
    showTab('projects');
    if (DEMO) toast('Demo mode: the folder was added on this page only. Nothing was saved.');
    else if (saveError) toast(`The images are uploaded, but saving failed: ${saveError.message} Click Save to try again.`, true);
    else if (failed.length) toast(`Folder created, but ${plural(failed.length, 'image')} could not be uploaded.`, true);
    else toast(f.hidden ? 'Folder saved as a hidden draft.' : 'Folder created. It is on the site now.');
  }

  dlg.append($('#toast')); // toasts must show above the dialog
  state.wizard = { hasContent };
  document.body.append(dlg);
  dlg.showModal();
  drawCols();
  refresh();
  nameInput.focus();
}

/* Folder list and editor */
function renderProjects() {
  const list = state.docs.portfolio;
  const d = 'portfolio';
  state.cat = Math.min(state.cat, Math.max(0, list.length - 1));
  const rerender = () => showTab('projects');
  const select = i => { state.cat = i; rerender(); };

  const items = list.map((p, i) => h('div', { class: `cat-item${i === state.cat ? ' active' : ''}${p.hidden ? ' is-hidden' : ''}` },
    h('button', { class: 'cat-name', type: 'button', onclick: () => select(i) },
      h('i', { class: 'swatch', style: `background:${accentOf(p)}` }),
      h('span', {}, h('b', {}, p.title || '(untitled)'), h('small', {},
        h('span', { class: 'badge', title: 'Hidden draft: not shown on the site', hidden: !p.hidden }, 'Hidden'),
        `${plural(p.sections.length, 'collection')} · ${plural(visualsOf(p), 'image')}`))),
    moveBtns(list, i, d, select)));
  const side = h('aside', { class: 'cat-list' },
    h('button', { class: 'btn primary new-folder', type: 'button', onclick: openFolderWizard }, ico('plus'), 'New folder'),
    h('p', { class: 'eyebrow' }, plural(list.length, 'folder')),
    ...items);

  const p = list[state.cat];
  if (!p) return [h('div', { class: 'split' }, side, h('div', { class: 'card' }, h('p', { class: 'empty' }, 'No folders yet. Click “New folder” to start.')))];

  const preview = folderPreview();
  const refresh = () => preview.update(p, p.sections.length, visualsOf(p));
  const nameWarn = h('p', { class: 'warn', role: 'status', hidden: true });
  const checkName = () => {
    const taken = nameTaken(list, p.title, p);
    nameWarn.hidden = !taken;
    if (taken) nameWarn.replaceChildren(ico('alert'), h('span', {}, `Another folder is also called “${p.title.trim()}”. Visitors may mix them up.`));
  };
  const live = (el, fn) => { el.querySelector('input,textarea').addEventListener('input', fn); return el; };
  const colours = swatchPicker(() => accentOf(p), c => {
    p.accent = c;
    markDirty(d);
    refresh();
    items[state.cat].querySelector('.swatch').style.background = c;
  });
  const icons = iconPicker(() => iconOf(p), k => { p.icon = k; markDirty(d); refresh(); });
  const visible = switchField('Show on the site', !p.hidden, on => {
    if (on) delete p.hidden; else p.hidden = true;
    markDirty(d);
    visibleHint();
    items[state.cat].classList.toggle('is-hidden', !!p.hidden);
    items[state.cat].querySelector('.badge').hidden = !p.hidden;
  });
  const visibleHint = () => visible.setHint(p.hidden ? 'Hidden draft: not shown on the site. Save to apply.' : 'Shown in Projects on the site.');
  visibleHint();

  const duplicate = () => {
    const title = `${p.title || 'Folder'} copy`;
    const id = uniqueId(list, title);
    // Settings and empty collections only: shared images would be deleted from Storage with either copy.
    list.splice(state.cat + 1, 0, { id, category: id, title, label: labelOf(p), desc: p.desc || '', accent: accentOf(p), icon: iconOf(p), hidden: true,
      sections: p.sections.map(s => ({ title: s.title, images: [] })) });
    markDirty(d);
    select(state.cat + 1);
    toast('Copied as a hidden draft with empty collections. Add images, then show it on the site.');
  };
  const remove = async () => {
    const ok = await ask({ title: `Delete folder "${p.title}"?`, text: 'All collections and images in this folder will be removed.', ok: 'Delete folder', danger: true });
    if (!ok) return;
    await removeStored(p.sections.flatMap(s => s.images));
    list.splice(state.cat, 1);
    state.cat = Math.max(0, state.cat - 1);
    markDirty(d);
    rerender();
  };

  const editor = h('div', { class: 'cat-editor' },
    card(p.title || 'Folder', `Shows as a folder card in Projects. Link: #project/${p.id}`,
      h('div', { class: 'folder-grid' },
        h('div', { class: 'folder-fields' },
          live(field(p, 'title', 'Name', d), () => { checkName(); refresh(); }), nameWarn,
          live(field(p, 'label', 'Small label (top of card)', d), refresh),
          live(field(p, 'desc', 'Description', d, { multi: true, rows: 2 }), refresh),
          h('div', { class: 'field' }, h('span', {}, 'Colour'), colours.el),
          h('div', { class: 'field' }, h('span', {}, 'Icon'), icons.el),
          visible.el),
        h('div', { class: 'preview-box' }, preview.el, h('p', { class: 'muted preview-note' }, `Live preview. ${OPEN_HINT}`))),
      h('div', { class: 'card-foot' },
        h('button', { class: 'btn ghost', type: 'button', onclick: duplicate }, ico('copy'), 'Duplicate folder'),
        h('button', { class: 'btn ghost danger', type: 'button', onclick: remove }, ico('trash'), 'Delete folder'))),
    // "New collection" sits at the top, and the new collection is added first, right under it.
    h('div', { class: 'section-title coll-head' }, h('h2', {}, 'Collections'), h('span', { class: 'muted' }, plural(p.sections.length, 'collection')),
      addBtn('New collection', async () => {
        const name = await ask({ title: 'New collection', label: 'Collection name', ok: 'Create' });
        if (!name) return;
        const s = { title: name, images: [] };
        p.sections.unshift(s);
        openState.set(s, true);
        markDirty(d);
        rerender();
      })),
    ...p.sections.map((s, si) => collectionCard(p, s, si, rerender)),
    p.sections.length ? null : h('p', { class: 'empty card' }, 'No collections in this folder yet.'));
  checkName();
  refresh();
  return [h('div', { class: 'split' }, side, editor)];
}

const openState = new WeakMap(); // collection -> open or closed, kept across re-renders

function collectionCard(p, s, si, rerender) {
  const d = 'portfolio';
  const status = h('span', {}, 'Drag images, videos or a folder here, or ', h('u', {}, 'choose files'));
  const drop = h('label', { class: 'drop' },
    h('input', { type: 'file', accept: 'image/*,video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov', multiple: true, onchange: e => { addFiles([...e.target.files]); e.target.value = ''; } }),
    ico('upload'), status, h('small', {}, `JPG, PNG, WebP or GIF (resized to WebP). Videos: MP4, WebM or MOV up to ${VIDEO_MAX_MB} MB.`));
  wireDrop(drop, (entries, files) => readDrop(entries, files, isMediaFile).then(tree => addFiles(allFiles(tree))).catch(err => toast(err.message, true)));

  async function addFiles(files) {
    const imgs = files.filter(isMediaFile).sort(byName);
    if (!imgs.length) { toast('No images or videos found. Use JPG, PNG, WebP, GIF, MP4, WebM or MOV files.', true); return; }
    drop.classList.add('busy');
    let done = 0;
    for (const [n, f] of imgs.entries()) {
      status.textContent = `Uploading ${n + 1} of ${imgs.length}…`;
      try {
        const folder = `${p.id}/${slug(s.title)}`;
        const alt = `${s.title} — visual ${s.images.length + 1}`;
        let a;
        if (isVideoFile(f)) {
          a = await uploadVideo(f, folder, alt);
          a.opaque = true;
        } else {
          const info = await analyseImage(f, { preview: false });
          a = await uploadImage(f, folder, alt);
          a.dark = info.dark;
          a.opaque = info.opaque;
        }
        s.images.push(a);
        done++;
        markDirty(d);
      } catch (err) {
        toast(`Could not upload ${f.name}: ${err.message}`, true);
      }
    }
    if (done) toast(`${plural(done, 'file')} uploaded. Click Save to publish.`);
    openState.set(s, true);
    rerender();
  }

  // Thumbnails: drag one onto another to move it there (the arrows still work for keyboard and touch).
  let dragFrom = null;
  const thumbs = h('div', { class: 'thumbs' });
  const clearMarks = () => $$('.drop-target', thumbs).forEach(x => x.classList.remove('drop-target'));
  thumbs.append(...s.images.map((a, i) => {
    const dark = h('input', { type: 'checkbox', checked: !!a.dark });
    const alt = h('input', { value: a.alt || '', placeholder: 'Image description', title: 'Alt text (for screen readers)' });
    alt.addEventListener('input', () => { a.alt = alt.value; markDirty(d); });
    const frame = h('div', { class: `thumb-img${a.dark ? ' on-dark' : ''}`, draggable: 'true', title: 'Drag to reorder' },
      h('img', { src: asset(a.thumb || a.display || a.src), alt: '', loading: 'lazy', draggable: 'false' }),
      h('span', { class: 'thumb-num' }, String(i + 1)),
      a.video ? h('span', { class: 'thumb-video', title: 'Video' }, ico('play'), a.duration ? fmtDuration(a.duration) : 'Video') : null,
      h('div', { class: 'thumb-tools' },
        moveBtns(s.images, i, d, rerender),
        delBtn(async () => { await removeStored([a]); s.images.splice(i, 1); markDirty(d); rerender(); }, 'this image')));
    dark.addEventListener('change', () => { a.dark = dark.checked; frame.classList.toggle('on-dark', a.dark); markDirty(d); });
    const fig = h('figure', { class: 'thumb' }, frame, alt, h('label', { class: 'check', title: LIGHT_ART_TIP }, dark, 'Light artwork'));
    frame.addEventListener('dragstart', e => {
      dragFrom = i;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-portfolio-image', String(i));
      fig.classList.add('dragging');
    });
    frame.addEventListener('dragend', () => { dragFrom = null; fig.classList.remove('dragging'); clearMarks(); });
    fig.addEventListener('dragover', e => {
      if (dragFrom === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragFrom !== i) fig.classList.add('drop-target');
    });
    fig.addEventListener('dragleave', e => { if (!fig.contains(e.relatedTarget)) fig.classList.remove('drop-target'); });
    fig.addEventListener('drop', e => {
      if (dragFrom === null) return;
      e.preventDefault();
      const from = dragFrom;
      dragFrom = null;
      clearMarks();
      if (from === i) return;
      s.images.splice(i, 0, ...s.images.splice(from, 1));
      markDirty(d);
      rerender();
    });
    return fig;
  }));

  const heading = h('b', { class: 'coll-name' }, s.title || '(untitled)');
  // Pencil: rename in place. Enter or clicking away saves, Escape cancels.
  const rename = () => {
    const input = h('input', { class: 'coll-rename', value: s.title || '', 'aria-label': 'Collection name' });
    const stop = e => e.stopPropagation();
    let done = false;
    const finish = save => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (save && v && v !== s.title) { s.title = v; markDirty(d); }
      heading.textContent = s.title || '(untitled)';
      input.replaceWith(heading);
    };
    input.addEventListener('click', e => { e.preventDefault(); stop(e); });
    input.addEventListener('keydown', e => {
      stop(e);
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('keyup', e => { if (e.key === ' ') e.preventDefault(); stop(e); });
    input.addEventListener('blur', () => finish(true));
    heading.replaceWith(input);
    input.focus();
    input.select();
  };

  const wrap = h('details', { class: 'card collection', open: openState.has(s) ? openState.get(s) : s.images.length < 9 },
    h('summary', {},
      h('span', { class: 'chev', 'aria-hidden': 'true' }),
      heading,
      h('span', { class: 'count' }, plural(s.images.length, 'image')),
      h('span', { class: 'row-tools', onclick: e => e.preventDefault() },
        iconBtn('pencil', 'Rename collection', rename),
        moveBtns(p.sections, si, d, rerender),
        delBtn(async () => { await removeStored(s.images); p.sections.splice(si, 1); markDirty(d); rerender(); }, `collection "${s.title}"`))),
    h('div', { class: 'coll-body' }, s.images.length ? thumbs : null, drop));
  wrap.addEventListener('toggle', () => openState.set(s, wrap.open));
  return wrap;
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
  // Logo pickers for a row: one logo for light mode (logo) and an optional one for dark mode (logoDark).
  // Each preview sits on the background of its theme. Without a dark logo the site outlines the light one in white.
  const logoSlot = (item, key, label, folder, altKey, removable) => {
    const preview = h('img', { class: 'logo-preview', src: item[key] ? asset(item[key]) : undefined, alt: '', hidden: !item[key] });
    const empty = h('span', { class: 'logo-empty', hidden: Boolean(item[key]) }, 'No logo');
    const input = h('input', { type: 'file', accept: 'image/*' });
    const pick = h('label', { class: 'btn ghost small' }, ico('upload'), item[key] ? 'Change' : 'Upload', input);
    const show = on => { preview.hidden = !on; empty.hidden = on; if (remove) remove.hidden = !on; };
    const remove = removable ? h('button', { class: 'btn ghost small', type: 'button', hidden: !item[key], onclick: e => {
      e.preventDefault();
      delete item[key];
      if (key === 'logo') { delete item.logoW; delete item.logoH; }
      show(false);
      markDirty(d);
    } }, ico('trash'), 'Remove') : null;
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      try {
        const a = await uploadImage(f, folder, `${item[altKey] || 'Logo'}${key === 'logoDark' ? ' (dark mode)' : ''}`);
        item[key] = a.display;
        if (key === 'logo' || !item.logoW) { item.logoW = a.width; item.logoH = a.height; }
        preview.src = a.display;
        show(true);
        markDirty(d);
        toast('Logo uploaded. Click Save.');
      } catch (err) { toast(err.message, true); }
      input.value = '';
    });
    return h('div', { class: `field logo-field logo-${key === 'logoDark' ? 'dark' : 'light'}` }, h('span', {}, label),
      h('span', { class: 'logo-box' }, h('span', { class: 'logo-stage' }, preview, empty), pick, remove));
  };
  // The white outline in dark mode is a switch per item (default: on when there is no dark-mode logo).
  const logoPicker = (folder, altKey, removable) => item => {
    const outline = switchField('White outline in dark mode', item.logoOutline ?? !item.logoDark, on => { item.logoOutline = on; markDirty(d); });
    outline.setHint('A thin white edge so a dark logo stays visible on the dark theme.');
    return h('div', { class: 'logo-pair wide' },
      logoSlot(item, 'logo', 'Logo · light mode', folder, altKey, removable),
      logoSlot(item, 'logoDark', 'Logo · dark mode (optional)', folder, altKey, true),
      h('div', { class: 'logo-outline' }, outline.el));
  };
  const logoField = logoPicker('education', 'school', false);
  const expLogoField = logoPicker('experience', 'org', true);
  const awardLogoField = logoPicker('awards', 'org', true);
  const current = r.current || (r.current = { role: '', org: '', date: '', start: '', points: [] });
  return [
    card('Education', 'School cards with logos. Ordered oldest to newest.',
      listEditor(r.education, d, [
        { key: 'school', label: 'School' }, { key: 'award', label: 'Program' }, { key: 'cgpa', label: 'CGPA' },
        { key: 'date', label: 'Date' }, startField, { render: logoField }],
      { school: '', award: '', cgpa: '', date: '', start: '' }, 'School')),
    card('Current job', 'The newest item in the Experience timeline. Leave "Start" empty to hide it.',
      h('div', { class: 'grid2' }, field(current, 'role', 'Role', d), field(current, 'org', 'Organisation', d),
        field(current, 'date', 'Date', d), field(current, 'start', startField.label, d, { placeholder: '2026-09' }), expLogoField(current))),
    card('Work, curricular & leadership', 'The Experience timeline. Ordered by "Start" date. A logo shows above the title.',
      listEditor(r.experience, d, [
        { key: 'role', label: 'Role' }, { key: 'org', label: 'Organisation' }, { key: 'date', label: 'Date' }, startField, { render: expLogoField }, { render: pointsField }],
      { role: '', org: '', date: '', start: '', points: [] }, 'Experience')),
    card('Awards & certificates', 'The list under the Experience timeline, newest first.',
      listEditor(r.honors, d, [
        { key: 'title', label: 'Award' }, { key: 'org', label: 'Organiser' }, { key: 'date', label: 'Date' }, startField, { render: awardLogoField }, { render: pointsField }],
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

/* ---------- Tab: FAQ & chat ---------- */
// The chatbox on the site (../chat.js) matches a visitor's question to these first, then uses its
// built-in answers. Both live in the "site" row: site.faq and site.chat.
// Above them: the questions visitors asked (questions.js, loaded the first time the tab opens).
let questionsModule;
function questionsBox() {
  const root = h('div', { class: 'qs' }, h('div', { class: 'loading' }, loaderEl(), 'Loading questions…'));
  questionsModule = questionsModule || import(`./questions.js${ASSET_V ? `?v=${ASSET_V}` : ''}`);
  questionsModule
    .then(m => m.mountQuestions(root, { h, ico, ask, toast, sb, DEMO, inFaq, addToFaq }))
    .catch(err => {
      questionsModule = null; // try again next time the tab opens
      root.replaceChildren(h('p', { class: 'muted' }, `Questions could not load: ${err.message}`));
    });
  return root;
}
const faqKey = q => String(q || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const inFaq = question => (state.docs.site.faq || []).some(f => faqKey(f.q) === faqKey(question));
// A visitor's question becomes a new FAQ entry; the answer field gets the focus.
function addToFaq(question) {
  const s = state.docs.site;
  s.faq = s.faq || [];
  s.faq.push({ q: question, a: '', keywords: '' });
  markDirty('site');
  showTab('faq');
  const rows = $$('#card-questions-answers .list-row');
  const row = rows[rows.length - 1];
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const answer = row.querySelector('textarea');
  if (answer) answer.focus({ preventScroll: true });
  toast('Added to the FAQ. Write the answer, then save.');
}

function renderFaq() {
  const s = state.docs.site;
  const d = 'site';
  s.faq = s.faq || [];
  s.chat = s.chat || {};
  const defaults = (window.SITE && window.SITE.chat) || {};
  const chatField = (key, label, opts = {}) => field(s.chat, key, label, d, { placeholder: defaults[key] || '', ...opts });
  return [
    card('Questions visitors asked', 'What people typed in the chatbox. Give the ones without an answer an FAQ answer.', questionsBox()),
    card('Questions & answers', 'When a visitor asks something in the search box, the chatbox answers with these first.',
      h('p', { class: 'notice faq-note' }, ico('info'), h('span', {},
        'The first 4 questions show as quick buttons when the chat opens. Without an FAQ the chat already answers about ',
        h('b', {}, 'contact, resume, education, experience, awards, software, languages, location and projects'), '.')),
      listEditor(s.faq, d, [
        { key: 'q', label: 'Question', wide: true, placeholder: 'e.g. Are you available for freelance work?' },
        { key: 'a', label: 'Answer', wide: true, multi: true, rows: 3, hint: 'Write **words** for bold. Emails and links become clickable.' },
        { key: 'keywords', label: 'Other words people use', wide: true, placeholder: 'hire, freelance, available',
          hint: 'Optional. Comma-separated words a visitor might type instead, e.g. hire, freelance, available.' },
      ], { q: '', a: '', keywords: '' }, 'Question')),
    card('Chatbox text', 'The words around the chat window. An empty field uses the text shown in grey.',
      h('div', { class: 'grid2' }, chatField('title', 'Title'), chatField('subtitle', 'Line under the title')),
      chatField('greeting', 'First message', { multi: true, rows: 2 }),
      chatField('placeholder', 'Typing box text'),
      chatField('fallback', 'When there is no answer', { multi: true, rows: 2, hint: 'Shown with the quick buttons and your email.' })),
  ];
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

/* ---------- Tab: Insights ---------- */
// Who visits the site (table "visits", see supabase/insights.sql). The tab lives in insights.js,
// loaded the first time it opens.
let insightsModule;
function renderInsights() {
  const root = h('div', { class: 'ins' }, h('div', { class: 'loading' }, loaderEl(), 'Loading insights…'));
  insightsModule = insightsModule || import(`./insights.js${ASSET_V ? `?v=${ASSET_V}` : ''}`);
  insightsModule
    .then(m => m.mountInsights(root, { h, ico, card, switchField, ask, toast, sb, DEMO }))
    .catch(err => {
      insightsModule = null; // try again next time the tab opens
      root.replaceChildren(card('Insights could not load', 'Check your connection, then open the tab again.', h('p', { class: 'muted' }, err.message)));
    });
  return [root];
}

/* ---------- Tabs and views ---------- */
const TABS = {
  insights: { title: 'Insights', desc: 'Who visits your site: when, from where and on which device.', icon: 'insights', render: renderInsights },
  text: { title: 'Site text', desc: 'Edit the text in every part of the site: hero, About, Projects, Contact and more.', icon: 'text', doc: 'site', render: renderText },
  projects: { title: 'Projects', desc: 'Add folders and collections, upload images and reorder them.', icon: 'projects', doc: 'portfolio', render: renderProjects },
  resume: { title: 'Education & Experience', desc: 'Schools, work and awards. Also shown in the Resume preview.', icon: 'resume', doc: 'resume', render: renderResume },
  preview: { title: 'Preview gallery', desc: 'Choose images for the 3 moving rows under the hero.', icon: 'preview', doc: 'preview', render: renderPreview },
  faq: { title: 'FAQ & chat', desc: 'What visitors ask in the chatbox, and the answers it gives them.', icon: 'chat', doc: 'site', render: renderFaq },
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
  // The admin's own visits to the site are not counted in Insights on this browser (../visit.js reads
  // this), unless that was switched back on in the Insights tab.
  if (!DEMO) { try { if (localStorage.getItem('adz:notrack') === null) localStorage.setItem('adz:notrack', '1'); } catch (_) {} }
  $('#panel').replaceChildren(h('div', { class: 'loading' }, loaderEl(), 'Loading content…'));
  await loadDocs();
  applyAdminColors(state.docs.site.theme);
  setPageIcon(state.docs.site.meta && state.docs.site.meta.favicon && state.docs.site.meta.favicon.icon);
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
