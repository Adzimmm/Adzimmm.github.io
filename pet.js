// Chibi pet that replaces the chat button (pack v2: 50 frames per action, 512x512 cells, 10 x 5 sheets).
// - Tap: open the chat. Double-tap / double-click (or D): Brazil-style dance. Drag (mouse or touch): drag_panic.
// - Left alone: idle breathing, walks left and right, a macho wink now and then.
// - prefers-reduced-motion: stands still on its first idle frame (still draggable and tappable).
// - Add ?petdebug to the address for a panel that previews all six animations frame by frame.
// The sprites are the original PNG sheets, shown pixelated at one size, never redrawn or cropped.
(() => {
  'use strict';

  const COLS = 10;
  const CELL = 512;
  const ANIMS = { // frames and fps from animation_manifest.json
    idle: { frames: 50, fps: 15 },
    walk_left: { frames: 50, fps: 16 },
    walk_right: { frames: 50, fps: 16 },
    drag_panic: { frames: 50, fps: 16 },
    macho_blink: { frames: 50, fps: 16 },
    dance_brazil: { frames: 50, fps: 16 },
  };
  const SIZE = window.matchMedia('(max-width: 640px)').matches ? 180 : 240;
  const STORE = 'adz:pet';
  const root = document.documentElement;
  const still = () => root.dataset.motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debug = new URLSearchParams(location.search).has('petdebug');

  /* ---------- Element ---------- */
  const pet = document.createElement('button');
  pet.type = 'button';
  pet.className = 'pet';
  pet.setAttribute('aria-label', 'Open chat (double-click to make me dance)');
  pet.title = 'Click to chat · double-click to dance · drag to move';
  // Each frame is copied from its 512x512 cell onto a canvas with smoothing off (no blur, no cropping).
  const sprite = document.createElement('canvas');
  sprite.className = 'pet-sprite';
  sprite.setAttribute('aria-hidden', 'true');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  sprite.width = Math.round(SIZE * DPR);
  sprite.height = Math.round(SIZE * DPR);
  const ctx = sprite.getContext('2d');
  pet.append(sprite);
  pet.style.setProperty('--pet', `${SIZE}px`);

  /* ---------- Sheets: idle first, walks after load, the rest when first needed ---------- */
  const sheets = {};
  const images = {};
  function sheet(name) {
    if (!sheets[name]) {
      sheets[name] = new Promise(resolve => {
        const img = new Image();
        images[name] = img;
        img.decoding = 'async';
        img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(true));
        img.onerror = () => resolve(false);
        img.src = `assets/pet-v2/${name}.png`;
      });
      sheets[name].then(ok => { if (ok) sheets[name].ready = true; });
    }
    return sheets[name];
  }

  /* ---------- Position (box top-left), kept on screen and remembered ---------- */
  let x = 0;
  let y = 0;
  const clamp = () => {
    x = Math.min(Math.max(0, x), Math.max(0, window.innerWidth - SIZE));
    y = Math.min(Math.max(60, y), Math.max(60, window.innerHeight - SIZE));
  };
  const place = () => { pet.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`; };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) { x = saved.x * window.innerWidth; y = saved.y * window.innerHeight; }
  } catch (_) {}
  if (!x && !y) { x = window.innerWidth - SIZE; y = window.innerHeight - SIZE; }
  clamp();
  const remember = () => { try { localStorage.setItem(STORE, JSON.stringify({ x: x / window.innerWidth, y: y / window.innerHeight })); } catch (_) {} };

  /* ---------- Playback: frame = floor(elapsed * fps / 1000) % 50 ---------- */
  let anim = 'idle';
  let started = performance.now();
  let once = null; // callback after one full pass
  let frameShown = -1;
  let animShown = '';
  let paused = false; // debug
  let debugFrame = 0;
  let debugUi = null;

  function play(name, { onEnd = null } = {}) {
    const go = () => {
      anim = name;
      started = performance.now();
      once = onEnd;
      frameShown = -1;
      render(performance.now());
    };
    const s = sheet(name);
    if (s.ready) go();
    else s.then(ok => { if (ok) go(); });
  }
  function currentFrame(now) {
    if (still()) return 0;
    if (paused) return debugFrame;
    const a = ANIMS[anim];
    const f = Math.floor((now - started) * a.fps / 1000);
    if (once && f >= a.frames) { const cb = once; once = null; cb(); return 0; }
    return f % a.frames;
  }
  function render(now) {
    const f = currentFrame(now);
    if (f === frameShown && anim === animShown) return;
    const img = images[anim];
    if (!img || !img.complete || !img.naturalWidth) return; // drawn on a later frame, once the sheet is in
    animShown = anim;
    frameShown = f;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, sprite.width, sprite.height);
    ctx.drawImage(img, (f % COLS) * CELL, Math.floor(f / COLS) * CELL, CELL, CELL, 0, 0, sprite.width, sprite.height);
    if (debugUi) debugUi.update(f);
  }

  /* ---------- Behaviour: idle, walk left/right, wink, dance ---------- */
  let mode = 'idle'; // idle | walk | drag | dance | wink | debug
  let walkTo = 0;
  let nextIdea = performance.now() + 3000;
  const chatOpen = () => { const c = document.querySelector('.chat'); return Boolean(c && !c.hidden); };
  const settle = (now, pause) => { mode = 'idle'; play('idle'); nextIdea = now + pause; };
  function think(now) {
    if (debug || still() || mode !== 'idle' || now < nextIdea || chatOpen()) return;
    if (Math.random() < 0.75) {
      const room = Math.max(0, window.innerWidth - SIZE);
      walkTo = Math.random() * room;
      if (Math.abs(walkTo - x) < 80) walkTo = Math.min(room, Math.max(0, x + (x > room / 2 ? -1 : 1) * 200));
      mode = 'walk';
      play(walkTo < x ? 'walk_left' : 'walk_right');
    } else {
      mode = 'wink';
      play('macho_blink', { onEnd: () => settle(performance.now(), 1500 + Math.random() * 2000) });
    }
  }
  function dance() {
    if (mode === 'drag') return;
    mode = 'dance';
    play('dance_brazil', { onEnd: () => settle(performance.now(), 2500) }); // one full 50-frame pass (~3 s)
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(64, now - last);
    last = now;
    if (mode === 'walk' && anim.startsWith('walk')) {
      const speed = 0.075 * (SIZE / 240) * dt;
      const dx = walkTo - x;
      if (Math.abs(dx) <= speed || chatOpen() || still()) { settle(now, 1200 + Math.random() * 2500); remember(); }
      else { x += Math.sign(dx) * speed; clamp(); place(); }
    }
    think(now);
    render(now);
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
      mode = 'drag';
      pet.classList.add('is-dragging');
      play('drag_panic'); // loops while held
    }
    if (drag.moved) { x = drag.ox + dx; y = drag.oy + dy; clamp(); place(); }
  });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    pet.classList.remove('is-dragging');
    if (!moved) return;
    settle(performance.now(), 2500);
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

  /* ---------- Debug panel (?petdebug): preview each animation, scrub the 50 frames ---------- */
  function makeDebug() {
    const box = document.createElement('div');
    box.className = 'pet-debug';
    box.innerHTML = `<b>Pet debug</b><div class="pd-anims">${Object.keys(ANIMS).map(n => `<button type="button" data-a="${n}">${n}</button>`).join('')}</div>
      <label>Frame <input type="range" min="0" max="49" value="0"></label>
      <div class="pd-row"><button type="button" data-play>Pause</button><span class="pd-info"></span></div>`;
    const range = box.querySelector('input');
    const info = box.querySelector('.pd-info');
    const playBtn = box.querySelector('[data-play]');
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (b) { mode = 'debug'; paused = false; playBtn.textContent = 'Pause'; play(b.dataset.a); }
      if (e.target.closest('[data-play]')) {
        paused = !paused;
        debugFrame = Math.max(0, frameShown);
        if (!paused) started = performance.now() - debugFrame * 1000 / ANIMS[anim].fps;
        playBtn.textContent = paused ? 'Play' : 'Pause';
        range.value = String(debugFrame);
      }
    });
    range.addEventListener('input', () => { paused = true; playBtn.textContent = 'Play'; debugFrame = Number(range.value); frameShown = -1; render(performance.now()); });
    document.body.append(box);
    return {
      update(f) {
        if (!paused) range.value = String(f);
        info.textContent = `${anim} · frame ${String(f + 1).padStart(2, '0')}/50 · ${ANIMS[anim].fps} fps`;
        box.querySelectorAll('[data-a]').forEach(b => b.classList.toggle('on', b.dataset.a === anim));
      },
    };
  }

  function start() {
    root.classList.add('has-pet');
    document.body.append(pet);
    place();
    if (debug) debugUi = makeDebug();
    sheet('idle').then(() => {
      play('idle');
      requestAnimationFrame(tick);
    });
    // Walks and the wink after the page settles; drag and dance load on first hover or touch (~1.8 MB each).
    (window.requestIdleCallback || (cb => setTimeout(cb, 2000)))(() => {
      ['walk_left', 'walk_right', 'macho_blink'].forEach(sheet);
      if (debug) Object.keys(ANIMS).forEach(sheet);
    });
    const warm = () => { sheet('drag_panic'); sheet('dance_brazil'); };
    pet.addEventListener('pointerenter', warm, { once: true });
    pet.addEventListener('pointerdown', warm, { once: true });
    pet.addEventListener('focus', warm, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
