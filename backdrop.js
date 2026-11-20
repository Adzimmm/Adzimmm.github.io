// The box behind the About photo (site.about.backdrop), drawn the same way on the site and in the admin preview.
// { type: 'color' | 'image' | 'shader' | 'animated', colors: [c1, c2, c3], image: { src }, shader: name, animated: name }
(() => {
  'use strict';

  const DEFAULT_COLORS = ['#4b22d6', '#b8a0ff', '#d4f57a'];
  const SHADERS = { aurora: 'Aurora', plasma: 'Plasma', liquid: 'Liquid', grain: 'Grainy gradient' };
  const ANIMATED = { mesh: 'Moving mesh', conic: 'Spinning light', stripes: 'Sliding stripes', blobs: 'Floating blobs' };

  const hex = c => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
    const n = m ? parseInt(m[1], 16) : 0x4b22d6;
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };

  // Fragment shaders (GLSL ES 1.0). r = size in px, t = seconds, c1..c3 = the chosen colours.
  const HEAD = 'precision mediump float;uniform vec2 r;uniform float t;uniform vec3 c1,c2,c3;';
  const NOISE = 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'
    + 'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}'
    + 'float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<5;k++){v+=a*n(p);p*=2.;a*=.5;}return v;}';
  const FRAG = {
    aurora: HEAD + 'void main(){vec2 u=gl_FragCoord.xy/r;float w=sin(u.x*3.+t*.6)+sin(u.y*4.-t*.5)+sin((u.x+u.y)*3.5+t*.4);w=w/6.+.5;'
      + 'vec3 c=mix(c1,c2,smoothstep(.15,.85,w));c=mix(c,c3,smoothstep(.55,1.,sin(u.y*5.+w*4.+t*.8)*.5+.5)*.45);gl_FragColor=vec4(c,1);}',
    plasma: HEAD + 'void main(){vec2 u=gl_FragCoord.xy/r*4.;float v=sin(u.x+t)+sin(u.y+t*.7)+sin(u.x+u.y+t*.5)+sin(length(u-2.)*2.-t);v=v/8.+.5;'
      + 'vec3 c=mix(c1,c2,smoothstep(0.,.6,v));c=mix(c,c3,smoothstep(.6,1.,v));gl_FragColor=vec4(c,1);}',
    liquid: HEAD + NOISE + 'void main(){vec2 u=gl_FragCoord.xy/min(r.x,r.y)*2.;vec2 q=vec2(fbm(u+t*.08),fbm(u+vec2(5.2,1.3)-t*.06));'
      + 'float v=fbm(u+q*2.2+t*.05);vec3 c=mix(c1,c2,smoothstep(.25,.75,v));c=mix(c,c3,smoothstep(.62,.9,length(q)*.8)*.6);gl_FragColor=vec4(c,1);}',
    grain: HEAD + NOISE + 'void main(){vec2 u=gl_FragCoord.xy/r;float d=length(u-vec2(.3+.15*sin(t*.4),.7+.1*cos(t*.3)));float e=length(u-vec2(.8+.1*cos(t*.35),.25));'
      + 'vec3 c=mix(c2,c1,smoothstep(0.,.75,d));c=mix(c3,c,smoothstep(0.,.45,e));c+=(h(gl_FragCoord.xy+fract(t))-.5)*.09;gl_FragColor=vec4(c,1);}',
  };

  const reduce = () => document.documentElement.dataset.motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shader(canvas, name, colors) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, make(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}'));
    gl.attachShader(prog, make(gl.FRAGMENT_SHADER, FRAG[name] || FRAG.aurora));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u = k => gl.getUniformLocation(prog, k);
    ['c1', 'c2', 'c3'].forEach((k, i) => gl.uniform3fv(u(k), hex(colors[i])));
    let visible = true;
    let raf = 0;
    const start = performance.now();
    const draw = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const hgt = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); }
      gl.uniform2f(u('r'), w, hgt);
      gl.uniform1f(u('t'), reduce() ? 4 : (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = () => { raf = 0; if (!canvas.isConnected) return; draw(); if (visible && !reduce()) raf = requestAnimationFrame(loop); };
    // Only animate while on screen.
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
      visible = es.some(e => e.isIntersecting);
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }) : null;
    if (io) io.observe(canvas);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); if (io) io.disconnect(); };
  }

  const CSS = `.bd-layer{position:absolute;inset:0;display:block;width:100%;height:100%;border-radius:inherit;pointer-events:none;overflow:hidden}
.bd-color{background:var(--bd1)}
.bd-image{background:center/cover no-repeat var(--bd1)}
.bd-mesh{background:radial-gradient(at 20% 25%,var(--bd2) 0,transparent 55%),radial-gradient(at 80% 70%,var(--bd3) 0,transparent 50%),var(--bd1);background-size:200% 200%,200% 200%,100% 100%;animation:bd-mesh 12s ease-in-out infinite alternate}
@keyframes bd-mesh{to{background-position:100% 60%,0% 30%,0 0}}
.bd-conic::before{content:'';position:absolute;inset:-50%;background:conic-gradient(from 0deg,var(--bd1),var(--bd2),var(--bd3),var(--bd1));animation:bd-spin 12s linear infinite}
@keyframes bd-spin{to{transform:rotate(360deg)}}
.bd-stripes{background:repeating-linear-gradient(135deg,var(--bd1) 0 22px,var(--bd2) 22px 44px);animation:bd-slide 3s linear infinite}
@keyframes bd-slide{to{background-position:62.2px 0}}
.bd-blobs{background:var(--bd1)}
.bd-blobs i{position:absolute;width:65%;aspect-ratio:1;border-radius:50%;filter:blur(28px);opacity:.9;animation:bd-float 11s ease-in-out infinite alternate}
.bd-blobs i:nth-child(1){left:-15%;top:-12%;background:var(--bd2)}
.bd-blobs i:nth-child(2){right:-20%;top:28%;background:var(--bd3);animation-delay:-4s}
.bd-blobs i:nth-child(3){left:15%;bottom:-25%;background:var(--bd2);animation-delay:-8s}
@keyframes bd-float{50%{transform:translate(18%,14%) scale(1.15)}to{transform:translate(-10%,22%) scale(.9)}}
[data-motion="off"] .bd-layer,[data-motion="off"] .bd-layer *,[data-motion="off"] .bd-layer::before{animation:none!important}
@media (prefers-reduced-motion:reduce){.bd-layer,.bd-layer *,.bd-layer::before{animation:none!important}}`;
  function addStyles() {
    if (document.getElementById('backdrop-css')) return;
    const st = document.createElement('style');
    st.id = 'backdrop-css';
    st.textContent = CSS;
    document.head.append(st);
  }

  // Draws a backdrop into el (replacing what was there). Returns the element made.
  function render(el, cfg) {
    addStyles();
    const b = cfg || {};
    const colors = [0, 1, 2].map(i => (b.colors && b.colors[i]) || DEFAULT_COLORS[i]);
    if (el._stopBackdrop) { el._stopBackdrop(); el._stopBackdrop = null; }
    el.querySelectorAll('.bd-layer').forEach(n => n.remove());
    el.style.setProperty('--bd1', colors[0]);
    el.style.setProperty('--bd2', colors[1]);
    el.style.setProperty('--bd3', colors[2]);
    el.dataset.backdrop = b.type || 'color';
    const layer = document.createElement(b.type === 'shader' ? 'canvas' : 'div');
    layer.className = 'bd-layer';
    layer.setAttribute('aria-hidden', 'true');
    if (b.type === 'image' && b.image && b.image.src) {
      layer.classList.add('bd-image');
      layer.style.backgroundImage = `url("${String(b.image.src).replace(/["\\]/g, '')}")`;
    } else if (b.type === 'animated') {
      layer.classList.add('bd-anim', `bd-${ANIMATED[b.animated] ? b.animated : 'mesh'}`);
      if (b.animated === 'blobs') layer.innerHTML = '<i></i><i></i><i></i>';
    } else if (b.type === 'shader') {
      layer.classList.add('bd-shader');
    } else {
      layer.classList.add('bd-color');
    }
    el.prepend(layer);
    if (b.type === 'shader') {
      const stop = shader(layer, SHADERS[b.shader] ? b.shader : 'aurora', colors);
      if (stop) el._stopBackdrop = stop;
      else layer.className = 'bd-layer bd-anim bd-mesh'; // no WebGL: a moving gradient instead
    }
    return layer;
  }

  window.AboutBackdrop = { render, SHADERS, ANIMATED, DEFAULT_COLORS };
})();
