/* Книга: геометрия, камера, тень, «дыхание» закрытой открытки. */
(function () {
  const U = window.U;
  const B = window.Book = { state: 'closed', leaves: [], pages: [], current: 1 };

  B.cam  = { s: 1, cx: 0, cy: 0, tx: 0, ty: 0 };   // камера: масштаб, точка в координатах книги, сдвиг в px
  B.tilt = { y: 0, rz: 0, rx: 0 };                 // «парение» открытки
  B.shd  = { sx: 0, sy: 12, sb: 20, so: .5, sw: 1 };

  /* Размеры страницы подбираются под экран. Страница — это «размер чтения» (масштаб 1). */
  B.measure = function () {
    const vw = window.innerWidth, vh = window.innerHeight;
    const AW = vw * 0.94, AH = vh * 0.94;
    const aspect = (vh < 520 && vw > vh) ? 0.95 : U.clamp(AW / AH, 0.56, 0.78);
    const pw = Math.min(AW, AH * aspect, 720);
    const ph = pw / aspect;
    const s0 = Math.min(0.6 * vh / ph, 0.8 * vw / pw, 1);      // масштаб закрытой открытки
    const ty0 = -Math.min(30, vh * 0.035);                     // чуть выше центра — под ней подпись
    B.geo = { vw, vh, pw, ph, aspect, s0, ty0 };
    const root = document.documentElement.style;
    root.setProperty('--pw', pw.toFixed(2) + 'px');
    root.setProperty('--ph', ph.toFixed(2) + 'px');
    return B.geo;
  };

  B.closedCam = () => ({ s: B.geo.s0, cx: 0, cy: 0, tx: 0, ty: B.geo.ty0 });
  B.readingCam = () => ({ s: 1, cx: 0, cy: 0, tx: 0, ty: 0 });

  B.render = function () {
    const c = B.cam, t = B.tilt, s = B.shd;
    B.camEl.style.transform =
      `translate3d(${(-c.cx * c.s + c.tx).toFixed(2)}px, ${(-c.cy * c.s + c.ty).toFixed(2)}px, 0) scale(${c.s.toFixed(4)})`;
    B.tiltEl.style.transform = `translate3d(0, ${t.y.toFixed(2)}px, 0) rotate(${t.rz.toFixed(3)}deg)`;
    B.bookEl.style.transform = t.rx ? `rotateX(${t.rx.toFixed(3)}deg)` : '';
    const st = B.shadowEl.style;
    st.setProperty('--sx', s.sx.toFixed(2) + 'px');
    st.setProperty('--sy', s.sy.toFixed(2) + 'px');
    st.setProperty('--sb', s.sb.toFixed(2) + 'px');
    st.setProperty('--so', s.so.toFixed(3));
    st.setProperty('--sw', s.sw.toFixed(4));
  };

  /* Положение подсказки: сразу под закрытой открыткой */
  B.placeHint = function () {
    const g = B.geo;
    const bottom = g.vh / 2 + g.ty0 + (g.ph * g.s0) / 2;
    B.hintEl.style.top = Math.round(bottom + Math.max(16, g.vh * 0.028)) + 'px';
  };

  /* Тихое «дыхание» закрытой открытки, пока она ждёт клика */
  B.startIdle = function () {
    B.stopIdle();
    const t0 = performance.now();
    const loop = now => {
      if (B.state !== 'closed') return;
      const t = (now - t0) / 1000;
      B.tilt.y = Math.sin(t * 1.5) * 3.5;
      B.tilt.rz = Math.sin(t * 0.9) * 0.22;
      B.shd.sy = 12 - B.tilt.y * 0.6;
      B.shd.sb = 20 - B.tilt.y * 0.5;
      B.render();
      B.idleRaf = requestAnimationFrame(loop);
    };
    B.idleRaf = requestAnimationFrame(loop);
  };
  B.stopIdle = function () { cancelAnimationFrame(B.idleRaf); };

  B.setClosed = function () {
    Object.assign(B.cam, B.closedCam());
    Object.assign(B.tilt, { y: 0, rz: 0, rx: 0 });
    Object.assign(B.shd, { sx: 0, sy: 12, sb: 20, so: .5, sw: 1 });
    B.render();
  };

  B.bind = function () {
    B.viewportEl = document.getElementById('viewport');
    B.camEl = document.getElementById('camera');
    B.tiltEl = document.getElementById('tilt');
    B.bookEl = document.getElementById('book');
    B.shadowEl = document.getElementById('shadow');
    B.hintEl = document.getElementById('hint');
    B.coverEl = document.getElementById('cover');
  };
})();
