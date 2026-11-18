// Counts visits for the Insights tab of the admin page: one short note per browser tab, sent to the
// Cloudflare Worker (window.SUPABASE.visitUrl), which adds the IP address, rough location and browser.
// The owner's own devices are not counted: logging in to the admin does that on its browser, and opening
// the site once with ?notrack does it on any other device (?track counts it again).
(() => {
  'use strict';

  const KEY = 'adz:notrack';
  const url = window.SUPABASE && window.SUPABASE.visitUrl;
  const params = new URLSearchParams(location.search);

  if (params.has('notrack') || params.has('track')) {
    const stop = params.has('notrack');
    try { localStorage.setItem(KEY, stop ? '1' : '0'); } catch (e) { /* storage blocked */ }
    params.delete('notrack');
    params.delete('track');
    history.replaceState(history.state, '', location.pathname + (params.toString() ? `?${params}` : '') + location.hash);
    note(stop ? 'This device is no longer counted in your Insights.' : 'This device is counted in your Insights again.');
    if (stop) return;
  }

  try {
    if (!url || localStorage.getItem(KEY) === '1' || sessionStorage.getItem('adz:visit')) return;
  } catch (e) { if (!url) return; }
  if (navigator.webdriver) return;

  // Wait until the page is really seen (not a background tab or prerender), then a moment more.
  const whenSeen = fn => {
    if (document.visibilityState === 'visible' && !document.prerendering) return fn();
    const check = () => {
      if (document.visibilityState !== 'visible' || document.prerendering) return;
      document.removeEventListener('visibilitychange', check);
      document.removeEventListener('prerenderingchange', check);
      fn();
    };
    document.addEventListener('visibilitychange', check);
    document.addEventListener('prerenderingchange', check);
  };

  whenSeen(() => setTimeout(async () => {
    try { sessionStorage.setItem('adz:visit', '1'); } catch (e) { /* counted once per page load instead */ }
    const ref = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : '';
    const data = {
      path: location.pathname + location.hash,
      ref,
      utm: params.get('utm_source') || '',
      screen: `${screen.width}x${screen.height}`,
      lang: navigator.language || '',
      touch: navigator.maxTouchPoints > 1,
    };
    // Chrome and Edge can tell the phone model and the real system version.
    try {
      const ch = navigator.userAgentData && await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
      if (ch) { data.model = ch.model || ''; data.osv = ch.platformVersion || ''; }
    } catch (e) { /* not available */ }
    const body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
      fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    } catch (e) { /* never break the page */ }
  }, 1200));

  function note(text) {
    const show = () => {
      const el = document.createElement('div');
      el.textContent = text;
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;z-index:9999;max-width:calc(100vw - 32px);padding:11px 18px;'
        + 'border-radius:999px;background:#1d1c25;color:#f3f1f7;font:600 14px/1.35 system-ui,sans-serif;'
        + 'box-shadow:0 12px 32px rgba(0,0,0,.35);transform:translateX(-50%);transition:opacity .3s';
      document.body.append(el);
      setTimeout(() => { el.style.opacity = '0'; }, 3200);
      setTimeout(() => el.remove(), 3600);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show, { once: true });
  }
})();
