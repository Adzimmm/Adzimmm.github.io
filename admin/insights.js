// Insights tab of the admin page: who visits the site, when, from where and on which device.
// Each visit is a row in the Supabase table "visits" (supabase/insights.sql). The site's visit.js reports a
// page view to the Cloudflare Worker (worker/src/index.js), which adds the IP address, rough location and
// browser. Only the admin can read the rows. Times are shown in this browser's time zone.
// admin.js loads this file when the tab opens and calls mountInsights().

const RANGES = [
  { key: 'today', label: 'Today', days: 1, vs: 'the same hours yesterday' },
  { key: '7d', label: '7 days', days: 7, vs: 'the 7 days before' },
  { key: '30d', label: '30 days', days: 30, vs: 'the 30 days before' },
  { key: '90d', label: '90 days', days: 90, vs: 'the 90 days before' },
];
const COLS = 'id,seen_at,ip,country,region,city,isp,ua,model,os_version,touch,screen,lang,path,referrer,source';
const PREV_COLS = 'seen_at,ip,ua,screen,city'; // enough to count views and visitors of the period before
const PAGE = 1000; // Supabase answers at most 1000 rows per request
const MAX_ROWS = 20000;
const DAY = 864e5;
const SHOW = 25; // visits listed before "Show more"
const NOTRACK = 'adz:notrack'; // same key as ../visit.js
const RANGE_KEY = 'adz:insights-range';
const DOW = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

/* ---------- Formatting ---------- */
const num = n => Number(n).toLocaleString('en-US');
const plural = (n, word) => `${num(n)} ${word}${n === 1 ? '' : 's'}`;
const pct = (n, total) => (!total ? '0%' : n / total < 0.01 ? '<1%' : `${Math.round((n / total) * 100)}%`);
const hourName = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const hourShort = h => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
const hourSpan = h => `${hourName(h)} – ${hourName((h + 1) % 24)}`;
const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dateShort = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); // 12 Nov
const dateLong = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); // Tue 12 Nov
const clock = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); // 9:14 PM

function when(d, now) {
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const today = dayStart(now);
  if (d >= today) return `Today, ${clock(d)}`;
  if (d >= addDays(today, -1)) return `Yesterday, ${clock(d)}`;
  return `${dateShort(d)}, ${clock(d)}`;
}

/* ---------- Reading a visit ---------- */
// Same person = same IP address (or, once the address is cleared, same browser, screen and city).
const who = v => v.ip || [v.ua, v.screen, v.city].join('|');

const BROWSERS = [
  [/Instagram/, 'Instagram app'], [/FBAN|FBAV|FB_IAB|FBIOS/, 'Facebook app'], [/LinkedInApp/, 'LinkedIn app'],
  [/musical_ly|TikTok|BytedanceWebview/i, 'TikTok app'], [/Twitter/, 'X app'], [/Line\//, 'LINE app'], [/Snapchat/, 'Snapchat app'],
  [/GSA\//, 'Google app'], [/SamsungBrowser/, 'Samsung Internet'], [/EdgA?\/|EdgiOS|Edg\//, 'Edge'], [/OPR\/|OPiOS|Opera/, 'Opera'],
  [/Firefox|FxiOS/, 'Firefox'], [/CriOS|Chrome\//, 'Chrome'], [/Safari\//, 'Safari'],
];
const PHONE_BRANDS = [
  [/^SM-/i, 'Samsung'], [/^Pixel/i, 'Google'], [/^CPH/i, 'OPPO'], [/^RMX/i, 'realme'], [/^V\d{4}/, 'vivo'],
  [/^(Redmi|POCO|M\d{4}[A-Z]|\d{5,}[A-Z])/i, 'Xiaomi'],
];

function phoneName(model) {
  const m = String(model || '').trim();
  if (!m || m === 'K') return ''; // "K": the browser hides the model
  const brand = (PHONE_BRANDS.find(([re]) => re.test(m)) || [])[1];
  return brand && !m.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${m}` : m;
}

function deviceOf(v) {
  const ua = v.ua || '';
  const iosVer = (ua.match(/OS (\d+)[_.](\d+)/) || []).slice(1, 3).join('.');
  let os = 'Other';
  let ver = '';
  if (/iPhone|iPod/.test(ua)) { os = 'iOS'; ver = iosVer; }
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && v.touch)) { os = 'iPadOS'; ver = iosVer || (ua.match(/Version\/(\d+(?:\.\d+)?)/) || [])[1] || ''; }
  else if (/Android/.test(ua)) { os = 'Android'; ver = String(v.os_version || '').split('.')[0] || (ua.match(/Android (\d+)/) || [])[1] || ''; }
  else if (/Windows NT/.test(ua)) { os = 'Windows'; ver = v.os_version ? (parseInt(v.os_version, 10) >= 13 ? '11' : '10') : ''; }
  else if (/Macintosh|Mac OS X/.test(ua)) { os = 'macOS'; ver = v.os_version ? v.os_version.split('.').slice(0, 2).join('.').replace(/\.0$/, '') : ''; }
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  const browser = (BROWSERS.find(([re]) => re.test(ua)) || [])[1] || 'Other';
  const type = os === 'iPadOS' || /Tablet/i.test(ua) || (os === 'Android' && !/Mobile/.test(ua)) ? 'Tablet'
    : os === 'iOS' || os === 'Android' || /Mobi/.test(ua) ? 'Mobile' : 'Desktop';
  const name = { iOS: 'iPhone', iPadOS: 'iPad', macOS: 'Mac', Windows: 'Windows PC', ChromeOS: 'Chromebook', Linux: 'Linux PC' }[os]
    || (os === 'Android' ? phoneName(v.model) || (type === 'Tablet' ? 'Android tablet' : 'Android phone') : 'Other device');
  return { type, os, system: ver ? `${os} ${ver}` : os, browser, name };
}

const SOURCES = [
  [/(^|\.)instagram\.com$/, 'Instagram'], [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'], [/(^|\.)facebook\.com$|^fb\.me$/, 'Facebook'],
  [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, 'X'], [/(^|\.)threads\.(net|com)$/, 'Threads'], [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)yahoo\.com$/, 'Yahoo'],
  [/(^|\.)behance\.net$/, 'Behance'], [/(^|\.)dribbble\.com$/, 'Dribbble'], [/(^|\.)github\.(com|io)$/, 'GitHub'],
  [/(^|\.)whatsapp\.(com|net)$|^wa\.me$/, 'WhatsApp'], [/^t\.me$|(^|\.)telegram\.org$/, 'Telegram'], [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'],
  [/(^|\.)pinterest\.[a-z.]+$/, 'Pinterest'], [/(^|\.)jobstreet\.[a-z.]+$/, 'JobStreet'], [/(^|\.)canva\.(com|site)$/, 'Canva'],
];

function sourceOf(v, browser) {
  if (v.source) return v.source.charAt(0).toUpperCase() + v.source.slice(1); // utm_source of the link
  let host = '';
  try { host = v.referrer ? new URL(v.referrer).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
  if (host) return (SOURCES.find(([re]) => re.test(host)) || [])[1] || host;
  if (/ app$/.test(browser) && browser !== 'Google app') return browser.replace(/ app$/, ''); // opened inside that app
  return 'Direct';
}

let regionNames;
function countryName(code) {
  if (!code || code === 'XX') return 'Unknown';
  if (code === 'T1') return 'Tor network';
  try {
    regionNames = regionNames || new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code) || code;
  } catch { return code; }
}
const flag = code => (/^[A-Z]{2}$/.test(code || '') && code !== 'XX'
  ? String.fromCodePoint(...[...code].map(c => 0x1F1A5 + c.charCodeAt(0))) : '');
const countryLabel = code => [flag(code), countryName(code)].filter(Boolean).join(' ');
const place = v => [v.city || v.region, countryName(v.country)].filter(Boolean).join(', ');

// Network owners as people know them.
const ISPS = [
  [/TT DOTCOM|TIME DOTCOM/i, 'TIME'], [/TM TECHNOLOGY|TELEKOM MALAYSIA|\bTM NET\b|\bTMNET\b/i, 'Unifi (TM)'],
  [/CELCOM|\bDIGI\b/i, 'CelcomDigi'], [/\bMAXIS\b/i, 'Maxis'], [/\bU MOBILE\b/i, 'U Mobile'], [/\bYTL\b/i, 'Yes (YTL)'],
];
const ispName = s => (!s ? '' : (ISPS.find(([re]) => re.test(s)) || [])[1]
  || s.replace(/[,.]?\s*\b(SDN\.?\s*BHD|BERHAD|BHD|INC|LLC|LTD|LIMITED|PLC|CORP(ORATION)?)\b\.?/gi, '').trim() || s);

function enrich(v) {
  const dev = deviceOf(v);
  return { ...v, at: new Date(v.seen_at), dev, src: sourceOf(v, dev.browser) };
}

/* ---------- Numbers for the charts ---------- */
function bounds(key) {
  const r = RANGES.find(x => x.key === key);
  const now = new Date();
  const start = addDays(dayStart(now), -(r.days - 1));
  return {
    start,
    end: new Date(now.getTime() + 60000), // a minute ahead, in case the database clock runs ahead
    prevStart: addDays(start, -r.days),
    prevEnd: new Date(now.getTime() - r.days * DAY), // the same point in the period before
  };
}

function tally(rows, fn) {
  const m = new Map();
  rows.forEach(v => { const k = fn(v); if (k) m.set(k, (m.get(k) || 0) + 1); });
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function peaks(rows) {
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0)); // Monday first
  rows.forEach(v => { heat[(v.at.getDay() + 6) % 7][v.at.getHours()] += 1; });
  const byHour = Array.from({ length: 24 }, (_, hr) => heat.reduce((s, row) => s + row[hr], 0));
  const byDay = heat.map(row => row.reduce((a, b) => a + b, 0));
  const top = list => list.indexOf(Math.max(...list));
  let cell = [0, 0];
  heat.forEach((row, d) => row.forEach((n, hr) => { if (n > heat[cell[0]][cell[1]]) cell = [d, hr]; }));
  return { heat, hour: top(byHour), hourViews: byHour[top(byHour)], day: top(byDay), cell };
}

// Views per hour (today) or per day; 90 days are grouped in weeks so each bar stays readable.
function series(rows, key, start) {
  if (key === 'today') {
    const s = Array.from({ length: 24 }, (_, hr) => ({ n: 0, people: new Set(), label: hourSpan(hr), axis: hr % 6 ? '' : hourName(hr) }));
    rows.forEach(v => { const x = s[v.at.getHours()]; x.n += 1; x.people.add(who(v)); });
    return { bars: s, daily: s };
  }
  const days = RANGES.find(x => x.key === key).days;
  const daily = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    return { n: 0, people: new Set(), date, label: dateLong(date), axis: '' };
  });
  rows.forEach(v => {
    const x = daily[Math.round((dayStart(v.at) - start) / DAY)];
    if (x) { x.n += 1; x.people.add(who(v)); }
  });
  if (days <= 30) {
    const every = days <= 7 ? 1 : 5;
    daily.forEach((x, i) => {
      const fromEnd = days - 1 - i;
      if (fromEnd % every) return;
      x.axis = fromEnd === 0 ? 'Today' : days <= 7 ? x.date.toLocaleDateString('en-GB', { weekday: 'short' }) : dateShort(x.date);
    });
    return { bars: daily, daily };
  }
  const weeks = [];
  for (let i = daily.length; i > 0; i -= 7) { // from today backwards, so the newest week is whole
    const part = daily.slice(Math.max(0, i - 7), i);
    const first = part[0].date;
    const last = part[part.length - 1].date;
    weeks.unshift({
      n: part.reduce((s, x) => s + x.n, 0),
      people: new Set(part.flatMap(x => [...x.people])),
      label: `Week of ${dateShort(first)} – ${dateShort(last)}`,
      axis: '',
      first,
    });
  }
  weeks.forEach((w, i) => { if ((weeks.length - 1 - i) % 3 === 0) w.axis = dateShort(w.first); });
  return { bars: weeks, daily };
}

// Round axis steps (1, 2, 5, 10, 20, 50…) with about four lines.
function niceTicks(max) {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw));
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/* ---------- Tooltip shared by the charts (hover, tap and arrow keys) ---------- */
let tip;
function showTip(lines, rect) {
  if (!tip || !tip.isConnected) {
    tip = document.createElement('div');
    tip.className = 'viz-tip';
    tip.setAttribute('aria-live', 'polite');
    document.body.append(tip);
  }
  tip.replaceChildren(...lines.map((text, i) => { const el = document.createElement(i ? 'span' : 'b'); el.textContent = text; return el; }));
  tip.hidden = false;
  const x = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, rect.left + rect.width / 2 - tip.offsetWidth / 2));
  const y = rect.top - tip.offsetHeight - 8;
  tip.style.left = `${x}px`;
  tip.style.top = `${y >= 8 ? y : rect.bottom + 8}px`;
}
function hideTip() { if (tip) tip.hidden = true; }
window.addEventListener('scroll', hideTip, { passive: true });

function bindHover(box, marks, text, anchor, { cols = 0, start = 0 } = {}) {
  let at = -1;
  let timer;
  const set = i => {
    if (at >= 0 && marks[at]) marks[at].classList.remove('is-active');
    at = i;
    if (i < 0) { hideTip(); return; }
    marks[i].classList.add('is-active');
    showTip(text(i), anchor(i).getBoundingClientRect());
  };
  marks.forEach((m, i) => m.addEventListener('pointerenter', e => {
    set(i);
    clearTimeout(timer);
    if (e.pointerType !== 'mouse') timer = setTimeout(() => set(-1), 2500); // a tap has no "leave"
  }));
  box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') set(-1); });
  box.addEventListener('focus', () => set(at >= 0 ? at : start));
  box.addEventListener('blur', () => set(-1));
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') { set(-1); return; }
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -1e6, End: 1e6 }[e.key];
    if (!step) return;
    e.preventDefault();
    set(Math.max(0, Math.min(marks.length - 1, (at < 0 ? start : at) + step)));
  });
}

/* ---------- The tab ---------- */
export function mountInsights(root, { h, ico, card, switchField, ask, toast, sb, DEMO }) {
  const saved = store.get(RANGE_KEY);
  const st = {
    range: RANGES.some(r => r.key === saved) ? saved : '30d',
    rows: null, prev: [], capped: false, error: '', busy: false, at: null,
    ip: null, shown: SHOW,
  };
  const head = h('div', { class: 'ins-filters' });
  const body = h('div', { class: 'ins-body' }, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Loading visits…'));
  const visitorsBox = h('div', { class: 'ins-visitors' });
  root.replaceChildren(head, body);
  load();

  async function load() {
    st.busy = true;
    drawFilters();
    if (st.rows) body.classList.add('is-loading'); // keep the last numbers on screen while refreshing
    const b = bounds(st.range);
    try {
      if (DEMO) {
        const all = demoRows();
        st.rows = all.filter(v => v.at >= b.start && v.at < b.end);
        st.prev = all.filter(v => v.at >= b.prevStart && v.at < b.prevEnd);
      } else {
        const [rows, prev] = await Promise.all([fetchRows(COLS, b.start, b.end), fetchRows(PREV_COLS, b.prevStart, b.prevEnd)]);
        st.rows = rows.map(enrich);
        st.prev = prev;
      }
      st.capped = st.rows.length >= MAX_ROWS;
      st.error = '';
    } catch (err) {
      st.error = err.message || String(err);
    }
    st.busy = false;
    st.at = new Date();
    body.classList.remove('is-loading');
    draw();
  }

  async function fetchRows(cols, from, to) {
    const out = [];
    for (let i = 0; i < MAX_ROWS; i += PAGE) {
      const { data, error } = await sb.from('visits').select(cols)
        .gte('seen_at', from.toISOString()).lt('seen_at', to.toISOString())
        .order('seen_at', { ascending: false }).range(i, i + PAGE - 1);
      if (error) throw new Error(error.message);
      out.push(...data);
      if (data.length < PAGE) break;
    }
    return out;
  }

  function drawFilters() {
    head.replaceChildren(
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Time range' }, RANGES.map(r => h('button', {
        type: 'button',
        'aria-pressed': String(r.key === st.range),
        onclick: () => {
          if (r.key === st.range || st.busy) return;
          Object.assign(st, { range: r.key, ip: null, shown: SHOW });
          store.set(RANGE_KEY, r.key);
          load();
        },
      }, r.label))),
      h('button', { class: 'btn small ghost', type: 'button', disabled: st.busy, onclick: () => load() }, ico('refresh'), st.busy ? 'Loading…' : 'Refresh'),
      h('span', { class: 'ins-updated' }, st.at ? `Updated ${clock(st.at)}` : ''));
  }

  function draw() {
    drawFilters();
    if (st.error) {
      const missing = /visits|relation|schema cache/i.test(st.error);
      body.replaceChildren(card('Insights could not load',
        missing ? 'Visitor counting is not set up in Supabase yet: run supabase/insights.sql.' : 'Check your connection, then press Refresh.',
        h('p', { class: 'muted' }, st.error)));
      return;
    }
    const r = RANGES.find(x => x.key === st.range);
    const rows = st.rows;
    const total = rows.length;
    const today = st.range === 'today';
    const p = peaks(rows);
    const types = tally(rows, v => v.dev.type);
    const visitorsNow = new Set(rows.map(who)).size;
    const kpis = h('div', { class: 'stats' },
      stat('Views', num(total), delta(total, st.prev.length, r.vs), 'Each time your site is opened. A refresh is not counted again.'),
      stat('Visitors', num(visitorsNow), delta(visitorsNow, new Set(st.prev.map(who)).size, r.vs), 'Different people, told apart by IP address.'),
      stat('Busiest hour', total ? hourName(p.hour) : '–',
        h('span', { class: 'stat-sub' }, !total ? 'No visits yet' : today ? `${hourSpan(p.hour)} · ${plural(p.hourViews, 'view')}` : `Busiest day: ${DOW[p.day]}`)),
      stat('Mostly on', types[0] ? types[0][0] : '–', h('span', { class: 'stat-sub' }, types[0] ? `${pct(types[0][1], total)} of views` : 'No visits yet')));

    if (!total) {
      body.replaceChildren(kpis,
        card('No visits yet', '', h('p', { class: 'muted' }, today ? 'Nobody has opened your site today yet. ' : 'Nobody opened your site in this period. ',
          'A new visit shows here a few seconds after someone opens your site: press Refresh to check.')),
        ownCard());
      return;
    }

    const { bars, daily } = series(rows, st.range, bounds(st.range).start);
    const best = daily.reduce((a, x) => (x.n > a.n ? x : a), daily[0]);
    const timeCard = card(today ? 'Views today' : st.range === '90d' ? 'Views per week' : 'Views per day',
      today ? `Busiest so far: ${best.label}, ${plural(best.n, 'view')}.` : `Busiest day: ${best.label}, ${plural(best.n, 'view')}.`,
      columns(bars),
      tableView([today ? 'Hour' : st.range === '90d' ? 'Week' : 'Day', 'Views', 'Visitors'], [...bars].reverse().map(x => [x.label, num(x.n), num(x.people.size)])));

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const heatCard = today ? null : card('Busiest times',
      `Most views on ${DOW[p.day]}s and around ${hourName(p.hour)}. A stronger colour means more views. Times are in your time zone (${tz}).`,
      heatmap(p),
      tableView(['Hour', ...DOW.map(d => d.slice(0, 3))], p.heat[0].map((_, hr) => [hourSpan(hr), ...p.heat.map(row => num(row[hr]))])));

    const typeIcon = t => ico(t === 'Mobile' ? 'phone' : t === 'Tablet' ? 'tablet' : 'desktop');
    const grid = h('div', { class: 'ins-grid' },
      card('Devices', '', meters(types, total, typeIcon)),
      card('Systems', '', meters(tally(rows, v => v.dev.os), total)),
      card('Browsers', '“App” means it was opened inside that app.', meters(tally(rows, v => v.dev.browser), total)),
      card('Countries', '', meters(tally(rows, v => countryLabel(v.country)), total)),
      card('Cities', '', meters(tally(rows, v => (v.city ? [flag(v.country), v.city].filter(Boolean).join(' ') : 'Unknown')), total)),
      card('Sources', '“Direct” means a typed or saved link, WhatsApp, email and the like.', meters(tally(rows, v => v.src), total)));

    drawVisitors();
    body.replaceChildren(...[kpis, timeCard, heatCard, grid, visitorsBox, ownCard(),
      st.capped ? h('p', { class: 'muted' }, `Only the newest ${num(MAX_ROWS)} visits are shown.`) : null].filter(Boolean));
  }

  function stat(label, value, extra, hint) {
    return h('div', { class: 'stat', title: hint }, h('span', { class: 'stat-label' }, label), h('b', { class: 'stat-value' }, value), extra);
  }

  function delta(cur, prev, vs) {
    if (!prev) return cur ? h('span', { class: 'stat-delta' }, `None in ${vs}`) : null;
    const change = Math.round(((cur - prev) / prev) * 100);
    if (!change) return h('span', { class: 'stat-delta' }, `Same as ${vs}`);
    const up = change > 0;
    return h('span', { class: `stat-delta ${up ? 'up' : 'down'}` }, `${up ? '▲' : '▼'} ${Math.abs(change)}% vs ${vs}`);
  }

  // Column chart: one bar per hour, day or week; the tallest bar carries its number.
  function columns(s) {
    const max = Math.max(0, ...s.map(x => x.n));
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1];
    const peakAt = max ? s.findIndex(x => x.n === max) : -1;
    const slots = s.map((x, i) => h('div', { class: 'cc-slot' },
      x.n ? h('i', { class: 'cc-bar', style: `height:${(x.n / top) * 100}%` }, i === peakAt ? h('b', { class: 'cc-peak' }, num(x.n)) : null) : null));
    const plot = h('div', { class: 'cc-plot', tabindex: '0', role: 'group', 'aria-label': 'Views chart. Use the arrow keys to read each bar.' },
      h('div', { class: 'cc-grid', 'aria-hidden': 'true' }, ticks.map(t => h('span', { style: `bottom:${(t / top) * 100}%` }, h('em', {}, num(t))))),
      h('div', { class: 'cc-bars', style: `--n:${s.length}` }, slots));
    bindHover(plot, slots, i => [`${plural(s[i].n, 'view')} · ${plural(s[i].people.size, 'visitor')}`, s[i].label],
      i => slots[i].firstChild || slots[i], { start: s.length - 1 });
    return h('div', { class: 'cc' }, plot, h('div', { class: 'cc-axis', 'aria-hidden': 'true', style: `--n:${s.length}` }, s.map(x => h('span', {}, x.axis))));
  }

  // Heatmap: 7 days × 24 hours, one hue, more views = stronger colour. The busiest hour has a ring.
  function heatmap(p) {
    const max = Math.max(...p.heat.flat());
    const cells = [];
    const grid = h('div', { class: 'hm', tabindex: '0', role: 'group', 'aria-label': 'Views by day and hour. Use the arrow keys to read each hour.' });
    p.heat.forEach((row, d) => {
      grid.append(h('span', { class: 'hm-day', 'aria-hidden': 'true' }, DOW[d].slice(0, 3)));
      row.forEach((n, hr) => {
        const peak = n > 0 && d === p.cell[0] && hr === p.cell[1];
        const cell = h('i', { class: `hm-cell${peak ? ' is-peak' : ''}`, 'data-l': String(n ? Math.max(1, Math.ceil((n / max) * 5)) : 0) });
        cells.push(cell);
        grid.append(cell);
      });
    });
    grid.append(h('span', { 'aria-hidden': 'true' }),
      ...Array.from({ length: 24 }, (_, hr) => h('span', { class: 'hm-hour', 'aria-hidden': 'true' }, hr % 3 ? '' : hourShort(hr))));
    bindHover(grid, cells, i => [plural(p.heat[Math.floor(i / 24)][i % 24], 'view'), `${DOW[Math.floor(i / 24)]}s, ${hourSpan(i % 24)}`],
      i => cells[i], { cols: 24, start: p.cell[0] * 24 + p.cell[1] });
    return h('div', { class: 'hm-wrap' }, grid,
      h('div', { class: 'hm-legend', 'aria-hidden': 'true' }, h('span', {}, 'Fewer'), [1, 2, 3, 4, 5].map(l => h('i', { class: 'hm-cell', 'data-l': String(l) })), h('span', {}, 'More')));
  }

  // Ranked list: name, count and share, with a bar for the share. More than 6 rows fold into "Other".
  function meters(entries, total, icon) {
    if (!entries.length) return h('p', { class: 'empty' }, 'No data yet.');
    const list = entries.length > 6 ? [...entries.slice(0, 5), ['Other', entries.slice(5).reduce((s, e) => s + e[1], 0)]] : entries;
    return h('ol', { class: 'meters' }, list.map(([name, n]) => h('li', {},
      h('span', { class: 'meter-name' }, icon && name !== 'Other' ? icon(name) : null, h('span', { title: name }, name)),
      h('span', { class: 'meter-val' }, num(n), h('small', {}, pct(n, total))),
      h('span', { class: 'meter-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(1.5, (n / total) * 100)}%` })))));
  }

  function tableView(cols, rows) {
    return h('details', { class: 'viz-table' }, h('summary', {}, 'Show as table'),
      h('div', { class: 'viz-table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, cols.map(c => h('th', { scope: 'col' }, c)))),
        h('tbody', {}, rows.map(r => h('tr', {}, r.map((c, i) => (i ? h('td', {}, c) : h('th', { scope: 'row' }, c)))))))));
  }

  function drawVisitors() {
    const rows = st.rows;
    const counts = new Map();
    rows.forEach(v => counts.set(who(v), (counts.get(who(v)) || 0) + 1));
    const list = st.ip ? rows.filter(v => who(v) === st.ip) : rows;
    const shown = list.slice(0, st.shown);
    const now = new Date();
    const pick = v => {
      Object.assign(st, { ip: who(v), shown: SHOW });
      drawVisitors();
      visitorsBox.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    const filter = st.ip && list.length ? h('div', { class: 'vt-filter' },
      h('span', {}, `${plural(list.length, 'visit')} from `, h('b', {}, list[0].ip || 'this visitor'), ` · ${list[0].dev.name}, ${place(list[0])}`),
      h('button', { class: 'btn small', type: 'button', onclick: () => { Object.assign(st, { ip: null, shown: SHOW }); drawVisitors(); } }, ico('close'), 'Show everyone'),
      h('button', { class: 'btn small danger', type: 'button', onclick: () => removeVisitor(list[0]) }, ico('trash'), 'Delete these visits')) : null;
    const table = h('table', { class: 'vt' },
      h('thead', {}, h('tr', {}, ['When', 'IP address', 'Location', 'Device', 'Source'].map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, shown.map(v => visitRow(v, counts.get(who(v)), now, pick))));
    const more = list.length > shown.length
      ? h('button', { class: 'btn small vt-more', type: 'button', onclick: () => { st.shown += 50; drawVisitors(); } }, `Show more (${num(list.length - shown.length)} left)`)
      : null;
    visitorsBox.replaceChildren(card('Visitors', st.ip ? '' : 'Newest first. Click an IP address to see only that visitor.',
      ...[filter, h('div', { class: 'vt-wrap' }, table), more].filter(Boolean)));
  }

  function visitRow(v, count, now, pick) {
    const d = v.dev;
    return h('tr', {},
      h('td', { class: 'vt-when', title: v.at.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }) }, when(v.at, now)),
      h('td', { class: 'vt-ip' },
        v.ip ? h('button', { class: 'ip-btn', type: 'button', title: 'Show only this visitor', onclick: () => pick(v) }, v.ip)
          : h('span', { class: 'muted' }, 'Cleared after 90 days'),
        count > 1 ? h('span', { class: 'count' }, `${count} visits`) : null),
      h('td', { class: 'vt-loc', title: [v.city, v.region, countryName(v.country)].filter(Boolean).join(', ') },
        h('span', {}, [flag(v.country), place(v)].filter(Boolean).join(' ')),
        v.isp ? h('small', { title: v.isp }, ispName(v.isp)) : null),
      h('td', { class: 'vt-dev', title: v.ua || '' },
        h('span', { class: 'dev-line' }, ico(d.type === 'Mobile' ? 'phone' : d.type === 'Tablet' ? 'tablet' : 'desktop'), h('span', {}, d.name)),
        h('small', {}, [d.system, d.browser, v.screen && v.screen.replace('x', ' × ')].filter(Boolean).join(' · '))),
      h('td', { class: 'vt-src' }, h('span', { class: 'vt-src-pre' }, 'From '), v.src));
  }

  async function removeVisitor(v) {
    const key = who(v);
    const ok = await ask({
      title: `Delete every visit from ${v.ip || 'this visitor'}?`,
      text: 'Use this for your own or test visits. They are removed from Insights for good.',
      ok: 'Delete', danger: true,
    });
    if (!ok) return;
    if (DEMO) {
      demoCache = demoCache.filter(x => who(x) !== key);
      toast('Demo mode: removed on this page only.');
    } else {
      const q = sb.from('visits').delete();
      const ids = st.rows.filter(x => who(x) === key).map(x => x.id);
      const { data, error } = await (v.ip ? q.eq('ip', v.ip) : q.in('id', ids)).select('id');
      if (error) { toast(`Could not delete: ${error.message}`, true); return; }
      toast(`Deleted ${plural(data.length, 'visit')}.`);
    }
    Object.assign(st, { ip: null, shown: SHOW });
    load();
  }

  function ownCard() {
    const site = new URL('../', location.href);
    const link = `${site.origin}${site.pathname}?notrack`;
    const hint = on => (on ? 'Your visits from this browser are counted like everyone else’s.' : 'Your visits from this browser are not counted.');
    const counted = store.get(NOTRACK) !== '1';
    const sw = switchField('Count my visits on this browser', counted, on => { store.set(NOTRACK, on ? '0' : '1'); sw.setHint(hint(on)); });
    sw.setHint(hint(counted));
    return card('Your own visits', 'Keep your own visits out of the numbers.',
      sw.el,
      h('p', { class: 'notice faq-note' }, ico('info'), h('span', {},
        'On your phone or another computer, open ', h('a', { href: link, target: '_blank', rel: 'noopener' }, link.replace(/^https?:\/\//, '')),
        ' once. That device is then not counted either.')),
      h('p', { class: 'muted ins-privacy' }, 'Only you can see these numbers. IP addresses are cleared after 90 days and visits are deleted after 13 months. Bots and link previews are not counted.'));
  }
}

/* ---------- Demo mode: made-up visits (IP addresses from the ranges kept for examples) ---------- */
let demoCache;
function demoRows() {
  if (demoCache) return demoCache;
  let seed = 20261118;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = list => {
    let r = rand() * list.reduce((s, x) => s + x[0], 0);
    for (const x of list) { r -= x[0]; if (r <= 0) return x; }
    return list[0];
  };
  const IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 356.0.0.37.97';
  const DEVICES = [ // weight, user agent, screen, model, system version, touch
    [15, IG, '393x852', '', '', true],
    [16, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', '390x844', '', '', true],
    [16, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', '412x915', 'SM-A546E', '14.0.0', true],
    [5, 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36', '384x854', 'SM-S918B', '', true],
    [13, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', '1920x1080', '', '15.0.0', false],
    [8, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', '1512x982', '', '', false],
    [4, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/486.0.0.0;]', '393x873', 'Pixel 8', '15.0.0', true],
    [3, 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1', '820x1180', '', '', true],
    [5, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1', '430x932', '', '', true],
  ];
  const PLACES = [ // weight, city, region, country, network
    [22, 'Kuala Lumpur', 'Kuala Lumpur', 'MY', 'TM TECHNOLOGY SERVICES SDN. BHD.'],
    [16, 'Shah Alam', 'Selangor', 'MY', 'Celcom Axiata Berhad'],
    [10, 'Petaling Jaya', 'Selangor', 'MY', 'Maxis Broadband Sdn Bhd'],
    [8, 'Johor Bahru', 'Johor', 'MY', 'DiGi Telecommunications Sdn. Bhd.'],
    [7, 'Kota Bharu', 'Kelantan', 'MY', 'TT DOTCOM SDN BHD'],
    [6, 'George Town', 'Penang', 'MY', 'TM TECHNOLOGY SERVICES SDN. BHD.'],
    [5, 'Putrajaya', 'Putrajaya', 'MY', 'U Mobile Sdn Bhd'],
    [4, 'Singapore', 'Singapore', 'SG', 'Singtel'],
    [3, 'Jakarta', 'Jakarta', 'ID', 'PT Telkom Indonesia'],
    [2, 'London', 'England', 'GB', 'British Telecommunications PLC'],
  ];
  const REFS = [[30, ''], [26, 'https://l.instagram.com/'], [14, 'https://www.linkedin.com/'], [10, 'https://www.google.com/'], [4, 'https://www.behance.net/'], [3, 'https://t.co/']];
  const HOURS = [3, 2, 1, 1, 1, 1, 2, 4, 6, 7, 8, 8, 10, 10, 8, 7, 7, 8, 10, 13, 16, 17, 14, 8].map((w, hr) => [w, hr]);
  const WEEK = [1.1, 1.25, 1.15, 1.05, 0.95, 0.8, 0.9]; // Monday first
  const NETS = ['192.0.2.', '198.51.100.', '203.0.113.'];
  const people = [];
  const rows = [];
  const now = new Date();
  for (let ago = 0; ago < 180; ago++) {
    const day = addDays(dayStart(now), -ago);
    const spike = ago === 9 ? 3.5 : ago === 23 ? 2.2 : 1;
    const expected = (3 + 7 * (1 - ago / 180)) * WEEK[(day.getDay() + 6) % 7] * spike;
    const n = Math.max(0, Math.round(expected + (rand() - 0.5) * 4));
    for (let k = 0; k < n; k++) {
      const at = new Date(day);
      at.setHours(pick(HOURS)[1], Math.floor(rand() * 60), Math.floor(rand() * 60));
      if (at > now) continue;
      let person = people.length && rand() < 0.3 ? people[Math.floor(rand() * people.length)] : null;
      if (!person) {
        const dv = pick(DEVICES);
        const pl = pick(PLACES);
        person = {
          ip: `${NETS[Math.floor(rand() * 3)]}${1 + Math.floor(rand() * 254)}`,
          ua: dv[1], screen: dv[2], model: dv[3], os_version: dv[4], touch: dv[5],
          city: pl[1], region: pl[2], country: pl[3], isp: pl[4],
          referrer: dv[1] === IG ? 'https://l.instagram.com/' : pick(REFS)[1],
        };
        people.push(person);
      }
      rows.push(enrich({ ...person, id: rows.length + 1, seen_at: at.toISOString(), lang: 'en-MY', path: '/', source: null }));
    }
  }
  demoCache = rows.sort((a, b) => b.at - a.at);
  return demoCache;
}
