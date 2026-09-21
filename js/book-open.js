/* Открытие: открытка подлетает → обложка раскрывается → камера зумится на первую страницу. */
(function () {
  const U = window.U, B = window.Book;
  const seg = (t, a, b, fn) => (fn || U.ease.inOutCubic)(U.clamp((t - a) / (b - a), 0, 1));
  const coverEase = U.bezier(0.5, 0.0, 0.18, 1);       // медленный отрыв, быстрая середина, мягкая посадка
  const REST = { sy: 12, sb: 20, so: 0.5 };
  const DURATION = 3000;

  /* Кадр анимации в момент t (мс). Отдельной функцией — чтобы можно было «перемотать» и проверить. */
  B.openingFrame = function (t, from) {
    const g = B.geo, pw = g.pw;
    const y0 = from ? from.y : 0, rz0 = from ? from.rz : 0;
    const panX = -pw * 0.24;

    const up = seg(t, 0, 650, U.ease.outCubic);            // подъём
    const down = seg(t, 760, 1750);                        // опускание по мере раскрытия
    const A = seg(t, 430, 1950, coverEase);                // раскрытие обложки, 0..1
    const zoom = seg(t, 1250, 2900);                       // наезд на страницу
    const pan = seg(t, 430, 1250, U.ease.inOutSine) * (1 - zoom);
    const lift = up * (1 - down);

    B.setLeaf(0, A);

    B.cam.s = U.lerp(U.lerp(g.s0, g.s0 * 1.09, up), 1, zoom);
    B.cam.cx = panX * pan;
    B.cam.ty = g.ty0 * (1 - zoom);

    B.tilt.y = U.lerp(y0, 0, up) - 26 * lift;
    B.tilt.rz = U.lerp(rz0, 0, up) - 1.6 * lift;
    B.tilt.rx = 8 * lift;

    // тень: на подъёме шире и мягче, затем растягивается на левую половину
    const cosA = Math.cos(A * Math.PI);
    B.shd.sy = REST.sy + 40 * lift;
    B.shd.sb = REST.sb + 30 * lift;
    B.shd.so = REST.so - 0.08 * lift;
    B.shd.sw = Math.max(1, 1 - cosA);
    B.shd.sx = 4 * A;
    B.render();
  };

  B.open = async function () {
    if (B.state !== 'closed') return;
    B.state = 'opening';
    B.stopIdle();
    B.hintEl.classList.remove('on');
    B.hintEl.classList.add('off');

    if (!U.reducedMotion()) {
      const from = { y: B.tilt.y, rz: B.tilt.rz };
      await U.tween(DURATION, (_, k) => B.openingFrame(k * DURATION, from), U.ease.linear);
    }
    finish();
  };

  function finish() {
    Object.assign(B.cam, B.readingCam());
    Object.assign(B.tilt, { y: 0, rz: 0, rx: 0 });
    Object.assign(B.shd, { sy: 12, sb: 20, so: 0.5, sw: 2, sx: 4 });
    B.setLeaf(0, 1);
    B.state = 'reading';
    B.viewportEl.classList.add('reading');
    B.current = 1;
    B.refreshOrder();
    B.render();
    B.onPageShown(1, 350);
  }

  /* ───────── Закрытие: то же движение, но назад ─────────
     p: 0 — читаем первую страницу, 1 — открытка закрыта. Палец может «перематывать» p вручную. */
  B.scrubClose = function (p) { B.openingFrame(DURATION * (1 - p)); };

  B.close = async function (fromP) {
    if (B.state !== 'reading') return;
    fromP = fromP || 0;
    B.state = 'closing';
    B.busy = true;
    B.stopWriting();
    B.cancelDrag();
    const tx0 = B.cam.tx;

    const jobs = [];
    if (B.current > 1) jobs.push(B.rewind());                 // с последней страницы: сначала листы возвращаются
    if (U.reducedMotion()) {
      B.cam.tx = 0;
      B.scrubClose(1);
    } else {
      const dur = 500 + 2100 * (1 - fromP);
      const ease = fromP > 0 ? U.ease.outCubic : U.ease.inOutSine;   // если тянули рукой — продолжаем без разгона
      jobs.push(U.tween(dur, e => {
        B.cam.tx = tx0 * (1 - e);
        B.scrubClose(fromP + (1 - fromP) * e);
      }, ease));
    }
    await Promise.all(jobs);
    finishClose();
  };

  function finishClose() {
    B.setLeaf(0, 0);
    B.viewportEl.classList.remove('reading');
    B.state = 'closed';
    B.busy = false;
    B.resetBook();                                            // страницы и «написанное» — с чистого листа
  }
})();
