// Chibi pet that replaces the chat button. The character is the vector master (assets/pet/chibi.svg,
// pixel-art blocks as SVG paths), shown unchanged so it stays sharp at any size; CSS moves the whole figure.
// - Tap: open the chat. Double-tap / double-click (or D): dance. Drag (mouse or touch): panic with tears.
// - Left alone: breathes, walks left and right (facing the way it goes), a happy hop with a sparkle now and then.
// - prefers-reduced-motion: stands still (still draggable and tappable).
// - Add ?petdebug to the address for buttons that play every state.
(() => {
  'use strict';

  const SIZE = window.matchMedia('(max-width: 640px)').matches ? 180 : 240; // height in px
  const W = Math.round(SIZE * 262 / 476); // the SVG is 262 x 476
  const STORE = 'adz:pet';
  const root = document.documentElement;
  const still = () => root.dataset.motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debug = new URLSearchParams(location.search).has('petdebug');

  /* ---------- Element ---------- */
  const pet = document.createElement('button');
  pet.type = 'button';
  pet.className = 'pet';
  pet.dataset.state = 'idle';
  pet.dataset.dir = 'right';
  pet.setAttribute('aria-label', 'Open chat (double-click to make me dance)');
  pet.title = 'Click to chat · double-click to dance · drag to move';
  pet.style.setProperty('--pet-w', `${W}px`);
  pet.style.setProperty('--pet-h', `${SIZE}px`);
  pet.innerHTML = `<span class="pp-shadow" aria-hidden="true"></span>
    <span class="pp-body"><img class="pp-img" src="assets/pet/chibi.svg" width="262" height="476" alt="" draggable="false" decoding="async"></span>
    <span class="pp-fx" aria-hidden="true"><i class="pp-tear pp-tear-l"></i><i class="pp-tear pp-tear-r"></i><i class="pp-spark"></i><i class="pp-note pp-note-a">♪</i><i class="pp-note pp-note-b">♫</i></span>`;

  /* ---------- Position (box top-left), kept on screen and remembered ---------- */
  let x = 0;
  let y = 0;
  const clamp = () => {
    x = Math.min(Math.max(0, x), Math.max(0, window.innerWidth - W));
    y = Math.min(Math.max(60, y), Math.max(60, window.innerHeight - SIZE));
  };
  const place = () => { pet.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`; };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) { x = saved.x * window.innerWidth; y = saved.y * window.innerHeight; }
  } catch (_) {}
  if (!x && !y) { x = window.innerWidth - W - 16; y = window.innerHeight - SIZE - 8; }
  clamp();
  const remember = () => { try { localStorage.setItem(STORE, JSON.stringify({ x: x / window.innerWidth, y: y / window.innerHeight })); } catch (_) {} };

  /* ---------- States: idle | walk | drag | hop | dance (CSS animates each) ---------- */
  let mode = 'idle';
  let walkTo = 0;
  let timer = 0;
  let nextIdea = performance.now() + 3000;
  const chatOpen = () => { const c = document.querySelector('.chat'); return Boolean(c && !c.hidden); };
  function setState(s, dir) {
    mode = s;
    pet.dataset.state = s;
    if (dir) pet.dataset.dir = dir;
  }
  const settle = (pause = 2000) => { clearTimeout(timer); setState('idle'); nextIdea = performance.now() + pause; };
  function oneShot(s, ms) {
    clearTimeout(timer);
    setState(s);
    timer = setTimeout(() => settle(2200), ms);
  }
  const hop = () => oneShot('hop', 1400);
  const dance = () => { if (mode !== 'drag') oneShot('dance', 4200); };

  function think(now) {
    if (debug || still() || mode !== 'idle' || now < nextIdea || chatOpen()) return;
    if (Math.random() < 0.75) {
      const room = Math.max(0, window.innerWidth - W);
      walkTo = Math.random() * room;
      if (Math.abs(walkTo - x) < 80) walkTo = Math.min(room, Math.max(0, x + (x > room / 2 ? -1 : 1) * 200));
      setState('walk', walkTo < x ? 'left' : 'right');
    } else hop();
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(64, now - last);
    last = now;
    if (mode === 'walk' && !debug) {
      const speed = 0.07 * (SIZE / 240) * dt;
      const dx = walkTo - x;
      if (Math.abs(dx) <= speed || chatOpen() || still()) { settle(1200 + Math.random() * 2500); remember(); }
      else { x += Math.sign(dx) * speed; clamp(); place(); }
    }
    think(now);
    requestAnimationFrame(tick);
  }

  /* ---------- Pointer: drag anywhere, tap = chat, double-tap = dance ---------- */
  let drag = null;
  let tapTimer = 0;
  pet.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    pet.setPointerCapture(e.pointerId);
    drag = { sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false };
  });
  pet.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      clearTimeout(timer);
      setState('drag'); // shakes and cries for as long as it is held
    }
    if (drag.moved) { x = drag.ox + dx; y = drag.oy + dy; clamp(); place(); }
  });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    settle(2500);
    remember();
    pet.dataset.justDragged = '1';
    setTimeout(() => { delete pet.dataset.justDragged; }, 0);
  };
  pet.addEventListener('pointerup', end);
  pet.addEventListener('pointercancel', end);
  pet.addEventListener('click', () => {
    if (pet.dataset.justDragged) return;
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = 0; dance(); return; } // second tap: dance
    tapTimer = setTimeout(() => {
      tapTimer = 0;
      if (window.PortfolioChat) window.PortfolioChat.open();
    }, 260);
  });
  pet.addEventListener('keydown', e => { if (e.key === 'd' || e.key === 'D') { e.preventDefault(); dance(); } });
  window.addEventListener('resize', () => { clamp(); place(); });

  /* ---------- Debug (?petdebug): play each state in place ---------- */
  function makeDebug() {
    const box = document.createElement('div');
    box.className = 'pet-debug';
    const states = [['idle', 'idle'], ['walk_left', 'walk'], ['walk_right', 'walk'], ['drag_panic', 'drag'], ['hop', 'hop'], ['dance', 'dance']];
    box.innerHTML = `<b>Pet debug</b><div class="pd-anims">${states.map(([label]) => `<button type="button" data-a="${label}">${label}</button>`).join('')}</div><span class="pd-info">idle</span>`;
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      clearTimeout(timer);
      const [label, s] = states.find(([l]) => l === b.dataset.a);
      setState(s, label === 'walk_left' ? 'left' : label === 'walk_right' ? 'right' : null);
      box.querySelectorAll('[data-a]').forEach(k => k.classList.toggle('on', k === b));
      box.querySelector('.pd-info').textContent = label;
    });
    document.body.append(box);
  }

  function start() {
    root.classList.add('has-pet');
    document.body.append(pet);
    place();
    if (debug) makeDebug();
    requestAnimationFrame(tick);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
