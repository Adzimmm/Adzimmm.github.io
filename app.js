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
    themeBtn.setAttribute('aria-checked', String(theme === 'light')); // the switch is "on" in light (day) mode
    themeBtn.title = label;
    $('meta[name="theme-color"]').content = theme === 'light' ? '#faf9fc' : '#000000';
  }
  // The default theme and accent colours saved in the admin (site.theme); a visitor's own choice wins.
  const siteTheme = (window.SITE && window.SITE.theme) || {};
  let ownTheme = null;
  try { ownTheme = localStorage.getItem('adzim-theme'); } catch (_) {}
  if (ownTheme !== 'light' && ownTheme !== 'dark') root.dataset.theme = siteTheme.mode === 'light' ? 'light' : 'dark';
  if (window.applySiteColors) window.applySiteColors(siteTheme);
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

  const projects = window.PORTFOLIO_DATA.filter(p => !p.hidden); // hidden = draft folder from the admin page
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

  let litObserver = null; // set further down on touch screens
  function observeTargets() {
    if (litObserver) { litObserver.disconnect(); $$('.card.cyber, .tl-card').forEach(el => litObserver.observe(el)); }
    io.disconnect();
    $$('.card, .hero-visual, .marquee, .timeline').forEach(el => io.observe(el));
  }

  /* ---------- Cards ---------- */
  function palette(p) {
    const { color } = themeOf(p);
    return `--color:${color}`;
  }

  const visualCount = p => p.sections.reduce((n, s) => n + s.images.length, 0);

  // Text-and-icon cards (no artwork) in a 3D "cyber" style; the colour is the category accent.
  const fx = (cls, n) => `<span class="${cls}" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`;
  function buildCards() {
    grid.innerHTML = projects.map(p => `
      <a class="card cyber" href="#project/${p.id}" data-id="${p.id}" data-cat="${p.id}" style="${palette(p)}" aria-label="View ${escapeHtml(p.title)}">
        <div class="cy-folder">
        <span class="fd-back" aria-hidden="true"></span>
        <span class="fd-paper" aria-hidden="true"></span><span class="fd-paper" aria-hidden="true"></span><span class="fd-paper" aria-hidden="true"></span>
        <div class="fd-front">
        <svg class="fd-outline" aria-hidden="true" preserveAspectRatio="none"><path/></svg>
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
          </div>
        </div>
        </div>
        </div>
      </a>`).join('');
    $$('.card', grid).forEach(el => cards.set(el.dataset.id, el));
    shapeFolders();
  }

  // The folder front (tab + card) is one shape: the card is clipped to a folder outline and the same
  // path is stroked on top, so the outline is continuous and every card effect fills the tab too.
  function shapeFolders() {
    $$('.fd-front', grid).forEach(front => {
      const card = $('.cy-card', front);
      const svg = $('.fd-outline', front);
      const draw = () => {
        const w = card.offsetWidth, h = card.offsetHeight;
        if (!w || !h) return;
        const T = 16, R = 20, r = 10, rr = 14, f = 6, x = Math.round(w * 0.38);
        const d = `M0 ${T + R}A${R} ${R} 0 0 1 ${R} ${T}L${x - f} ${T}Q${x} ${T} ${x} ${T - f}L${x} ${r}A${r} ${r} 0 0 1 ${x + r} 0`
          + `L${w - rr} 0A${rr} ${rr} 0 0 1 ${w} ${rr}L${w} ${h - R}A${R} ${R} 0 0 1 ${w - R} ${h}L${R} ${h}A${R} ${R} 0 0 1 0 ${h - R}Z`;
        card.style.clipPath = `path('${d}')`;
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.firstChild.setAttribute('d', d);
      };
      draw();
      if (window.ResizeObserver) new ResizeObserver(draw).observe(card);
    });
  }

  // Touch screens: light up the card crossing the middle band of the screen (cards are attached in observeTargets).
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches && 'IntersectionObserver' in window) {
    litObserver = new IntersectionObserver(entries => entries.forEach(({ target, isIntersecting }) => target.classList.toggle('is-lit', isIntersecting)),
      { rootMargin: '-38% 0px -38% 0px' });
  }
  // Tilt the card toward the pointer (mouse only, and only when motion is on).
  const tiltTargets = [grid, $('#experience')].filter(Boolean);
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) tiltTargets.forEach(zone => {
    zone.addEventListener('pointermove', e => {
      const card = e.target.closest('.cyber, .tl-card');
      if (!card || root.dataset.motion !== 'on') return;
      const box = card.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width - 0.5;
      const y = (e.clientY - box.top) / box.height - 0.5;
      card.style.setProperty('--rx', `${(-y * 16).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    zone.addEventListener('pointerout', e => {
      const card = e.target.closest('.cyber, .tl-card');
      if (card && !card.contains(e.relatedTarget)) { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); }
    });
  });

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

  // The search lives in the hero. Enter (or the round button) opens the chatbox (chat.js) with the question,
  // and the project list goes back to showing everything. Without chat.js it jumps to the matching projects.
  $('.hero-search').addEventListener('submit', e => {
    e.preventDefault();
    if (window.PortfolioChat) {
      const question = searchInput.value.trim();
      searchInput.value = '';
      state.query = '';
      render({ interacted: true });
      window.PortfolioChat.open(question);
      return;
    }
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

  /* ---------- Project view: full screen under the header (project-view.js) ---------- */
  // app.js keeps the address (#project/<id>), the page lock and focus; project-view.js draws the panel.
  // The panel is a non-modal dialog under the site header, so the header stays visible and usable;
  // the rest of the page is made inert while it is open.
  const pageParts = [$('#main'), $('.site-footer')].filter(Boolean);
  function lockPage(on) {
    root.classList.toggle('modal-open', on);
    root.classList.toggle('pv-open', on);
    pageParts.forEach(el => { el.inert = on; });
  }

  // Next moves only through the currently visible results.
  function openProject(p, returnEl) {
    const seq = visibleProjects();
    const idx = seq.indexOf(p);
    const next = seq.length > 1 ? seq[(idx + 1) % seq.length] : null;
    const opening = !modal.open;
    if (opening) state.lastFocus = returnEl || document.activeElement;
    state.active = p;
    window.ProjectView.show(p, next && next !== p ? next : null);
    if (opening) {
      modal.show();
      lockPage(true);
      window.ProjectView.enter();
    }
  }

  // Idempotent cleanup: unlock the page and return focus to the card that opened the panel.
  function cleanupDetail() {
    lockPage(false);
    state.active = null;
    const back = state.lastFocus;
    state.lastFocus = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }

  // Plays the closing animation, then closes (Back, Escape and the browser's back button all end here).
  function hideDetail() {
    if (!modal.open || window.ProjectView.isLeaving()) return;
    window.ProjectView.leave(() => {
      modal.close();
      cleanupDetail();
    });
  }

  function closeDetail() {
    if (!modal.open) return;
    if (history.state?.portfolioDetail) {
      history.back(); // popstate -> route() hides the panel
    } else {
      history.replaceState(null, '', '#work');
      hideDetail();
    }
  }

  window.ProjectView.init({
    panel: modal,
    content: detailContent,
    escapeHtml,
    icon: p => ICON(FILTER_ICONS[p.icon] || FILTER_ICONS[p.id] || FILTER_ICONS.others),
    color: p => themeOf(p).color,
    label: p => themeOf(p).label,
    onClose: closeDetail,
    onNext: next => {
      history.replaceState(history.state, '', `#project/${next.id}`);
      openProject(next);
    },
  });

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
    if (modal.open) hideDetail();
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
  window.addEventListener('resize', () => {
    measure();
    onScroll();
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
        <span class="tl-fx" aria-hidden="true"><span class="cy-glare"></span>${fx('cy-lines', 4)}${fx('cy-glows', 3)}${fx('cy-particles', 6)}${fx('cy-corners', 4)}<span class="cy-scan"></span></span>
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
    // Awards & certificates: a plain list under Work, newest first.
    $('#honors-list').innerHTML = `<ul class="award-list">${[...resume.honors].sort((x, y) => String(y.start || '').localeCompare(String(x.start || ''))).map(h => `
      <li class="award-item">
        <p class="award-date">${escapeHtml(h.date)}</p>
        <div class="award-body">
          <h3 class="award-title">${escapeHtml(h.title)}</h3>
          <p class="award-org">${escapeHtml(h.org)}</p>
          ${(h.points || []).length ? `<p class="award-text">${escapeHtml(h.points.join(' '))}</p>` : ''}
        </div>
      </li>`).join('')}</ul>`;
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
    // The note about counted visits shows only while visits are counted (visit.js) and it has text.
    const privacy = $('.site-privacy');
    if (privacy) privacy.hidden = !privacy.textContent.trim() || !(window.SUPABASE && window.SUPABASE.visitUrl);
    // **words** become bold; everything else is escaped.
    $$('[data-c-rich]').forEach(el => {
      const value = pick(el.dataset.cRich);
      if (typeof value === 'string') el.innerHTML = escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br class="desktop"> ');
    });
    document.title = t.meta.title;
    // Favicon uploaded in the admin (round tab icons and a square home-screen icon); else the bundled ones stay.
    const fav = t.meta.favicon;
    if (fav && fav.icon) {
      // New link elements (not a changed href): browsers refresh the tab icon only for a new one.
      const swap = (link, href) => {
        if (!link || !href || link.href === href) return;
        const fresh = link.cloneNode();
        fresh.href = href;
        link.replaceWith(fresh);
      };
      $$('link[rel="icon"]').forEach(link => swap(link, String(link.sizes) === '512x512' ? (fav.large || fav.icon) : fav.icon));
      swap($('link[rel="apple-touch-icon"]'), fav.apple);
    }
    $('meta[name="description"]').content = t.meta.description;
    searchInput.placeholder = t.hero.searchPlaceholder;

    const a = t.about;
    $('#about-languages').innerHTML = a.languages.map(l => `<li><span>${escapeHtml(l.name)}</span><small>${escapeHtml(l.level)}</small></li>`).join('');
    $('#about-software').innerHTML = a.software.map(s => {
      const level = Math.min(3, Math.max(1, Number(s.level) || 1));
      return `<li><span>${escapeHtml(s.name)}</span><small data-level="${level}">${LEVELS[level]}</small></li>`;
    }).join('');
    $('#about-fields').innerHTML = a.fields.map(f => `<li>${escapeHtml(f)}</li>`).join('');
    // About photo: the cut-out uploaded in the admin (site.about.photo), else the bundled one.
    const photo = $('#about-photo');
    // The box behind the photo: colour, image, shader or animation chosen in the admin (backdrop.js).
    const card = $('.ah-card');
    if (card && window.AboutBackdrop) window.AboutBackdrop.render(card, a.backdrop);
    if (photo && a.photo && a.photo.src) {
      photo.src = a.photo.src;
      if (a.photo.width) photo.width = a.photo.width;
      if (a.photo.height) photo.height = a.photo.height;
    }

    renderSocials(t.contact);
    $('.resume-download').setAttribute('download', t.resume.pdfName);
  }

  /* ---------- Contact: social media icons (list edited in the admin, contact.socials) ---------- */
  // Brand icons come from socials.js; a custom link uses a Google Material Symbol chosen by name.
  function socialHref(item, c) {
    const url = String(item.url || '').trim();
    if (item.type === 'email') return `mailto:${url || c.email}`;
    if (item.type === 'instagram' && url && !/^https?:/i.test(url)) return `https://www.instagram.com/${encodeURIComponent(url.replace(/^@/, ''))}`;
    if (!url) return '';
    return /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
  }
  function renderSocials(c) {
    const box = $('#socials');
    if (!box) return;
    const P = window.SOCIALS || {};
    const list = Array.isArray(c.socials) ? c.socials : [
      { type: 'email' },
      c.linkedin && { type: 'linkedin', url: c.linkedin },
      c.instagram && { type: 'instagram', url: c.instagram },
    ].filter(Boolean);
    const symbols = new Set();
    box.innerHTML = list.map(item => {
      const href = socialHref(item, c);
      if (!href) return '';
      const brand = P[item.type];
      const custom = item.type === 'custom' || !brand;
      const name = custom ? (item.label || 'Link') : brand.name;
      const svgIcon = custom && item.svg && window.cleanSvg ? window.cleanSvg(item.svg) : '';
      const icon = svgIcon || (custom
        ? `<span class="material-symbols-rounded" aria-hidden="true">${escapeHtml((item.icon || 'link').trim().toLowerCase())}</span>`
        : `<svg viewBox="${brand.vb}" aria-hidden="true" ${brand.stroke ? 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"'}><path d="${brand.d}"/></svg>`);
      if (custom && !svgIcon) symbols.add((item.icon || 'link').trim().toLowerCase());
      const out = !href.startsWith('mailto:');
      return `<li><a class="soc soc-${custom ? 'custom' : escapeHtml(item.type)}" href="${escapeHtml(href)}"${out ? ' target="_blank" rel="noopener"' : ''} style="--brand:${custom ? 'var(--accent-purple)' : brand.color}" aria-label="${escapeHtml(name)}"><span class="soc-tip" aria-hidden="true">${escapeHtml(name)}</span>${icon}</a></li>`;
    }).join('');
    // Google's icon font, cut down to the icons in use (a few KB).
    if (symbols.size && !$('#material-symbols')) {
      const link = document.createElement('link');
      link.id = 'material-symbols';
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=${[...symbols].filter(n => /^[a-z0-9_]+$/.test(n)).sort().join(',')}&display=block`;
      document.head.append(link);
    }
  }

  /* ---------- About intro: plays once when it scrolls into view ----------
     Types "Hello I'm" -> the highlighter sweeps -> types the name -> the Figma cursor drags the pill in
     from off screen -> types the bio. Each typed line keeps its full size from the start (no jumping). */
  const aboutHero = $('.about-hero');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function typeIn(el, perChar) {
    const text = el.textContent;
    el.textContent = '';
    const ghost = document.createElement('span');
    ghost.className = 'tw-ghost';
    ghost.textContent = text;
    const live = document.createElement('span');
    live.className = 'tw-live';
    live.setAttribute('aria-hidden', 'true');
    const caret = document.createElement('i');
    caret.className = 'tw-caret';
    el.append(ghost, live);
    live.append(document.createTextNode(''), caret);
    el.classList.add('is-typing');
    return new Promise(resolve => {
      let n = 0;
      const step = () => {
        n++;
        live.firstChild.textContent = text.slice(0, n);
        if (n < text.length) setTimeout(step, perChar * (text[n - 1] === ' ' ? 0.6 : 1) * (0.75 + Math.random() * 0.5));
        else setTimeout(() => { el.classList.remove('is-typing'); el.classList.add('is-typed'); el.textContent = text; resolve(); }, 450);
      };
      setTimeout(step, perChar);
    });
  }
  async function playAbout() {
    if (aboutHero.dataset.played) return; // runs once, even if it is asked twice
    aboutHero.dataset.played = '1';
    if (root.dataset.motion === 'off') { aboutHero.classList.add('is-in', 's-hl', 's-pill', 's-done'); return; }
    aboutHero.classList.add('is-in', 's-typing');
    await wait(350);
    await typeIn($('.ah-hl', aboutHero), 95);
    aboutHero.classList.add('s-hl');
    await wait(500);
    await typeIn($('.ah-name', aboutHero), 120);
    aboutHero.classList.add('s-pill');
    await wait(1500);
    await typeIn($('.ah-body', aboutHero), 26);
    aboutHero.classList.add('s-done');
  }
  if (aboutHero) {
    if (!('IntersectionObserver' in window)) playAbout();
    else {
      const heroIo = new IntersectionObserver(entries => entries.forEach(e => {
        if (!e.isIntersecting) return;
        heroIo.disconnect();
        playAbout();
      }), { threshold: 0.35 });
      heroIo.observe(aboutHero);
    }
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
  if (window.PortfolioChat) window.PortfolioChat.init({
    site,
    projects,
    resume: window.RESUME || {},
    icon: p => ICON(FILTER_ICONS[p.icon] || FILTER_ICONS[p.id] || FILTER_ICONS.others),
    color: p => themeOf(p).color,
    label: p => themeOf(p).label,
  });
  route();
  onScroll();
  }
})();
