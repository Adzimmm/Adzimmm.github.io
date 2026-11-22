// Project view: a category opens full screen under the site header, which stays visible and usable.
// - Grid (default): a masonry board of every visual, like a photo wall.
// - Gallery: one big visual that slides, with small thumbnails below.
// A pill in the middle switches between the two. The sidebar holds the details and the collections
// (which filter both views). Selecting any visual opens it at full size inside the panel.
// app.js owns the address (#project/<id>), the page lock and focus; this file draws the panel.
(() => {
  'use strict';

  const root = document.documentElement;
  const motion = () => root.dataset.motion !== 'off';

  let ctx = null; // { panel, content, escapeHtml, icon(p), color(p), label(p), onClose(), onNext(p) } from app.js
  let p = null; // the open category
  let next = null; // where "Next category" goes
  let layout = 'grid'; // 'grid' | 'gallery', kept while the page is open
  let filter = 'all'; // 'all' or a collection index
  let items = []; // [{ a, s }] visuals in the current filter, in order
  let current = 0; // gallery position (and the visual seen last)
  let cols = 0; // masonry columns
  let els = {};
  let ro = null;
  let leaveTimer = 0;
  let settleTimer = 0;
  let scrollRaf = 0;
  let suppressClick = false;
  const zoom = { i: -1, fit: true, token: 0, busy: false, queued: 0, returnTo: null };

  const SVG = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    back: SVG('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    grid: SVG('<rect x="3.5" y="3.5" width="7" height="9" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.6"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.6"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.6"/>'),
    gallery: SVG('<rect x="3" y="3.5" width="18" height="12" rx="2"/><rect x="3" y="18" width="4.5" height="3" rx="1"/><rect x="9.75" y="18" width="4.5" height="3" rx="1"/><rect x="16.5" y="18" width="4.5" height="3" rx="1"/>'),
    prev: SVG('<path d="m14.5 6-6 6 6 6"/>'),
    next: SVG('<path d="m9.5 6 6 6-6 6"/>'),
    arrow: SVG('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    close: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
    expand: SVG('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
  };

  // Loader from Uiverse.io by david-mohseni - https://uiverse.io/david-mohseni/yellow-cat-24
  // MIT License, Copyright (c) david-mohseni (David Mohseni). Styles: .uv-loader in style.css.
  const LOADER_BARS = Array.from({ length: 12 }, (_, i) => `<div class="bar${i + 1}"></div>`).join('');
  const esc = v => ctx.escapeHtml(v == null ? '' : v);
  const ratio = a => (a.width > 0 && a.height > 0 ? a.width / a.height : 1);
  const small = a => a.thumb || a.display || a.clean || a.src;
  const medium = a => a.display || a.clean || a.src;
  const dims = a => (a.width > 0 && a.height > 0 ? ` width="${a.width}" height="${a.height}"` : '');
  // Categories shown as cut-outs straight on the panel, with no coloured box (a category can also set clear: true).
  const CLEAR = new Set(['logo-folio']);
  const isClear = () => Boolean(p && (p.clear === true || CLEAR.has(p.id)));
  const artClass = a => `${a.dark && !isClear() ? ' dark-art' : ''}${a.opaque ? ' is-opaque' : ''}`;

  // Cut-outs: measure how much of a visual stays readable on a dark and on a light background, so only
  // a visual that would disappear on the current theme gets a soft plate (needs-light / needs-dark).
  const toneCache = new Map();
  const lum = (r, g, b) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const L_LIGHT = lum(250, 249, 252);
  function tone(a) {
    const src = small(a);
    if (!toneCache.has(src)) {
      toneCache.set(src, new Promise(resolve => {
        const none = { light: false, dark: false };
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => {
          try {
            const s = 96 / Math.max(im.naturalWidth, im.naturalHeight, 1);
            const w = Math.max(1, Math.round(im.naturalWidth * s));
            const h = Math.max(1, Math.round(im.naturalHeight * s));
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const g = c.getContext('2d', { willReadFrequently: true });
            g.drawImage(im, 0, 0, w, h);
            const d = g.getImageData(0, 0, w, h).data;
            let solid = 0;
            let onDark = 0;
            let onLight = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] < 128) continue;
              solid++;
              const L = lum(d[i], d[i + 1], d[i + 2]);
              if ((L + 0.05) / 0.05 >= 3) onDark++; // readable on black
              if ((L_LIGHT + 0.05) / (L + 0.05) >= 3) onLight++; // readable on the light background
            }
            resolve(solid ? { light: onDark / solid < 0.4, dark: onLight / solid < 0.2 } : none);
          } catch (_) {
            resolve(none); // an image from another site without CORS cannot be measured
          }
        };
        im.onerror = () => resolve(none);
        im.src = src;
      }));
    }
    return toneCache.get(src);
  }
  const toneClasses = t => (t ? [t.light ? 'needs-light' : '', t.dark ? 'needs-dark' : ''].filter(Boolean) : []);
  function applyTones() {
    if (!isClear()) return;
    const shell = els.shell;
    items.forEach((it, i) => tone(it.a).then(measured => {
      // "Dark" in the admin marks light artwork (often white lettering), so it always gets the dark plate on light.
      const t = { light: measured.light, dark: measured.dark || Boolean(it.a.dark) };
      it.tone = t;
      if (els.shell !== shell || items[i] !== it) return; // redrawn or filtered meanwhile
      const cls = toneClasses(t);
      if (!cls.length) return;
      const slide = els.track.children[i];
      [els.tiles[i], slide && slide.firstElementChild, els.thumbs.children[i]].forEach(el => el && el.classList.add(...cls));
      if (zoom.i === i) els.zoomImg.classList.add(...cls);
    }));
  }
  const count = () => p.sections.reduce((n, s) => n + s.images.length, 0);
  const how = smooth => (smooth && motion() ? 'smooth' : 'instant');

  // Only facts that can be read from the images themselves (orientation counts).
  function formats() {
    const c = { Portrait: 0, Landscape: 0, Square: 0 };
    p.sections.forEach(s => s.images.forEach(a => {
      const r = ratio(a);
      if (r > 1.1) c.Landscape++;
      else if (r < 0.9) c.Portrait++;
      else c.Square++;
    }));
    return Object.entries(c).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ');
  }

  /* ---------- Markup ---------- */
  function shellHtml() {
    const total = count();
    const format = formats();
    return `<div class="pv-shell${isClear() ? ' pv-clear' : ''}" data-cat="${esc(p.id)}" data-layout="${layout}" style="--color:${esc(ctx.color(p))}">
      <aside class="pv-side" aria-label="About ${esc(p.title)}">
        <div class="pv-side-top">
          <button class="pv-back" type="button" data-pv="close">${I.back}<span>All projects</span></button>
          <button class="pv-info" type="button" data-pv="info" aria-expanded="false" aria-controls="pv-about">${I.info}<span>Details</span></button>
        </div>
        <div class="pv-head">
          <p class="pv-kicker"><span class="pv-icon">${ctx.icon(p)}</span><span>${esc(ctx.label(p))}</span></p>
          <h2 class="pv-title" id="detail-title">${esc(p.title)}</h2>
        </div>
        <div class="pv-about" id="pv-about"><div class="pv-about-in">
          ${p.desc ? `<p class="pv-desc">${esc(p.desc)}</p>` : ''}
          <dl class="pv-stats">
            <div><dt>Collections</dt><dd>${p.sections.length}</dd></div>
            <div><dt>Visuals</dt><dd>${total}</dd></div>
            ${format ? `<div class="pv-wide"><dt>Format</dt><dd>${esc(format)}</dd></div>` : ''}
          </dl>
          ${next ? `<button class="pv-next is-small" type="button" data-pv="next"><span><small>Next category</small>${esc(next.title)}</span>${I.arrow}</button>` : ''}
        </div></div>
        <nav class="pv-colls" aria-label="Collections in ${esc(p.title)}">
          <p class="pv-label">Collections</p>
          <button type="button" class="pv-coll" data-coll="all" aria-pressed="${filter === 'all'}"><span>All visuals</span><small>${total}</small></button>
          ${p.sections.map((s, i) => `<button type="button" class="pv-coll" data-coll="${i}" aria-pressed="${filter === i}"><span>${esc(s.title)}</span><small>${s.images.length}</small></button>`).join('')}
        </nav>
        <div class="pv-now" aria-live="polite"></div>
        ${next ? `<button class="pv-next" type="button" data-pv="next"><span><small>Next category</small>${esc(next.title)}</span>${I.arrow}</button>` : ''}
      </aside>
      <section class="pv-main" aria-label="Visuals">
        <div class="pv-bar">
          <div class="pv-switch" role="group" aria-label="Layout">
            <span class="pv-glider" aria-hidden="true"></span>
            <button type="button" data-layout-btn="grid" aria-pressed="${layout === 'grid'}">${I.grid}<span>Grid</span></button>
            <button type="button" data-layout-btn="gallery" aria-pressed="${layout === 'gallery'}">${I.gallery}<span>Gallery</span></button>
          </div>
        </div>
        <span class="pv-count" aria-hidden="true"></span>
        <div class="pv-views">
          <div class="pv-grid">
            <div class="pv-masonry"></div>
            <p class="pv-empty" hidden>No visuals in this collection yet.</p>
          </div>
          <div class="pv-gallery">
            <div class="pv-stage">
              <div class="pv-track"></div>
              <button class="pv-arrow is-prev" type="button" data-pv="prev-img" aria-label="Previous visual">${I.prev}</button>
              <button class="pv-arrow is-next" type="button" data-pv="next-img" aria-label="Next visual">${I.next}</button>
            </div>
            <div class="pv-thumbs" aria-label="Thumbnails"></div>
          </div>
        </div>
      </section>
      <div class="pv-zoom" role="dialog" aria-modal="true" aria-label="Visual at full size" hidden>
        <div class="pv-zoom-bg"></div>
        <div class="pv-zoom-scroll"><img class="pv-zoom-img" alt="" draggable="false"></div>
        <div class="pv-zoom-spin uv-loader" aria-hidden="true">${LOADER_BARS}</div>
        <button class="pv-zoom-btn is-close" type="button" data-pv="zoom-close" aria-label="Close full size">${I.close}</button>
        <button class="pv-zoom-btn is-prev" type="button" data-pv="zoom-prev" aria-label="Previous visual">${I.prev}</button>
        <button class="pv-zoom-btn is-next" type="button" data-pv="zoom-next" aria-label="Next visual">${I.next}</button>
        <p class="pv-zoom-cap"></p>
      </div>
    </div>`;
  }

  function tile(it, i) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pv-tile${artClass(it.a)}`;
    b.dataset.i = String(i);
    b.style.setProperty('--a', ratio(it.a).toFixed(4));
    b.style.setProperty('--d', String(Math.min(i, 16)));
    b.setAttribute('aria-label', `${it.a.alt || it.s.title}. Open full size`);
    b.innerHTML = `<img src="${esc(small(it.a))}"${dims(it.a)} alt="" loading="lazy" decoding="async" draggable="false"><span class="pv-tile-info" aria-hidden="true"><span>${esc(it.s.title)}</span>${I.expand}</span>`;
    return b;
  }

  const slideHtml = (it, i) => `<div class="pv-slide" data-i="${i}"><button type="button" class="pv-frame${artClass(it.a)}" data-zoom="${i}" style="--a:${ratio(it.a).toFixed(4)};--nw:${it.a.width > 0 ? `${it.a.width}px` : 'none'}" aria-label="${esc(it.a.alt || it.s.title)}. Open full size"><img src="${esc(medium(it.a))}"${dims(it.a)} alt="" loading="lazy" decoding="async" draggable="false"></button></div>`;

  const thumbHtml = (it, i) => `<button type="button" class="pv-thumb${it.a.dark && !isClear() ? ' dark-art' : ''}" data-go="${i}" style="--a:${ratio(it.a).toFixed(4)}" aria-label="Visual ${i + 1} of ${items.length}"><img src="${esc(small(it.a))}" alt="" loading="lazy" decoding="async" draggable="false"></button>`;

  /* ---------- Render ---------- */
  function render() {
    if (ro) ro.disconnect();
    clearTimeout(settleTimer);
    ctx.content.innerHTML = shellHtml();
    const shell = ctx.content.firstElementChild;
    const q = sel => shell.querySelector(sel);
    els = {
      shell,
      side: q('.pv-side'),
      main: q('.pv-main'),
      back: q('.pv-back'),
      info: q('.pv-info'),
      colls: [...shell.querySelectorAll('.pv-coll')],
      now: q('.pv-now'),
      switchEl: q('.pv-switch'),
      glider: q('.pv-glider'),
      layoutBtns: [...shell.querySelectorAll('[data-layout-btn]')],
      grid: q('.pv-grid'),
      masonry: q('.pv-masonry'),
      empty: q('.pv-empty'),
      track: q('.pv-track'),
      thumbs: q('.pv-thumbs'),
      prev: q('.pv-arrow.is-prev'),
      nextImg: q('.pv-arrow.is-next'),
      count: q('.pv-count'),
      zoom: q('.pv-zoom'),
      zoomScroll: q('.pv-zoom-scroll'),
      zoomImg: q('.pv-zoom-img'),
      zoomCap: q('.pv-zoom-cap'),
      zoomPrev: q('.pv-zoom-btn.is-prev'),
      zoomNext: q('.pv-zoom-btn.is-next'),
      zoomClose: q('.pv-zoom-btn.is-close'),
      tiles: [],
    };
    shell.addEventListener('click', onClick);
    els.track.addEventListener('scroll', onTrackScroll, { passive: true });
    els.track.addEventListener('pointerdown', dragTrack);
    wireZoom();
    fill();
    els.glider.style.transition = 'none';
    moveGlider();
    void els.glider.offsetWidth;
    els.glider.style.transition = '';
    updateNow();
    ro = new ResizeObserver(() => {
      layoutGrid(false);
      if (els.track.clientWidth) els.track.scrollLeft = current * els.track.clientWidth;
      moveGlider();
      if (!els.zoom.hidden) layoutZoom();
    });
    [els.grid, els.track, els.switchEl, els.zoom].forEach(el => ro.observe(el));
  }

  // Visuals of the current filter: grid tiles, gallery slides and thumbnails.
  function fill() {
    items = [];
    p.sections.forEach((s, si) => {
      if (filter === 'all' || filter === si) s.images.forEach(a => items.push({ a, s }));
    });
    current = Math.min(current, Math.max(0, items.length - 1));
    els.tiles = items.map(tile);
    els.masonry.classList.remove('is-settled');
    cols = 0;
    layoutGrid(true);
    els.empty.hidden = items.length > 0;
    els.grid.scrollTop = 0;
    // Entrance done: tiles that move between columns later (resize) do not replay it.
    settleTimer = setTimeout(() => els.masonry.classList.add('is-settled'), 1200);
    els.track.innerHTML = items.map(slideHtml).join('');
    els.thumbs.innerHTML = items.map(thumbHtml).join('');
    setCurrent(current, true, false);
    applyTones();
  }

  // Masonry: each visual goes to the shortest column, so the order still reads left to right.
  function layoutGrid(force) {
    const w = els.grid.clientWidth;
    if (!w) return;
    const n = w >= 1100 ? 4 : w >= 640 ? 3 : 2;
    if (n === cols && !force) return;
    cols = n;
    const columns = [];
    const heights = [];
    for (let k = 0; k < n; k++) {
      const c = document.createElement('div');
      c.className = 'pv-col';
      columns.push(c);
      heights.push(0);
    }
    els.tiles.forEach((t, i) => {
      let k = 0;
      for (let j = 1; j < n; j++) if (heights[j] < heights[k] - 0.05) k = j;
      columns[k].append(t);
      heights[k] += 1 / ratio(items[i].a) + 0.08;
    });
    els.masonry.replaceChildren(...columns);
  }

  function moveGlider() {
    const b = els.layoutBtns && els.layoutBtns.find(x => x.dataset.layoutBtn === layout);
    if (!b || !b.offsetWidth) return;
    els.glider.style.width = `${b.offsetWidth}px`;
    els.glider.style.transform = `translateX(${b.offsetLeft}px)`;
  }

  /* ---------- Layout, collections, gallery position ---------- */
  function setLayout(v) {
    if (v === layout) return;
    layout = v;
    els.shell.dataset.layout = v;
    els.layoutBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.layoutBtn === v)));
    moveGlider();
    if (v === 'gallery') setCurrent(current, true, false);
    else revealTile(current);
    updateNow();
  }

  function setFilter(f) {
    if (f === filter) return;
    filter = f;
    els.colls.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.coll === String(f))));
    current = 0;
    const swap = () => {
      fill();
      updateNow();
      if (motion()) els.track.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    };
    if (!motion()) return swap();
    // A quick fade of the old set, then the new set rises in.
    const fade = [{ opacity: 1 }, { opacity: 0 }];
    Promise.all([
      els.masonry.animate(fade, { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished,
      els.track.animate(fade, { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished,
    ]).then(() => {
      els.masonry.getAnimations().forEach(a => a.cancel());
      els.track.getAnimations().forEach(a => a.cancel());
      swap();
    }, swap);
  }

  function setCurrent(i, scrollTrack, smooth) {
    current = items.length ? Math.max(0, Math.min(items.length - 1, i)) : 0;
    if (scrollTrack && els.track.clientWidth) els.track.scrollTo({ left: current * els.track.clientWidth, behavior: how(smooth) });
    galleryUi(smooth);
  }

  function galleryUi(smooth) {
    [...els.thumbs.children].forEach((t, k) => {
      const on = k === current;
      t.classList.toggle('is-on', on);
      if (on) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    });
    const t = els.thumbs.children[current];
    if (t) els.thumbs.scrollTo({ left: t.offsetLeft - (els.thumbs.clientWidth - t.offsetWidth) / 2, behavior: how(smooth) });
    els.prev.disabled = current <= 0;
    els.nextImg.disabled = current >= items.length - 1;
    els.count.textContent = items.length ? `${current + 1} / ${items.length}` : '';
    updateNow();
  }

  function updateNow() {
    const it = items[current];
    const html = layout === 'gallery' && it
      ? `<p class="pv-label">Now viewing</p><p class="pv-now-title">${esc(it.s.title)}</p><p class="pv-now-meta">Visual ${current + 1} of ${items.length}${it.a.width > 0 ? ` · ${it.a.width} × ${it.a.height}` : ''}</p>`
      : `<p class="pv-hint">${I.expand}<span>Select a visual to see it at full size.</span></p>`;
    if (els.now.innerHTML !== html) els.now.innerHTML = html;
  }

  // Swipes, trackpads and arrows move the track; the visual most in view becomes current.
  function onTrackScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const w = els.track.clientWidth;
      if (!w) return;
      const i = Math.round(els.track.scrollLeft / w);
      if (i !== current && i >= 0 && i < items.length) {
        current = i;
        galleryUi(true);
      }
    });
  }

  // Mouse drag on the gallery (touch and trackpads scroll natively).
  function dragTrack(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const tr = els.track;
    const w = tr.clientWidth;
    const startX = e.clientX;
    const startLeft = tr.scrollLeft;
    let moved = false;
    const move = ev => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        tr.classList.add('is-dragging');
      }
      if (moved) tr.scrollLeft = startLeft - dx;
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) return;
      const dx = ev.clientX - startX;
      const base = Math.round(startLeft / w);
      setCurrent(Math.abs(dx) > w * 0.12 ? base + (dx < 0 ? 1 : -1) : base, true, true);
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        tr.classList.remove('is-dragging');
      };
      tr.addEventListener('scrollend', restore, { once: true });
      setTimeout(restore, 700);
      suppressClick = true; // the click that ends a drag must not open the visual
      setTimeout(() => { suppressClick = false; }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Grid: bring a tile into view (used when coming back from the gallery or the full-size view).
  function revealTile(i) {
    const t = els.masonry.querySelector(`.pv-tile[data-i="${i}"]`);
    if (!t) return;
    const box = t.getBoundingClientRect();
    const area = els.grid.getBoundingClientRect();
    if (box.top < area.top + 72 || box.bottom > area.bottom) els.grid.scrollTop += box.top - area.top - (area.height - box.height) / 2;
  }

  /* ---------- Full size ---------- */
  const sourceEl = i => els.shell.querySelector(layout === 'grid' ? `.pv-tile[data-i="${i}"]` : `.pv-slide[data-i="${i}"] .pv-frame`);
  function inView(el) {
    if (!el) return false;
    const b = el.getBoundingClientRect();
    const a = els.main.getBoundingClientRect();
    return b.width > 0 && b.bottom > a.top && b.top < a.bottom && b.right > a.left && b.left < a.right;
  }

  function openZoom(i) {
    const it = items[i];
    if (!it || suppressClick) return;
    const from = sourceEl(i);
    const z = els.zoom;
    zoom.i = i;
    zoom.fit = true;
    zoom.returnTo = document.activeElement;
    z.hidden = false;
    z.classList.remove('is-fill', 'is-open', 'is-closing');
    els.side.inert = true;
    els.main.inert = true;
    const shown = from && from.querySelector('img');
    setZoomImage(it, shown && shown.complete && shown.currentSrc ? shown.currentSrc : small(it.a));
    layoutZoom();
    zoomUi();
    void z.offsetWidth;
    z.classList.add('is-open');
    if (from && motion() && inView(from)) {
      // The visual flies from its place in the grid or gallery to full size.
      const a = from.getBoundingClientRect();
      const b = els.zoomImg.getBoundingClientRect();
      if (a.width && b.width) {
        from.style.visibility = 'hidden';
        els.zoomImg.animate([
          { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})` },
          { transform: 'none' },
        ], { duration: 460, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.catch(() => {}).then(() => { from.style.visibility = ''; });
      }
    }
    els.zoomClose.focus({ preventScroll: true });
  }

  function setZoomImage(it, lowSrc) {
    const img = els.zoomImg;
    const token = ++zoom.token;
    img.className = `pv-zoom-img${artClass(it.a)}${toneClasses(it.tone).map(c => ` ${c}`).join('')}`;
    img.alt = it.a.alt || it.s.title;
    img.src = lowSrc;
    const full = new URL(it.a.src || medium(it.a), location.href).href;
    if (img.src === full) {
      els.zoom.classList.remove('is-loading');
      return;
    }
    els.zoom.classList.add('is-loading');
    const pre = new Image();
    pre.decoding = 'async';
    pre.src = full;
    const ready = pre.decode ? pre.decode() : new Promise((res, rej) => { pre.onload = res; pre.onerror = rej; });
    ready.then(() => {
      if (token !== zoom.token) return;
      img.src = full;
      els.zoom.classList.remove('is-loading');
    }, () => { if (token === zoom.token) els.zoom.classList.remove('is-loading'); });
  }

  // Fit inside the panel without enlarging past the real pixels; "fill" shows it wide and scrolls.
  function layoutZoom() {
    const it = items[zoom.i];
    if (!it) return;
    const img = els.zoomImg;
    const W = els.zoom.clientWidth;
    const H = els.zoom.clientHeight;
    const phone = W < 640;
    const padX = phone ? 12 : 84;
    const padTop = phone ? 64 : 72;
    const padBottom = phone ? 80 : 76;
    const r = ratio(it.a);
    const natural = it.a.width > 0 ? it.a.width : Infinity;
    const maxW = Math.max(40, W - padX * 2);
    const maxH = Math.max(40, H - padTop - padBottom);
    const fitW = Math.min(maxW, maxH * r, natural);
    const wide = Math.min(W - (phone ? 16 : 120), natural);
    const canFill = Number.isFinite(natural) && wide > fitW * 1.25;
    els.zoom.classList.toggle('can-fill', canFill);
    if (zoom.fit || !canFill) {
      zoom.fit = true;
      els.zoom.classList.remove('is-fill');
      const h = fitW / r;
      Object.assign(img.style, { width: `${fitW}px`, height: `${h}px`, left: `${(W - fitW) / 2}px`, top: `${padTop + (maxH - h) / 2}px` });
    } else {
      Object.assign(img.style, { width: `${wide}px`, height: `${wide / r}px`, left: '', top: '' });
    }
  }

  function toggleFill(e) {
    if (!els.zoom.classList.contains('can-fill')) return;
    const img = els.zoomImg;
    const sc = els.zoomScroll;
    const before = img.getBoundingClientRect();
    const fy = e ? Math.min(1, Math.max(0, (e.clientY - before.top) / before.height)) : 0;
    zoom.fit = !zoom.fit;
    els.zoom.classList.toggle('is-fill', !zoom.fit);
    layoutZoom();
    if (!zoom.fit) {
      // Keep the spot that was clicked under the pointer.
      const top = sc.getBoundingClientRect().top;
      sc.scrollTop = img.offsetTop + fy * img.offsetHeight - ((e ? e.clientY : top) - top);
    } else sc.scrollTop = 0;
    const after = img.getBoundingClientRect();
    if (motion() && after.width) {
      img.animate([
        { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width})` },
        { transform: 'none' },
      ], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }

  function zoomUi() {
    const it = items[zoom.i];
    if (!it) return;
    els.zoomPrev.disabled = zoom.i <= 0;
    els.zoomNext.disabled = zoom.i >= items.length - 1;
    els.zoomCap.innerHTML = `<span>${esc(it.s.title)}</span><b>${zoom.i + 1} / ${items.length}</b>`;
  }

  function stepZoom(d) {
    if (els.zoom.hidden) return;
    if (zoom.busy) {
      zoom.queued = d;
      return;
    }
    const i = zoom.i + d;
    if (i < 0 || i >= items.length) return;
    const img = els.zoomImg;
    const swap = () => {
      img.getAnimations().forEach(a => a.cancel());
      zoom.i = i;
      zoom.fit = true;
      els.zoomScroll.scrollTop = 0;
      setZoomImage(items[i], small(items[i].a));
      layoutZoom();
      zoomUi();
      // The gallery and the grid follow, so closing lands on this visual.
      current = i;
      if (layout === 'gallery') setCurrent(i, true, false);
      else updateNow();
      const after = () => {
        zoom.busy = false;
        const q = zoom.queued;
        zoom.queued = 0;
        if (q) stepZoom(q);
      };
      if (!motion()) return after();
      img.animate([{ opacity: 0, transform: `translateX(${d * 36}px)` }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.then(after, after);
    };
    zoom.busy = true;
    if (!motion()) return swap();
    img.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-d * 36}px)` }],
      { duration: 130, easing: 'ease-in', fill: 'forwards' }).finished.then(swap, swap);
  }

  function closeZoom(instant) {
    if (!els.zoom || els.zoom.hidden) return;
    const z = els.zoom;
    const img = els.zoomImg;
    if (layout === 'grid') revealTile(zoom.i);
    const target = sourceEl(zoom.i);
    const finish = () => {
      z.hidden = true;
      z.classList.remove('is-open', 'is-fill', 'is-loading', 'is-closing');
      img.getAnimations().forEach(a => a.cancel());
      img.removeAttribute('src');
      if (target) target.style.visibility = '';
      els.side.inert = false;
      els.main.inert = false;
      zoom.i = -1;
      zoom.busy = false;
      zoom.queued = 0;
      const back = target || zoom.returnTo;
      if (!instant && back && back.isConnected) back.focus({ preventScroll: true });
    };
    if (instant || !motion()) return finish();
    z.classList.remove('is-open');
    z.classList.add('is-closing');
    if (target && inView(target)) {
      // Fly back into its place.
      const a = img.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      target.style.visibility = 'hidden';
      img.animate([
        { transform: 'none' },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width})` },
      ], { duration: 380, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.then(finish, finish);
    } else {
      img.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
        { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.then(finish, finish);
    }
  }

  // Phones: swipe sideways for the next visual, pull down to close. A tap on the visual makes it wide.
  function wireZoom() {
    const sc = els.zoomScroll;
    const img = els.zoomImg;
    let down = false;
    let swiped = false;
    let sx = 0;
    let sy = 0;
    sc.addEventListener('pointerdown', e => {
      swiped = false;
      if (!zoom.fit || e.pointerType === 'mouse') return;
      down = true;
      sx = e.clientX;
      sy = e.clientY;
    });
    sc.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      img.classList.add('is-held');
      img.style.translate = Math.abs(dx) > Math.abs(dy) ? `${dx * 0.55}px 0` : `0 ${Math.max(0, dy) * 0.5}px`;
    });
    const end = e => {
      if (!down) return;
      down = false;
      img.classList.remove('is-held');
      img.style.translate = '';
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        swiped = true;
        stepZoom(dx < 0 ? 1 : -1);
      } else if (dy > 90 && dy > Math.abs(dx)) {
        swiped = true;
        closeZoom();
      }
    };
    sc.addEventListener('pointerup', end);
    sc.addEventListener('pointercancel', () => {
      down = false;
      img.classList.remove('is-held');
      img.style.translate = '';
    });
    sc.addEventListener('click', e => {
      if (swiped) {
        swiped = false;
        return;
      }
      if (e.target === img) toggleFill(e);
      else closeZoom();
    });
  }

  /* ---------- Events ---------- */
  function onClick(e) {
    const t = e.target.closest('[data-pv], [data-layout-btn], [data-coll], [data-go], [data-zoom], .pv-tile');
    if (!t || !els.shell.contains(t)) return;
    if (t.classList.contains('pv-tile')) return openZoom(Number(t.dataset.i));
    if (t.dataset.zoom != null) return openZoom(Number(t.dataset.zoom));
    if (t.dataset.go != null) return setCurrent(Number(t.dataset.go), true, true);
    if (t.dataset.layoutBtn) return setLayout(t.dataset.layoutBtn);
    if (t.dataset.coll != null) return setFilter(t.dataset.coll === 'all' ? 'all' : Number(t.dataset.coll));
    switch (t.dataset.pv) {
      case 'close': return ctx.onClose();
      case 'next': return next && ctx.onNext(next);
      case 'prev-img': return setCurrent(current - 1, true, true);
      case 'next-img': return setCurrent(current + 1, true, true);
      case 'info': {
        const open = !els.shell.classList.contains('is-about');
        els.shell.classList.toggle('is-about', open);
        els.info.setAttribute('aria-expanded', String(open));
        return undefined;
      }
      case 'zoom-close': return closeZoom();
      case 'zoom-prev': return stepZoom(-1);
      case 'zoom-next': return stepZoom(1);
      default: return undefined;
    }
  }

  function onKey(e) {
    if (!ctx || !ctx.panel.open || !els.shell || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if ([...document.querySelectorAll('dialog[open]')].some(d => d !== ctx.panel)) return; // e.g. the resume preview on top
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (e.key === 'Escape') {
      if (typing) return;
      e.preventDefault();
      if (!els.zoom.hidden) closeZoom();
      else ctx.onClose();
      return;
    }
    if (typing || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const d = e.key === 'ArrowRight' ? 1 : -1;
    if (!els.zoom.hidden) {
      e.preventDefault();
      stepZoom(d);
    } else if (layout === 'gallery') {
      e.preventDefault();
      setCurrent(current + d, true, true);
    }
  }

  /* ---------- API used by app.js ---------- */
  function cancelLeave() {
    clearTimeout(leaveTimer);
    leaveTimer = 0;
    ctx.panel.classList.remove('is-leaving');
  }

  window.ProjectView = {
    init(options) {
      ctx = options;
      document.addEventListener('keydown', onKey);
    },

    // Draws a category; when the panel is already open on another one it fades across.
    show(project, nextProject) {
      cancelLeave();
      const open = ctx.panel.open && els.shell && els.shell.isConnected;
      if (open && p && p.id === project.id) {
        p = project;
        next = nextProject;
        ctx.panel.classList.add('is-in');
        return;
      }
      p = project;
      next = nextProject;
      filter = 'all';
      current = 0;
      if (!open || !motion()) {
        render();
        if (open) els.back.focus({ preventScroll: true });
        return;
      }
      closeZoom(true);
      els.shell.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px)' }],
        { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
        render();
        els.back.focus({ preventScroll: true });
      });
    },

    // After app.js shows the panel: slide it in under the header.
    enter() {
      cancelLeave();
      const panel = ctx.panel;
      if (motion()) void panel.offsetWidth;
      panel.classList.add('is-in');
      // The panel was drawn while closed (no size yet): lay out the grid and gallery now it is visible.
      layoutGrid(false);
      if (els.track && els.track.clientWidth) els.track.scrollLeft = current * els.track.clientWidth;
      moveGlider();
      if (els.back) els.back.focus({ preventScroll: true });
    },

    // Fades the panel out, then app.js closes it.
    leave(done) {
      const panel = ctx.panel;
      closeZoom(true);
      if (!motion()) {
        panel.classList.remove('is-in');
        done();
        return;
      }
      panel.classList.add('is-leaving');
      panel.classList.remove('is-in');
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        leaveTimer = 0;
        panel.classList.remove('is-leaving');
        done();
      }, 280);
    },

    isLeaving: () => Boolean(leaveTimer),
  };
})();
