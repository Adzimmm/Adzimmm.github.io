// Chibi pet that replaces the chat button, drawn in SVG code (crisp at any size) after the pixel-art
// reference: curly black hair, big brown eyes, black suit, white shirt, blue tie and a gold pin.
// - Tap: open the chat. Double-tap / double-click (or D): Brazil-style dance. Drag (mouse or touch): panic and cry.
// - Left alone: breathes and blinks, walks left and right, a macho wink now and then.
// - prefers-reduced-motion: stands still (still draggable and tappable).
// - Add ?petdebug to the address for buttons that play every state.
// Shapes live in 512-unit space (the size of the reference frames); CSS in style.css animates the parts.
(() => {
  'use strict';

  const SIZE = window.matchMedia('(max-width: 640px)').matches ? 180 : 240; // height in px
  const VB = { x: 126, y: 40, w: 258, h: 440 };
  const W = Math.round(SIZE * VB.w / VB.h);
  const STORE = 'adz:pet';
  const root = document.documentElement;
  const still = () => root.dataset.motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debug = new URLSearchParams(location.search).has('petdebug');

  // Palette sampled from the reference sprite.
  const C = {
    hair: '#2a2121', hairDark: '#191212', hairLight: '#5a4a49',
    skin: '#f8c8a8', skinShade: '#eaae8f', blush: '#f49d88',
    iris: '#3c241f', irisLight: '#7a4a32', pupil: '#1c1110', lash: '#1d1413',
    suit: '#332c2c', suitDark: '#241f1f', lapel: '#3f3636', sleeve: '#2e2828',
    shirt: '#efebe5', tie: '#1f5096', tieLight: '#3b6fbe', tieDot: '#8fb2e6',
    pin: '#cab837', pinLight: '#f3df6c', pants: '#2d2727', shoe: '#1d1818', shoeLight: '#4a4040',
    mouth: '#b5634f', tear: '#7cc8ff', outline: '#171212', outlineSkin: '#c9876c',
  };

  // Hair outline: points round the head (clockwise from the left sideburn); every segment bulges outwards
  // (away from the head centre) into a curl, so the rim is lumpy like the reference. The forehead part
  // of the loop bulges down into the fringe.
  const HAIR = [[176, 240], [164, 218], [153, 196], [147, 172], [147, 148], [153, 126], [163, 108], [176, 94], [188, 86], [198, 74], [214, 80],
    [226, 68], [242, 76], [256, 66], [272, 74], [288, 66], [304, 76], [318, 80], [330, 92], [343, 104], [354, 120], [362, 140], [365, 160],
    [364, 184], [357, 206], [346, 222], [336, 240],
    [330, 214], [320, 202], [307, 200], [294, 206], [282, 194], [266, 190], [252, 196], [238, 190], [224, 198], [210, 196], [198, 204], [186, 214]];
  // How far each segment bulges into a curl: uneven on purpose, like loose waves rather than a round afro.
  const BUMP = [8, 5, 9, 6, 8, 5, 9, 6, 7, 5, 6, 5, 6, 5, 6, 5, 6, 7, 8, 6, 9, 6, 8, 5, 9, 6, 6, 5, 7, 5, 8, 5, 7, 5, 8, 5, 7, 5, 6];
  const hairPath = (() => {
    const cx = 256;
    const cy = 150;
    let d = `M${HAIR[0][0]} ${HAIR[0][1]}`;
    HAIR.forEach((a, i) => {
      const b = HAIR[(i + 1) % HAIR.length];
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const len = Math.hypot(mx - cx, my - cy) || 1;
      const bump = BUMP[i] || 6;
      d += `Q${(mx + (mx - cx) / len * bump).toFixed(1)} ${(my + (my - cy) / len * bump).toFixed(1)} ${b[0]} ${b[1]}`;
    });
    return `${d}Z`;
  })();

  const curls = [ // lighter wavy strands, S-shaped like the reference's loose curls
    'M172 150c6-12 16-16 26-12s16 6 24-2', 'M184 112c8-12 20-16 32-12s18 8 28 2', 'M222 88c10-10 22-12 34-6s16 10 26 6',
    'M272 86c10-6 22-6 30 2s12 12 22 10', 'M314 104c8 2 16 8 18 18', 'M330 140c6 6 8 14 6 22', 'M196 128c10-8 22-8 30 0s16 8 26 2',
    'M246 112c10-8 22-8 30 0s14 8 24 4', 'M290 124c8-4 18-2 24 6', 'M168 186c2-8 8-14 16-14', 'M206 166c8-8 18-10 26-4s14 6 22 0',
    'M262 160c8-6 18-6 26 0s12 8 20 4', 'M312 168c6-2 12 2 14 10',
  ].map(d => `<path d="${d}"/>`).join('');
  const crevices = [ // darker gaps between the waves
    'M190 140c8 8 20 8 28 0', 'M238 120c8 8 20 8 28 0', 'M288 148c6 6 16 6 22-2', 'M176 120c4-8 10-12 18-12', 'M230 176c6 6 16 6 24 0',
    'M282 182c6 6 14 6 20 0', 'M336 120c4 8 6 14 4 22', 'M206 96c8 6 18 6 26 0', 'M262 92c8 6 18 6 26 0',
  ].map(d => `<path d="${d}"/>`).join('');

  const eye = (cx, side, cy = 243) => `<g class="pv-eye pv-eye-${side}">
      <ellipse cx="${cx}" cy="${cy}" rx="16.5" ry="19.5" fill="${C.iris}"/>
      <ellipse cx="${cx}" cy="${cy + 6}" rx="12" ry="12" fill="${C.irisLight}"/>
      <ellipse class="pv-pupil" cx="${cx}" cy="${cy + 2}" rx="7" ry="8" fill="${C.pupil}"/>
      <circle cx="${cx - 6.5}" cy="${cy - 8}" r="5.2" fill="#fff"/>
      <circle cx="${cx + 5.5}" cy="${cy + 9}" r="2.4" fill="#fff" opacity=".85"/>
      <path d="M${cx - 19} ${cy - 9}Q${cx} ${cy - 25} ${cx + 19} ${cy - 9}" fill="none" stroke="${C.lash}" stroke-width="4.8" stroke-linecap="round"/>
    </g>`;

  const SVG = `<svg class="pv-svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
  <g class="pv-all">
    <g class="pv-leg pv-leg-l">
      <rect x="224" y="392" width="30" height="66" rx="6" fill="${C.pants}" stroke="${C.outline}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M239 398v52" stroke="${C.suitDark}" stroke-width="1.6" opacity=".7"/>
      <path d="M217 462q0-10 16-10h19q5 0 5 8v7q-20 5-40 1z" fill="${C.shoe}" stroke="${C.outline}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M227 457q7-3 16-2" stroke="${C.shoeLight}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    </g>
    <g class="pv-leg pv-leg-r">
      <rect x="256" y="392" width="30" height="66" rx="6" fill="${C.pants}" stroke="${C.outline}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M271 398v52" stroke="${C.suitDark}" stroke-width="1.6" opacity=".7"/>
      <path d="M293 462q0-10-16-10h-19q-5 0-5 8v7q20 5 40 1z" fill="${C.shoe}" stroke="${C.outline}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M283 457q-7-3-16-2" stroke="${C.shoeLight}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    </g>
    <g class="pv-body">
      <rect x="241" y="282" width="28" height="22" rx="6" fill="${C.skinShade}"/>
      <path d="M206 316q2-18 24-20h50q22 2 24 20l2 80q-14 7-51 7t-51-7z" fill="${C.suit}" stroke="${C.outline}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M238 295h34l-17 57z" fill="${C.shirt}"/>
      <path d="M238 295h12l-4 16z M272 295h-12l4 16z" fill="#fbf9f5"/>
      <path d="M249 299h12l-2 10h-8z" fill="${C.tie}"/>
      <path d="M251 309h8l4 33-8 10-8-10z" fill="${C.tieLight}"/>
      <path d="M249 320l12-5 M249 330l13-5 M250 340l11-4" stroke="${C.tieDot}" stroke-width="1.6" opacity=".75"/>
      <path d="M238 295l-13 5 13 41 17 11z" fill="${C.lapel}"/>
      <path d="M272 295l13 5-13 41-17 11z" fill="${C.lapel}"/>
      <path d="M255 352v42" stroke="${C.suitDark}" stroke-width="2"/>
      <circle cx="255" cy="364" r="2.8" fill="${C.suitDark}"/><circle cx="255" cy="379" r="2.8" fill="${C.suitDark}"/>
      <path d="M216 376h18 M276 376h18" stroke="${C.suitDark}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="284" cy="322" r="5" fill="${C.pin}" stroke="#8a7a20" stroke-width="1"/><circle cx="283" cy="321" r="2" fill="${C.pinLight}"/>
    </g>
    <g class="pv-arm pv-arm-l">
      <path d="M200 306q-11 32-8 67h20q1-34 4-64z" fill="${C.sleeve}" stroke="${C.outline}" stroke-width="2.6" stroke-linejoin="round"/>
      <rect x="191" y="370" width="22" height="7" rx="2.5" fill="${C.shirt}" stroke="#b9b2aa" stroke-width="1.4"/>
      <ellipse cx="202" cy="386" rx="10.5" ry="11" fill="${C.skin}" stroke="${C.outlineSkin}" stroke-width="2.2"/>
    </g>
    <g class="pv-arm pv-arm-r">
      <path d="M310 306q11 32 8 67h-20q-1-34-4-64z" fill="${C.sleeve}" stroke="${C.outline}" stroke-width="2.6" stroke-linejoin="round"/>
      <rect x="297" y="370" width="22" height="7" rx="2.5" fill="${C.shirt}" stroke="#b9b2aa" stroke-width="1.4"/>
      <ellipse cx="308" cy="386" rx="10.5" ry="11" fill="${C.skin}" stroke="${C.outlineSkin}" stroke-width="2.2"/>
    </g>
    <g class="pv-head">
      <ellipse cx="165" cy="246" rx="12" ry="15.5" fill="${C.skin}" stroke="${C.outlineSkin}" stroke-width="2.4"/><ellipse cx="167" cy="247" rx="5" ry="8" fill="${C.skinShade}"/>
      <ellipse cx="345" cy="246" rx="12" ry="15.5" fill="${C.skin}" stroke="${C.outlineSkin}" stroke-width="2.4"/><ellipse cx="343" cy="247" rx="5" ry="8" fill="${C.skinShade}"/>
      <ellipse cx="255" cy="237" rx="88" ry="63" fill="${C.skin}" stroke="${C.outlineSkin}" stroke-width="2.6"/>
      <path class="pv-hair-back" d="${hairPath}" fill="${C.hair}" stroke="${C.hairDark}" stroke-width="3" stroke-linejoin="round"/>
      <g class="pv-curls" fill="none" stroke="${C.hairLight}" stroke-width="3.8" stroke-linecap="round">${curls}</g>
      <g class="pv-crevices" fill="none" stroke="${C.hairDark}" stroke-width="2.6" stroke-linecap="round">${crevices}</g>
      <ellipse class="pv-blush" cx="190" cy="268" rx="13" ry="6.5" fill="${C.blush}" opacity=".42"/>
      <ellipse class="pv-blush" cx="320" cy="268" rx="13" ry="6.5" fill="${C.blush}" opacity=".42"/>
      <g class="pv-face-normal">
        <path class="pv-brow pv-brow-l" d="M186 215q21-11 44-4" stroke="${C.lash}" stroke-width="9.5" stroke-linecap="round" fill="none"/>
        <path class="pv-brow pv-brow-r" d="M280 211q23-7 44 4" stroke="${C.lash}" stroke-width="9.5" stroke-linecap="round" fill="none"/>
        <g class="pv-eyes">${eye(207, 'l')}${eye(303, 'r')}</g>
        <path class="pv-wink" d="M285 241q18 13 36 0" stroke="${C.lash}" stroke-width="4.6" stroke-linecap="round" fill="none"/>
        <path class="pv-happy" d="M189 246q18-16 36 0 M285 246q18-16 36 0" stroke="${C.lash}" stroke-width="4.6" stroke-linecap="round" fill="none"/>
        <path d="M252.5 261q2.5 3 5 0" stroke="#d48d72" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <path class="pv-smile" d="M244 273q11 9 22 0" stroke="${C.mouth}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
        <path class="pv-smirk" d="M243 274q13 7 25-5" stroke="${C.mouth}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
        <path class="pv-grin" d="M242 270q13 16 26 0z" fill="#8c3a30"/>
      </g>
      <g class="pv-face-cry">
        <path d="M186 208q21 9 44 0 M280 208q23 9 44 0" stroke="${C.lash}" stroke-width="8" stroke-linecap="round" fill="none"/>
        <path d="M196 232l19 11-19 11 M314 232l-19 11 19 11" stroke="${C.lash}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path class="pv-stream" d="M204 256q-3 14 2 30 M306 256q3 14-2 30" stroke="${C.tear}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".9"/>
        <path d="M240 268q15-12 30 0 3 18-15 19t-15-19z" fill="#7a2a24"/>
        <path d="M245 280q10-6 20 0-5 6-10 6t-10-6z" fill="#e06f6a"/>
      </g>
    </g>
    <g class="pv-fx">
      <path class="pv-drop pv-drop-l" d="M182 240q-6 9 0 13 6-4 0-13z" fill="${C.tear}"/>
      <path class="pv-drop pv-drop-r" d="M328 240q-6 9 0 13 6-4 0-13z" fill="${C.tear}"/>
      <path class="pv-spark" d="M334 210l3.5 9 9 3.5-9 3.5-3.5 9-3.5-9-9-3.5 9-3.5z" fill="#ffd75e"/>
      <text class="pv-note pv-note-a" x="150" y="140" fill="${C.tieLight}">&#9834;</text>
      <text class="pv-note pv-note-b" x="352" y="120" fill="${C.pin}">&#9835;</text>
    </g>
  </g>
</svg>`;

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
  pet.innerHTML = SVG;

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

  /* ---------- States: idle | walk | drag | wink | dance (CSS animates each) ---------- */
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
  const wink = () => oneShot('wink', 1900);
  const dance = () => { if (mode !== 'drag') oneShot('dance', 4200); };

  function think(now) {
    if (debug || still() || mode !== 'idle' || now < nextIdea || chatOpen()) return;
    if (Math.random() < 0.72) {
      const room = Math.max(0, window.innerWidth - W);
      walkTo = Math.random() * room;
      if (Math.abs(walkTo - x) < 80) walkTo = Math.min(room, Math.max(0, x + (x > room / 2 ? -1 : 1) * 200));
      setState('walk', walkTo < x ? 'left' : 'right');
    } else wink();
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
      setState('drag'); // panics and cries for as long as it is held
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
    const states = [['idle', 'idle'], ['walk_left', 'walk'], ['walk_right', 'walk'], ['drag_panic', 'drag'], ['macho_wink', 'wink'], ['dance_brazil', 'dance']];
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
