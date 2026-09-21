/* Финальный цветок: векторный, строится кодом. Лепестки кольцами (георгин), стебель, листья. */
(function () {
  const Flower = window.Flower = { played: false };

  const CX = 200, CY = 232;                 // центр цветка в системе viewBox 400×560
  const STEM = 'M199 560 C195 505 214 440 201 372 C192 322 205 272 200 236';
  const n = v => +v.toFixed(2);

  function rng(seed) {                       // небольшая «неровность», чтобы цветок не выглядел штампом
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  const RINGS = [
    { n: 13, L: 160, w: 74, c: ['#b03623', '#d5563a', '#ee8d62'], s: '#8a2a1a' },
    { n: 13, L: 140, w: 68, c: ['#c4472a', '#e26d3e', '#f4a170'], s: '#8f321c' },
    { n: 11, L: 118, w: 60, c: ['#d55a2f', '#ee8848', '#f9bb82'], s: '#9a4020' },
    { n: 9,  L: 96,  w: 52, c: ['#e2773a', '#f3a259', '#fbcf8e'], s: '#a55026' },
    { n: 7,  L: 74,  w: 44, c: ['#ec9445', '#f8bf6e', '#fde2ad'], s: '#ad5f2a' },
    { n: 5,  L: 52,  w: 35, c: ['#f2ab49', '#fad07b', '#fff0c4'], s: '#b26d2c' }
  ];

  function petal(L, w) {
    const a = 0.62 * w, b = 0.58 * w;
    return `M0 0C${n(-a)} ${n(-.12 * L)} ${n(-b)} ${n(-.66 * L)} 0 ${n(-L)}C${n(b)} ${n(-.66 * L)} ${n(a)} ${n(-.12 * L)} 0 0Z`;
  }

  function leaf(L, w, bend) {
    const l = 0.72 * w + bend, r = 0.62 * w - bend;
    return `M0 0C${n(-l)} ${n(-.18 * L)} ${n(-r)} ${n(-.7 * L)} 0 ${n(-L)}C${n(r)} ${n(-.7 * L)} ${n(l)} ${n(-.18 * L)} 0 0Z`;
  }

  function leafVeins(L, w) {
    let d = `M0 0Q${n(.05 * w)} ${n(-.5 * L)} 0 ${n(-.94 * L)}`;
    [.26, .44, .62].forEach(t => {
      const y = -t * L, dx = w * (.42 - t * .28), dy = L * .11;
      d += `M0 ${n(y)}L${n(-dx)} ${n(y - dy)}M0 ${n(y)}L${n(dx)} ${n(y - dy)}`;
    });
    return d;
  }

  /* [x, y, угол°, длина, ширина, изгиб, доля высоты стебля для задержки] */
  const LEAVES = [
    [199, 486, -62, 132, 50, 4, 0.24],
    [206, 428, 58, 116, 46, -3, 0.42],
    [201, 372, -48, 88, 36, 3, 0.62],
    [199, 330, 44, 66, 28, -2, 0.78]
  ];

  const SPARKS = [[64, 118, 0.2], [338, 150, 1.4], [44, 300, 2.3], [356, 318, 0.9], [118, 34, 1.9], [292, 52, 2.8]];

  Flower.markup = function () {
    const rnd = rng(20240301);
    let defs = '', back = '', head = '';

    RINGS.forEach((r, k) => {
      defs += `<linearGradient id="pg${k}" x1="0" y1="1" x2="0" y2="0">` +
        `<stop offset="0" stop-color="${r.c[0]}"/><stop offset=".5" stop-color="${r.c[1]}"/><stop offset="1" stop-color="${r.c[2]}"/></linearGradient>`;
      const step = 360 / r.n, off = (k % 2) * step / 2 + k * 9;
      const t0 = 1.55 + k * 0.46;
      for (let j = 0; j < r.n; j++) {
        const L = r.L * (0.96 + rnd() * 0.08), w = r.w * (0.95 + rnd() * 0.1);
        const ang = off + j * step + (rnd() - .5) * 4;
        const d = n(t0 + j * 0.05);
        head += `<g transform="rotate(${n(ang)})"><g class="pt-in" style="--d:${d}s">` +
          `<path class="pt-body" pathLength="1" d="${petal(L, w)}" fill="url(#pg${k})" stroke="${r.s}" stroke-opacity=".5" stroke-width="1.1" stroke-linejoin="round"/>` +
          `<path class="pt-vein" d="M0 ${n(-.07 * L)}L0 ${n(-.7 * L)}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1" stroke-linecap="round"/>` +
          `</g></g>`;
      }
    });

    defs += `<linearGradient id="fl-stem" gradientUnits="userSpaceOnUse" x1="0" y1="560" x2="0" y2="500">` +
      `<stop offset="0" stop-color="#6b7a3a" stop-opacity="0"/><stop offset="1" stop-color="#6b7a3a"/></linearGradient>` +
      `<linearGradient id="fl-leaf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#5f6e30"/><stop offset=".55" stop-color="#84944a"/><stop offset="1" stop-color="#b3bf74"/></linearGradient>` +
      `<radialGradient id="fl-glow"><stop offset="0" stop-color="#ffc98a" stop-opacity=".55"/><stop offset=".55" stop-color="#ffd9a8" stop-opacity=".2"/><stop offset="1" stop-color="#ffe8c8" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="fl-core" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#d9903a"/><stop offset=".6" stop-color="#a5581f"/><stop offset="1" stop-color="#6e3512"/></radialGradient>`;

    LEAVES.forEach(([x, y, a, L, w, bend, f]) => {
      back += `<g transform="translate(${x} ${y}) rotate(${a})"><g class="lf-in" style="--d:${n(0.15 + f * 1.4)}s">` +
        `<path d="${leaf(L, w, bend)}" fill="url(#fl-leaf)" stroke="#4d5a25" stroke-opacity=".7" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<path d="${leafVeins(L, w)}" fill="none" stroke="#f0f4d0" stroke-opacity=".42" stroke-width="1" stroke-linecap="round"/>` +
        `</g></g>`;
    });

    let stamens = '';
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, r1 = 24;
      stamens += `<circle cx="${n(Math.cos(a) * r1)}" cy="${n(Math.sin(a) * r1)}" r="3.1" fill="#f7d47e"/>`;
    }
    for (let i = 0; i < 22; i++) {
      const a = (i + .5) / 22 * Math.PI * 2, r2 = 32;
      stamens += `<circle cx="${n(Math.cos(a) * r2)}" cy="${n(Math.sin(a) * r2)}" r="2.2" fill="#fbe6a6" fill-opacity=".9"/>`;
    }

    const sparks = SPARKS.map(([x, y, d]) =>
      `<g transform="translate(${x} ${y})"><path class="spark" style="--d:${d}s" d="M0-7Q0 0 7 0Q0 0 0 7Q0 0-7 0Q0 0 0-7Z" fill="#e6b45a"/></g>`).join('');

    return `<svg viewBox="16 0 368 560" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs>` +
      `<circle class="glow" cx="${CX}" cy="${CY}" r="215" fill="url(#fl-glow)"/>` +
      `<g class="sway">` +
        `<path class="stem" pathLength="1" d="${STEM}" fill="none" stroke="url(#fl-stem)" stroke-width="6" stroke-linecap="round"/>` +
        back +
        `<g transform="translate(${CX} ${CY})"><g class="head">${head}` +
          `<g class="ct"><circle r="19" fill="url(#fl-core)" stroke="#5c2c0e" stroke-opacity=".5" stroke-width="1"/>${stamens}</g>` +
        `</g></g>` +
      `</g>${sparks}</svg>`;
  };

  Flower.mount = function (bloomEl) { bloomEl.innerHTML = Flower.markup(); };

  /* Запуск прорисовки. Если уже показывали — сразу готовый цветок. */
  Flower.play = function (lf, delay) {
    const el = lf.bloom;
    if (!el || lf.played) return;
    lf.played = true;
    if (Flower.played || (window.U && window.U.reducedMotion())) el.classList.add('instant');
    setTimeout(() => { el.classList.add('play'); Flower.played = true; }, delay || 0);
  };
})();
