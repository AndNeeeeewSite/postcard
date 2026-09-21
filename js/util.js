/* Мелкие помощники: плавность, твины, ожидание. */
(function () {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* cubic-bezier как в CSS */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t;
    const Y = t => ((ay * t + by) * t + cy) * t;
    const dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {            // Ньютон
        const err = X(t) - x;
        if (Math.abs(err) < 1e-5) return Y(t);
        const d = dX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= err / d;
      }
      let lo = 0, hi = 1;                      // запасной вариант — деление пополам
      t = x;
      for (let i = 0; i < 24; i++) {
        const v = X(t);
        if (Math.abs(v - x) < 1e-5) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return Y(t);
    };
  }

  const ease = {
    linear: t => t,
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    inOutQuad: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outQuart: t => 1 - Math.pow(1 - t, 4),
    inCubic: t => t * t * t,
    outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };

  /* Твин на requestAnimationFrame. Возвращает Promise с методом cancel(). */
  function tween(dur, update, easeFn) {
    const fn = easeFn || ease.inOutCubic;
    let raf = 0, done = false, resolve;
    const p = new Promise(r => { resolve = r; });
    const t0 = performance.now();
    function frame(now) {
      if (done) return;
      const k = clamp((now - t0) / dur, 0, 1);
      update(fn(k), k);
      if (k < 1) raf = requestAnimationFrame(frame);
      else { done = true; resolve(true); }
    }
    raf = requestAnimationFrame(frame);
    p.cancel = () => { if (done) return; done = true; cancelAnimationFrame(raf); resolve(false); };
    return p;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.U = { clamp, lerp, bezier, ease, tween, wait, reducedMotion };
})();
