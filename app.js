(() => {
  'use strict';

  /* ---------- Content: Supabase first, bundled files as fallback ---------- */
  // The admin page saves four JSON rows (site, portfolio, resume, preview) in Supabase.
  // Without a config, on error or after 2.5 s the bundled site-data.js / portfolio-data.js /
  // resume-data.js are used, so the page never waits long or renders empty.
  const isPlain = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(base, extra) {
    if (!isPlain(base) || !isPlain(extra)) return extra === undefined ? base : extra;
    const out = { ...base };
    Object.keys(extra).forEach(k => { out[k] = merge(base[k], extra[k]); });
    return out;
  }

  async function loadContent() {
    const cfg = window.SUPABASE || {};
    if (!cfg.url || !cfg.anonKey) return {};
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/content?select=key,data`, {
        headers: { apikey: cfg.anonKey },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      return Object.fromEntries(rows.map(r => [r.key, r.data]));
    } catch (err) {
      console.warn('Using bundled content:', err.message);
      return {};
    } finally {
      clearTimeout(timer);
    }
  }

  loadContent().then(remote => {
    window.SITE = merge(window.SITE || {}, remote.site || {});
    if (Array.isArray(remote.portfolio) && remote.portfolio.length) window.PORTFOLIO_DATA = remote.portfolio;
    if (isPlain(remote.resume)) window.RESUME = remote.resume;
    if (isPlain(remote.preview)) window.PREVIEW = remote.preview;
    start();
  });

  function start() {

  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const root = document.documentElement;
  const header = $('#site-header');
  const menuBtn = $('.menu');
  const nav = $('#main-nav');
  const themeBtn = $('.theme-toggle');

  function applyTheme(theme) {
    root.dataset.theme = theme;
    const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.title = label;
    $('meta[name="theme-color"]').content = theme === 'light' ? '#faf9fc' : '#000000';
  }
  applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
  themeBtn.addEventListener('click', () => {
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(theme);
    try { localStorage.setItem('adzim-theme', theme); } catch (_) {}
  });
  window.addEventListener('storage', e => {
    if (e.key === 'adzim-theme') applyTheme(e.newValue === 'light' ? 'light' : 'dark');
  });

  const grid = $('#grid');
  const marquees = $$('.marquee');
  const searchInput = $('#search');
  const results = $('#results');
  const empty = $('#empty');
  const progressBar = $('.scroll-progress-bar');
  const modal = $('#detail');
  const detailContent = $('#detail-content');
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopQuery = window.matchMedia('(min-width: 901px)');

  const projects = window.PORTFOLIO_DATA;
  const site = window.SITE;
  const CATEGORY_NAMES = Object.fromEntries(projects.map(p => [p.id, p.title]));
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  // Filter pills: an icon per category.
  const ICON = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const FILTER_ICONS = {
    all: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    'logo-folio': '<circle cx="12" cy="12" r="9"/><path d="m12 7 1.5 3.2 3.5.5-2.5 2.4.6 3.4L12 15l-3.1 1.5.6-3.4L7 10.7l3.5-.5Z"/>',
    'brand-design': '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle cx="8" cy="8" r="1.5"/>',
    'social-media': '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
    'digital-art': '<path d="M12 19l7-7 3 3-7 7Z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18Z"/><circle cx="11" cy="11" r="2"/>',
    'print-media': '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6Z"/>',
    'ui-ux': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
    others: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>',
  };
  const filterButton = (id, label, active, icon) => `<button class="filter${active ? ' is-active' : ''}" type="button" data-filter="${id}" aria-pressed="${active}">${ICON(FILTER_ICONS[icon] || FILTER_ICONS[id] || FILTER_ICONS.others)}<span>${escapeHtml(label)}</span></button>`;
  $('.filters').innerHTML = filterButton('all', 'All categories', true) + projects.map(p => filterButton(p.id, p.title, false, p.icon)).join('');

  // Each category has its own accent and tone. Cover colours never drive the system on their own.
  const CATEGORY_THEMES = {
    'logo-folio': { color: '#b8a0ff', label: 'Identity system' },
    'brand-design': { color: '#ddad82', label: 'Brand & food' },
    'social-media': { color: '#f4a1ba', label: 'Campaign' },
    'digital-art': { color: '#a2d9ba', label: 'Character' },
    'print-media': { color: '#d7c785', label: 'Production' },
    'ui-ux': { color: '#8dbaff', label: 'Interface' },
    'others': { color: '#c9c4d6', label: 'Experimental' },
  };
  // Categories made in the admin page carry their own accent, label and icon.
  const themeOf = p => {
    const preset = CATEGORY_THEMES[p.id] || {};
    return { color: p.accent || preset.color || '#c9c4d6', label: p.label ?? preset.label ?? '' };
  };

  const state = { filter: 'all', query: '', active: null };
  const cards = new Map();

  /* ---------- Motion ---------- */
  // Animation follows the OS reduced-motion setting; there is no on-page toggle.
  let motionOn = root.dataset.motion !== 'off';

  function applyMotion() {
    root.dataset.motion = motionOn ? 'on' : 'off';
    // With motion off each row becomes a normal scroller, so it must be reachable by keyboard.
    marquees.forEach(row => {
      if (motionOn) row.removeAttribute('tabindex');
      else row.tabIndex = 0;
    });
  }

  reduceQuery.addEventListener('change', e => {
    motionOn = !e.matches;
    applyMotion();
    if (motionOn) observeTargets();
  });

  /* ---------- Visibility observer: pause offscreen art, reveal cards once ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      target.classList.toggle('in-view', isIntersecting);
      if (isIntersecting && target.classList.contains('card') && root.dataset.motion === 'on') {
        target.classList.add('is-visible');
      }
    });
  }, { rootMargin: '80px 0px' });

  function observeTargets() {
    io.disconnect();
    $$('.card, .hero-visual, .marquee').forEach(el => io.observe(el));
  }

  /* ---------- Cards ---------- */
  function palette(p) {
    const { color } = themeOf(p);
    return `--color:${color}`;
  }

  const visualCount = p => p.sections.reduce((n, s) => n + s.images.length, 0);

  // Rows are arranged by hand in the data; flex ratios keep every tile in a row the same height.
  // New categories have no hand-made mosaic: up to nine of their visuals, three per row.
  function autoMosaic(p) {
    const all = p.sections.flatMap(s => s.images).slice(0, 9)
      .map(a => ({ thumb: a.thumb || a.display || a.src, width: a.width, height: a.height, alt: a.alt, plate: false, dark: !!a.dark }));
    const rows = [];
    for (let i = 0; i < all.length; i += 3) rows.push(all.slice(i, i + 3));
    return rows;
  }

  function artwork(p) {
    const rows = (p.mosaic && p.mosaic.length ? p.mosaic : autoMosaic(p)).map(row => `<div class="m-row">${row.map(a => {
      const classes = `m-tile${a.plate ? ' has-plate' : ''}${a.dark ? ' dark-art' : ''}`;
      return `<span class="${classes}" style="--a:${(a.width / a.height).toFixed(3)}"><img src="${a.thumb}" width="${a.width}" height="${a.height}" alt="${escapeHtml(a.alt)}" loading="lazy" decoding="async"></span>`;
    }).join('')}</div>`).join('');
    return `<div class="panel card-mosaic">${rows}</div>`;
  }

  function collectionList(p) {
    const top = [...p.sections].sort((a, b) => b.images.length - a.images.length).slice(0, 4);
    const more = p.sections.length - top.length;
    const items = top.map(s => `<li><span>${escapeHtml(s.title)}</span><small>${s.images.length}</small></li>`).join('');
    return `<ul class="hair-list">${items}${more > 0 ? `<li class="more"><span>+${more} more collections</span></li>` : ''}</ul>`;
  }

  // Text-and-icon cards (no artwork) in a 3D "cyber" style; the colour is the category accent.
  const fx = (cls, n) => `<span class="${cls}" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`;
  function buildCards() {
    grid.innerHTML = projects.map(p => `
      <a class="card cyber" href="#project/${p.id}" data-id="${p.id}" data-cat="${p.id}" style="${palette(p)}" aria-label="View ${escapeHtml(p.title)}">
        <div class="cy-card">
          <span class="cy-glare" aria-hidden="true"></span>
          ${fx('cy-lines', 4)}${fx('cy-glows', 3)}${fx('cy-particles', 6)}${fx('cy-corners', 4)}
          <span class="cy-scan" aria-hidden="true"></span>
          <div class="cy-body">
            <span class="cy-icon">${ICON(FILTER_ICONS[p.icon] || FILTER_ICONS[p.id] || FILTER_ICONS.others)}</span>
            <p class="card-kicker">${escapeHtml(themeOf(p).label)}</p>
            <h3>${escapeHtml(p.title)}</h3>
            <p class="card-desc">${escapeHtml(p.desc)}</p>
            <p class="cy-meta"><span><b>${p.sections.length}</b> collections</span><span><b>${visualCount(p)}</b> visuals</span></p>
            <div class="card-cta"><span>${escapeHtml(site.projects.cta)} <i aria-hidden="true">↗</i></span></div>
          </div>
        </div>
      </a>`).join('');
    $$('.card', grid).forEach(el => cards.set(el.dataset.id, el));
  }

  // Tilt the card toward the pointer (mouse only, and only when motion is on).
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    grid.addEventListener('pointermove', e => {
      const card = e.target.closest('.cyber');
      if (!card || root.dataset.motion !== 'on') return;
      const box = card.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width - 0.5;
      const y = (e.clientY - box.top) / box.height - 0.5;
      card.style.setProperty('--rx', `${(-y * 16).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    grid.addEventListener('pointerout', e => {
      const card = e.target.closest('.cyber');
      if (card && !card.contains(e.relatedTarget)) { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); }
    });
  }

  /* ---------- Sliding preview ---------- */
  // Rows chosen in the admin page (window.PREVIEW), else the ones bundled with Logo Folio and Social Media.
  function previewData() {
    if (window.PREVIEW) return { logo: [], square: [], portrait: [], ...window.PREVIEW };
    const byId = id => projects.find(p => p.id === id) || {};
    const social = byId('social-media');
    return { logo: byId('logo-folio').preview || [], square: social.previewSquare || [], portrait: social.previewPortrait || [] };
  }

  // Rows use small files made for this size; decoding is left synchronous so moving tiles never paint blank.
  function previewImg(a, described, className = '') {
    return `<img${className ? ` class="${className}"` : ''} src="${a.thumb}" width="${a.width}" height="${a.height}" alt="${described ? escapeHtml(a.alt) : ''}" loading="lazy">`;
  }

  function buildMarquee() {
    const preview = previewData();
    const posters = list => list.map(a => described =>
      `<div class="mq-item" style="--a:${(a.width / a.height).toFixed(3)}">${previewImg(a, described)}</div>`);
    const logos = preview.logo.map(({ light, dark }) => described =>
      `<div class="mq-item mq-logo" style="--a:1">${dark ? previewImg(light, described, 'on-light') + previewImg(dark, described, 'on-dark') : previewImg(light, described)}</div>`);
    const rows = { logo: logos, square: posters(preview.square), portrait: posters(preview.portrait) };

    // Four identical groups and a move of half the track: wide screens never see a gap.
    marquees.forEach(row => {
      const items = rows[row.dataset.row];
      const group = described => `<div class="mq-group"${described ? '' : ' aria-hidden="true"'}>${items.map(render => render(described)).join('')}</div>`;
      $('.marquee-track', row).innerHTML = group(true) + group(false).repeat(3);
    });
  }

  /* ---------- Filter, search, render ---------- */
  function matches(p, term) {
    const inCategory = state.filter === 'all' || p.category === state.filter;
    const haystack = `${p.title} ${p.type} ${p.desc} ${themeOf(p).label} ${p.sections.map(s => s.title).join(' ')}`.toLowerCase();
    return inCategory && haystack.includes(term);
  }

  function visibleProjects() {
    const term = state.query.trim().toLowerCase();
    return projects.filter(p => matches(p, term));
  }

  // Toggles visibility and side only; cards are never rebuilt.
  function render({ interacted = false } = {}) {
    const shown = visibleProjects();
    const shownIds = new Set(shown.map(p => p.id));

    projects.forEach(p => {
      const el = cards.get(p.id);
      el.hidden = !shownIds.has(p.id);
      // Cards already on screen do not replay their entrance when a filter changes.
      if (interacted && shownIds.has(p.id)) el.classList.add('is-visible');
    });

    // Text and mosaic swap sides on every other visible category.
    const n = shown.length;
    shown.forEach((p, i) => cards.get(p.id).classList.toggle('is-flip', i % 2 === 1));

    empty.hidden = n !== 0;
    const scope = state.filter !== 'all' ? ` · ${CATEGORY_NAMES[state.filter]}` : '';
    results.textContent = `Showing ${n} of ${projects.length} categories${scope}`;

    $$('[data-filter]').forEach(btn => {
      const on = btn.dataset.filter === state.filter;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    if (typeof measure === 'function') measure(); // page height may change with results
  }

  $$('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      render({ interacted: true });
    });
  });

  searchInput.addEventListener('input', e => {
    state.query = e.target.value;
    render({ interacted: true });
  });

  // The search lives in the hero; Enter or the round button jumps down to the matching projects.
  $('.hero-search').addEventListener('submit', e => {
    e.preventDefault();
    state.query = searchInput.value;
    render({ interacted: true });
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    window.scrollTo({ top: $('#work').getBoundingClientRect().top + window.scrollY - pad,
      behavior: root.dataset.motion === 'off' ? 'instant' : 'smooth' });
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape' && searchInput.value) {
      e.preventDefault();
      state.query = '';
      searchInput.value = '';
      render({ interacted: true });
    }
  });

  $('#reset').addEventListener('click', () => {
    state.filter = 'all';
    state.query = '';
    searchInput.value = '';
    render({ interacted: true });
    $('[data-filter="all"]').focus();
  });

  /* ---------- Detail modal: case-study style ---------- */
  // Featured collection = the section with the most visuals; it leads the gallery.
  function featuredIndex(p) {
    let best = 0;
    p.sections.forEach((s, i) => { if (s.images.length > p.sections[best].images.length) best = i; });
    return best;
  }

  // Only facts that can be read from the images themselves (orientation counts).
  function formatSummary(p) {
    const counts = { Portrait: 0, Landscape: 0, Square: 0 };
    p.sections.forEach(s => s.images.forEach(a => {
      const r = a.width / a.height;
      if (r > 1.1) counts.Landscape++;
      else if (r < 0.9) counts.Portrait++;
      else counts.Square++;
    }));
    return Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ');
  }

  // Displays a lighter copy (made from the cleaned file when one exists); "Saiz penuh" always opens the original.
  function galleryItem(a) {
    return `<figure class="gallery-item" style="--a:${(a.width / a.height).toFixed(3)}"><a class="gallery-image${a.dark ? ' dark-art' : ''}${a.opaque ? ' is-opaque' : ''}" href="${a.src}" target="_blank" rel="noopener" aria-label="${escapeHtml(a.alt)} — open full size in a new tab"><img src="${a.display || a.clean || a.src}" width="${a.width}" height="${a.height}" alt="${escapeHtml(a.alt)}" loading="lazy" decoding="async"></a><figcaption><a href="${a.src}" target="_blank" rel="noopener" aria-label="${escapeHtml(a.alt)} — full size in a new tab">Full size ↗</a></figcaption></figure>`;
  }

  // How much width-to-height each gallery row holds at the current screen size.
  const galleryTarget = () => (window.innerWidth > 900 ? 3.4 : window.innerWidth > 600 ? 2.6 : 1.5);

  function partition(images) {
    const target = galleryTarget();
    const rows = [];
    let row = [];
    let sum = 0;
    images.forEach(a => {
      row.push(a);
      sum += a.width / a.height;
      if (sum >= target) { rows.push(row); row = []; sum = 0; }
    });
    if (row.length) {
      if (rows.length && sum < target * 0.5) rows[rows.length - 1].push(...row);
      else rows.push(row);
    }
    return rows;
  }

  // Row width is capped so images are never enlarged beyond their real pixels.
  function galleryRow(row, maxHeight) {
    const sum = row.reduce((n, a) => n + a.width / a.height, 0);
    const height = Math.min(maxHeight, ...row.map(a => a.height));
    return `<div class="gallery-row" style="max-width:${Math.round(height * sum + 8 * (row.length - 1))}px">${row.map(galleryItem).join('')}</div>`;
  }

  function galleryHtml(s, featured) {
    if (!featured) return partition(s.images).map(row => galleryRow(row, 440)).join('');
    const [lead, ...rest] = s.images;
    return galleryRow([lead], 640) + partition(rest).map(row => galleryRow(row, 440)).join('');
  }

  function sectionHtml(p, s, i, featured) {
    const badge = featured ? '<span class="featured-badge">Featured collection</span>' : '';
    const meta = featured
      ? `<p class="featured-meta"><span>The largest collection in ${escapeHtml(p.title)}</span><span><b>${s.images.length}</b> visual</span>${s.page ? `<span>Page <b>${s.page}</b> of the original portfolio</span>` : ''}</p>`
      : '';
    return `<section class="gallery-section${featured ? ' is-featured' : ''}" id="section-${p.id}-${i}" aria-labelledby="heading-${p.id}-${i}">
      <div class="gallery-heading">
        <div class="gallery-title">${badge}<h3 id="heading-${p.id}-${i}">${escapeHtml(s.title)}</h3></div>
        <span class="gallery-count">${s.images.length} visual</span>
      </div>
      ${meta}
      <div class="artwork-gallery">${galleryHtml(s, featured)}</div>
    </section>`;
  }

  function detailHtml(p, canStep) {
    const fi = featuredIndex(p);
    const order = [fi, ...p.sections.map((_, i) => i).filter(i => i !== fi)];
    const total = p.sections.reduce((n, s) => n + s.images.length, 0);
    return `<div class="detail-body collection-detail" data-cat="${p.id}" style="${palette(p)}">
      <p class="eyebrow"><span aria-hidden="true"></span>${escapeHtml(themeOf(p).label.toUpperCase())} · ${total} VISUALS</p>
      <h2 id="detail-title">${escapeHtml(p.title)}</h2>
      <p class="detail-desc">${escapeHtml(p.desc)}</p>
      <dl class="detail-meta">
        <div><dt>Collections</dt><dd>${p.sections.length}</dd></div>
        <div><dt>Visuals</dt><dd>${total}</dd></div>
        <div><dt>Format</dt><dd>${formatSummary(p)}</dd></div>
      </dl>
      <p class="detail-note">Select a visual to see it at full size. Resolution matches the images in the original portfolio.</p>
      <nav class="collection-jumps" aria-label="Collections in ${escapeHtml(p.title)}">${order.map(i => `<button type="button" data-section="section-${p.id}-${i}"><span>${escapeHtml(p.sections[i].title)}</span><small>${p.sections[i].images.length}</small></button>`).join('')}</nav>
      ${order.map(i => sectionHtml(p, p.sections[i], i, i === fi)).join('')}
      <div class="detail-actions"><button class="btn back" type="button">← Back to categories</button><button class="btn btn-solid next" type="button" ${canStep ? '' : 'disabled'}>Next category →</button></div>
    </div>`;
  }

  // Next moves only through the currently visible results.
  function openProject(p, returnEl) {
    const seq = visibleProjects();
    const idx = seq.indexOf(p);
    const next = seq.length > 1 ? seq[(idx + 1) % seq.length] : null;

    if (!modal.open) {
      state.lastFocus = returnEl || document.activeElement;
    }
    state.active = p;
    detailContent.innerHTML = detailHtml(p, Boolean(next));

    if (!modal.open) {
      modal.showModal();
      root.classList.add('modal-open');
    }
    modal.scrollTop = 0;
    $('.close', modal).focus({ preventScroll: true });

    $$('[data-section]', modal).forEach(btn => btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.section).scrollIntoView({ behavior: motionOn ? 'smooth' : 'instant', block: 'start' });
    }));
    $('.back', modal).addEventListener('click', closeDetail);
    const nextBtn = $('.next', modal);
    if (next) {
      nextBtn.addEventListener('click', () => {
        history.replaceState(history.state, '', `#project/${next.id}`);
        openProject(next);
      });
    }
  }

  // Idempotent cleanup: unlock scroll and return focus to the card that opened the dialog.
  function cleanupDetail() {
    root.classList.remove('modal-open');
    state.active = null;
    const back = state.lastFocus;
    state.lastFocus = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }

  function closeDetail() {
    if (!modal.open) return;
    if (history.state?.portfolioDetail) {
      history.back(); // popstate -> route() closes the dialog
    } else {
      history.replaceState(null, '', '#work');
      modal.close();
      cleanupDetail();
    }
  }

  // Backup path for native close; skipped if a new dialog has already opened.
  modal.addEventListener('close', () => {
    if (!modal.open) cleanupDetail();
  });

  modal.addEventListener('cancel', e => {
    e.preventDefault();
    closeDetail();
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) closeDetail(); // backdrop click
  });

  $('.close', modal).addEventListener('click', closeDetail);

  // The hero artwork opens its category gallery the same way a card does.
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-open]');
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const p = projects.find(item => item.id === link.dataset.open);
    if (!p) return;
    e.preventDefault();
    history.pushState({ portfolioDetail: true }, '', link.getAttribute('href'));
    openProject(p, link);
  });

  grid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const p = projects.find(item => item.id === card.dataset.id);
    history.pushState({ portfolioDetail: true }, '', card.getAttribute('href'));
    openProject(p, card);
  });

  function route() {
    const id = location.hash.startsWith('#project/') ? decodeURIComponent(location.hash.slice(9)) : null;
    const p = projects.find(item => item.id === id);
    if (p) {
      openProject(p);
      return;
    }
    // The browser may already have closed the dialog on Escape, so unlock either way.
    if (modal.open) modal.close();
    if (root.classList.contains('modal-open')) cleanupDetail();
  }
  window.addEventListener('popstate', route);

  /* ---------- Header navigation ---------- */
  function setMenu(open) {
    header.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  menuBtn.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('pointerdown', e => {
    if (header.classList.contains('menu-open') && !header.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });
  desktopQuery.addEventListener('change', e => { if (e.matches) setMenu(false); });

  /* ---------- Scroll progress line ---------- */
  // Cheap enough to run on every scroll event; max scroll is cached and refreshed on resize.
  let maxScroll = 0;
  function measure() {
    maxScroll = root.scrollHeight - window.innerHeight;
    // Lets the full-width strip stop at the scrollbar instead of running under it.
    root.style.setProperty('--sbw', `${window.innerWidth - root.clientWidth}px`);
  }

  // Marks the header link whose section crosses the reading line of the viewport.
  const spyItems = $$('.nav-pill a').map(link => ({ link, section: $(link.getAttribute('href')) }));
  // Glass glider that springs behind the current header link (hidden by CSS on mobile).
  const glider = document.createElement('span');
  glider.className = 'nav-glider';
  glider.setAttribute('aria-hidden', 'true');
  $('.nav-pill').prepend(glider);
  let gliderLink = null;
  function moveGlider(link) {
    gliderLink = link;
    glider.classList.toggle('on', !!link);
    if (!link) return;
    glider.style.width = `${link.offsetWidth}px`;
    glider.style.transform = `translateX(${link.offsetLeft}px)`;
  }
  // Re-measure whenever the pill or a link changes size (fonts, site text from Supabase, intro animation, resize).
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => moveGlider(gliderLink)); ro.observe($('.nav-pill')); spyItems.forEach(i => ro.observe(i.link)); }
  window.addEventListener('resize', () => moveGlider(gliderLink));
  window.addEventListener('load', () => moveGlider(gliderLink));
  function updateSpy(y) {
    const line = window.innerHeight * 0.45;
    let current = spyItems.find(({ section }) => {
      const box = section.getBoundingClientRect();
      return box.top <= line && box.bottom > line;
    });
    if (maxScroll > 0 && maxScroll - y < 4) current = spyItems[spyItems.length - 1];
    spyItems.forEach(item => {
      if (item === current) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    });
    const next = current ? current.link : null;
    if (next !== gliderLink) moveGlider(next);
  }

  function onScroll() {
    const y = window.scrollY;
    const progress = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0;
    progressBar.style.transform = `scaleY(${progress})`;
    updateSpy(y);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  let lastGalleryTarget = galleryTarget();
  window.addEventListener('resize', () => {
    measure();
    onScroll();
    const target = galleryTarget();
    if (target === lastGalleryTarget) return;
    lastGalleryTarget = target;
    if (modal.open && state.active) openProject(state.active);
  });

  /* ---------- Keyboard and page visibility ---------- */
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || modal.open) return;
    const el = document.activeElement;
    if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return;
    e.preventDefault();
    searchInput.focus();
  });

  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('tab-hidden', document.hidden);
  });

  /* ---------- Resume: timelines and the resume preview ---------- */
  const resume = window.RESUME;

  // Vertical timeline, oldest first (newest at the bottom); a year pill opens each new year and cards alternate sides.
  // side: 'left' or 'right' puts the line on that side with every card next to it.
  function timeline(items, f, side) {
    const sorted = [...items].sort((x, y) => x.start.localeCompare(y.start));
    let year = '';
    return `<div class="timeline${side ? ` timeline--line-${side}` : ''}"><span class="tl-line" aria-hidden="true"></span>${sorted.map((it, i) => {
      const y = it.start.slice(0, 4);
      const pill = y !== year ? `<div class="tl-year"><span>${y}</span></div>` : '';
      year = y;
      const text = f.text(it);
      return `${pill}<div class="tl-item${i % 2 ? ' is-right' : ''}"><article class="tl-card">
        <p class="tl-date">${escapeHtml(f.date(it))}</p>
        <h3 class="tl-title">${escapeHtml(f.title(it))}</h3>
        <p class="tl-org">${escapeHtml(f.sub(it))}</p>
        ${text ? `<p class="tl-text">${escapeHtml(text)}</p>` : ''}
        <span class="tl-dot" aria-hidden="true"></span></article></div>`;
    }).join('')}</div>`;
  }

  function renderResumeSections() {
    // Education: simple centred cards with the school logo (oldest first, like a school path).
    const cal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
    $('#education-list').innerHTML = `<div class="edu-grid">${[...resume.education].sort((x, y) => x.start.localeCompare(y.start)).map(x => `
      <article class="edu-item">
        ${x.logo ? `<div class="edu-logo">
          <img class="${x.logoDark ? 'on-light' : 'outline-dark'}" src="${x.logo}" alt="${escapeHtml(x.school)} logo" width="${x.logoW}" height="${x.logoH}" loading="lazy" decoding="async">
          ${x.logoDark ? `<img class="on-dark" src="${x.logoDark}" alt="${escapeHtml(x.school)} logo" width="${x.logoW}" height="${x.logoH}" loading="lazy" decoding="async">` : ''}
        </div>` : ''}
        <h3>${escapeHtml(x.school)}</h3>
        <p class="edu-award">${escapeHtml(x.award)}</p>
        <p class="edu-meta"><span>${escapeHtml(x.cgpa)}</span><span class="edu-date">${cal}${escapeHtml(x.date)}</span></p>
      </article>`).join('')}</div>`;
    $('#honors-list').innerHTML = timeline(resume.honors, {
      title: h => h.title, sub: h => h.org, date: h => h.date, text: h => h.points.join(' ') });
    $('#experience-grid').innerHTML = timeline([resume.current, ...(resume.experience || [])].filter(x => x && x.start), {
      title: x => x.role, sub: x => x.org, date: x => x.date, text: x => x.points.join(' ') });

    // Resume preview: a digital copy of resume.pdf (same sections, order and wording, no phone).
    const e = escapeHtml;
    const head = t => `<h3 class="rs-h">${t}</h3>`;
    const bullets = list => `<ul class="rs-bullets">${list.map(t => `<li>${t}</li>`).join('')}</ul>`;
    const item = (title, org, date, points) => `<div class="rs-entry"><div class="rs-entry-top"><h4>${e(title)}</h4><span>${e(date)}</span></div><p class="rs-org">${e(org)}</p>${bullets(points.map(e))}</div>`;
    const labelled = list => bullets(list.map(k => `<b>${e(k.name)}:</b> ${e(k.text || k.level)}`));
    $('#resume-sheet').innerHTML = `
      <div class="rs-page">
        <header class="rs-top">
          <img class="rs-photo" src="${resume.photo}" alt="Portrait of ${e(resume.name)}" width="306" height="305">
          <div class="rs-id">
            <h2>${e(resume.name)}</h2>
            <p>${e(resume.location)}</p>
            <p><a href="mailto:${resume.email}">${resume.email}</a></p>
            <p><a class="rs-link" href="${resume.linkedin}" target="_blank" rel="noopener">${resume.linkedinLabel}</a></p>
            <p class="rs-avail">${e(resume.availability)}</p>
          </div>
          <img class="rs-qr" src="${resume.qr}" alt="QR code for the LinkedIn profile" width="300" height="300">
        </header>
        <div class="rs-cols">
          <section>${head('Education')}${resume.education.map(x => `<div class="rs-edu"><h4>${e(x.school)}</h4><p>${e(x.award)}</p><p>${e(x.cgpa)}</p></div>`).join('')}</section>
          <section>${head('Interest')}${bullets(resume.interests.map(e))}</section>
        </div>
        <section>${head('Working, Curricular &amp; Leadership Experience')}${resume.experience.map(x => item(x.role, x.org, x.date, x.points)).join('')}</section>
      </div>
      <div class="rs-page">
        <section>${head('Awards &amp; Achievement')}${resume.honors.map(x => item(x.title, x.org, x.date, x.points)).join('')}</section>
        <section class="rs-inset">${head('Skills and Language Proficiency')}
          <h4 class="rs-sub">Soft Skills</h4>${labelled(resume.softSkills)}
          <h4 class="rs-sub">Technical Skills / Digital Skill</h4>${labelled(resume.technical)}
          <h4 class="rs-sub">Language</h4>${labelled(resume.languages)}
        </section>
        <section class="rs-inset">${head('References')}${bullets(resume.references.map(r => `<b>${e(r.name)}</b><span>${e(r.title)}</span><span>Email: ${e(r.email)}</span>`))}</section>
      </div>`;
  }

  const resumeDialog = $('#resume');
  let resumeReturn = null;
  function openResume(trigger) {
    resumeReturn = trigger;
    setMenu(false);
    resumeDialog.showModal();
    root.classList.add('modal-open');
    resumeDialog.scrollTop = 0;
    $('.resume-close', resumeDialog).focus({ preventScroll: true });
  }
  function resumeClosed() {
    if (!modal.open) root.classList.remove('modal-open');
    if (resumeReturn && resumeReturn.isConnected) resumeReturn.focus({ preventScroll: true });
    resumeReturn = null;
  }
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-resume]');
    if (trigger) openResume(trigger);
  });
  $('.resume-close', resumeDialog).addEventListener('click', () => { resumeDialog.close(); resumeClosed(); });
  resumeDialog.addEventListener('close', () => { if (resumeReturn) resumeClosed(); });

  /* ---------- Site text ---------- */
  const pick = path => path.split('.').reduce((o, k) => (o == null ? o : o[k]), site);
  const LEVELS = ['', 'Basic', 'Intermediate', 'Advanced'];

  function applySiteText(t) {
    $$('[data-c]').forEach(el => {
      const key = el.dataset.c;
      const value = key === 'footer.brand' ? `${t.brand.name}${t.brand.suffix}` : pick(key);
      if (typeof value === 'string') el.textContent = value;
    });
    // **words** become bold; everything else is escaped.
    $$('[data-c-rich]').forEach(el => {
      const value = pick(el.dataset.cRich);
      if (typeof value === 'string') el.innerHTML = escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br class="desktop"> ');
    });
    document.title = t.meta.title;
    $('meta[name="description"]').content = t.meta.description;
    searchInput.placeholder = t.hero.searchPlaceholder;

    const a = t.about;
    $('#about-languages').innerHTML = a.languages.map(l => `<li><span>${escapeHtml(l.name)}</span><small>${escapeHtml(l.level)}</small></li>`).join('');
    $('#about-software').innerHTML = a.software.map(s => {
      const level = Math.min(3, Math.max(1, Number(s.level) || 1));
      return `<li><span>${escapeHtml(s.name)}</span><small data-level="${level}">${LEVELS[level]}</small></li>`;
    }).join('');
    $('#about-fields').innerHTML = a.fields.map(f => `<li>${escapeHtml(f)}</li>`).join('');

    const c = t.contact;
    const mail = $('[data-contact="email"]');
    if (mail) mail.href = `mailto:${c.email}`;
    const li = $('[data-contact="linkedin"]');
    if (li) li.href = c.linkedin;
    const ig = $('[data-contact="instagram"]');
    if (ig) {
      const handle = String(c.instagram).replace(/^@/, '');
      ig.href = `https://www.instagram.com/${encodeURIComponent(handle)}`;
      ig.setAttribute('aria-label', `Instagram @${handle}`);
    }
    $('.resume-download').setAttribute('download', t.resume.pdfName);
  }

  /* ---------- Init ---------- */
  applySiteText(site);
  applyMotion();
  buildCards();
  buildMarquee();
  renderResumeSections();
  $$('[data-count]').forEach(el => {
    const key = el.dataset.count;
    el.textContent = key === 'all' ? projects.length : projects.filter(p => p.category === key).length;
  });
  render();
  observeTargets();
  measure();
  route();
  onScroll();
  }
})();
