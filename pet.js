// Chibi pet that replaces the chat button: drag it anywhere on the page, tap it to open the chat.
// It idles (with a blink now and then), wanders left and right, dances once in a while and panics
// while being dragged. Sprite sheets: assets/pet/<anim>.png, 256x256 cells, 4 per row (idle is one cell).
(() => {
  'use strict';

  const ANIMS = {
    idle: { frames: 1, fps: 1 },
    macho_blink: { frames: 8, fps: 9 },
    walk_left: { frames: 8, fps: 12 },
    walk_right: { frames: 8, fps: 12 },
    drag_panic: { frames: 8, fps: 9 },
    dance_brazil: { frames: 16, fps: 13 },
  };
  const SIZE = window.matchMedia('(max-width: 640px)').matches ? 180 : 240; // shown size in px
  const STORE = 'adz:pet';
  const root = document.documentElement;
  const still = () => root.dataset.motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pet = document.createElement('button');
  pet.type = 'button';
  pet.className = 'pet';
  pet.setAttribute('aria-label', 'Open chat');
  pet.title = 'Click to chat · drag to move';
  const sprite = document.createElement('span');
  sprite.className = 'pet-sprite';
  sprite.setAttribute('aria-hidden', 'true');
  const shadow = document.createElement('span');
  shadow.className = 'pet-shadow';
  shadow.setAttribute('aria-hidden', 'true');
  pet.append(shadow, sprite);
  pet.style.setProperty('--pet', `${SIZE}px`);

  // Position: left/top of the box, kept on screen; remembered for the next visit.
  let x = 0;
  let y = 0;
  const clamp = () => {
    x = Math.min(Math.max(4, x), window.innerWidth - SIZE - 4);
    y = Math.min(Math.max(70, y), window.innerHeight - SIZE - 4);
  };
  const place = () => { pet.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`; };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) { x = saved.x * window.innerWidth; y = saved.y * window.innerHeight; }
  } catch (_) {}
  if (!x && !y) { x = window.innerWidth - SIZE - 18; y = window.innerHeight - SIZE - 12; }
  clamp();
  const remember = () => { try { localStorage.setItem(STORE, JSON.stringify({ x: x / window.innerWidth, y: y / window.innerHeight })); } catch (_) {} };

  // Sprite playback (requestAnimationFrame, no blur: CSS pixelated).
  let anim = 'idle';
  let frame = 0;
  let loop = true;
  let since = 0;
  let onEnd = null;
  let loopFrom = 0; // after one full play, keep looping from this frame (the crying part of drag_panic)
  const loaded = new Set(['idle']);
  const preload = () => Object.keys(ANIMS).forEach(name => {
    if (loaded.has(name)) return;
    const img = new Image();
    img.onload = () => loaded.add(name);
    img.src = `assets/pet/${name}.png`;
  });
  function play(name, { repeat = true, done = null, from = 0 } = {}) {
    if (!loaded.has(name)) name = 'idle';
    anim = name;
    frame = 0;
    loop = repeat;
    onEnd = done;
    loopFrom = from;
    since = performance.now();
    draw();
  }
  function draw() {
    const a = ANIMS[anim];
    const cols = a.frames === 1 ? 1 : 4;
    const rows = Math.ceil(a.frames / cols);
    sprite.style.backgroundImage = `url("assets/pet/${anim}.png")`;
    sprite.style.backgroundSize = `${cols * SIZE}px ${rows * SIZE}px`;
    sprite.style.backgroundPosition = `${-(frame % cols) * SIZE}px ${-Math.floor(frame / cols) * SIZE}px`;
  }

  // Behaviour: idle, blink every 3-6 s, sometimes walk a little or dance.
  let mode = 'idle'; // idle | walk | drag | dance
  let walkTo = 0;
  let nextIdea = performance.now() + 4000;
  // Left alone it roams left and right, pauses, blinks, sometimes dances.
  let walkY = 0;
  function think(now) {
    if (still() || mode !== 'idle' || now < nextIdea || chatOpen()) return;
    const r = Math.random();
    if (r < 0.72) {
      walkTo = 4 + Math.random() * Math.max(0, window.innerWidth - SIZE - 8);
      walkY = y; // left and right only: it stays at the height where it was left
      if (Math.abs(walkTo - x) < 60) walkTo = Math.min(Math.max(4, x + (x > window.innerWidth / 2 ? -1 : 1) * 160), window.innerWidth - SIZE - 4);
      mode = 'walk';
      play(walkTo < x ? 'walk_right' : 'walk_left'); // the sheets are named for the way the character faces, the opposite of how they read here
    } else if (r < 0.92) {
      play('macho_blink', { repeat: false, done: () => play('idle') });
      nextIdea = now + 1500 + Math.random() * 1500;
    } else {
      mode = 'dance';
      play('dance_brazil');
      setTimeout(() => { if (mode === 'dance') { mode = 'idle'; play('idle'); nextIdea = performance.now() + 1200; } }, 2500 + Math.random() * 1500);
      nextIdea = now + 6000;
    }
  }
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(64, now - last);
    last = now;
    const a = ANIMS[anim];
    if (a.frames > 1) {
      const f = Math.floor((now - since) / (1000 / a.fps));
      if (loop) frame = f % a.frames;
      else if (loopFrom && f >= a.frames) frame = loopFrom + ((f - a.frames) % (a.frames - loopFrom));
      else if (f >= a.frames) {
        frame = a.frames - 1; // hold the last frame (drag panic stays on its last frame)
        if (onEnd) { const cb = onEnd; onEnd = null; cb(); }
      } else frame = f;
      draw();
    }
    if (mode === 'walk') {
      const speed = 0.09 * (SIZE / 180) * dt; // px per frame, scaled to the pet's size
      const dx = walkTo - x;
      const dy = walkY - y;
      const left = Math.hypot(dx, dy);
      if (left <= speed || chatOpen()) {
        mode = 'idle';
        play('idle');
        nextIdea = now + 900 + Math.random() * 1800; // short pause, then off again
        remember();
      } else { x += dx / left * speed; y += dy / left * speed * 0.6; clamp(); place(); }
    }
    think(now);
    requestAnimationFrame(tick);
  }

  // Drag anywhere (pointer capture), tap to open the chat.
  let drag = null;
  const chatOpen = () => { const c = document.querySelector('.chat'); return Boolean(c && !c.hidden); };
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
      play('drag_panic', { repeat: false, from: 4 }); // panic once, then keep crying while held
    }
    if (drag.moved) { x = drag.ox + dx; y = drag.oy + dy; clamp(); place(); }
  });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    pet.classList.remove('is-dragging');
    if (moved) {
      mode = 'idle';
      play('idle');
      nextIdea = performance.now() + 3500;
      remember();
      pet.dataset.justDragged = '1';
      setTimeout(() => { delete pet.dataset.justDragged; }, 0);
    }
  };
  pet.addEventListener('pointerup', end);
  pet.addEventListener('pointercancel', end);
  pet.addEventListener('click', () => {
    if (pet.dataset.justDragged) return;
    if (window.PortfolioChat) window.PortfolioChat.open();
  });
  window.addEventListener('resize', () => { clamp(); place(); });

  function start() {
    root.classList.add('has-pet');
    document.body.append(pet);
    place();
    play('idle');
    requestAnimationFrame(tick);
    // The other sheets (about 1 MB) load once the page has settled.
    (window.requestIdleCallback || (cb => setTimeout(cb, 1500)))(preload);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
