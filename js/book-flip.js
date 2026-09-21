/* Перелистывание: анимация, перетаскивание пальцем/мышью, клавиши, колесо.
   На краях книги жест закрывает её: назад с первой страницы и вперёд с последней. */
(function () {
  const U = window.U, B = window.Book;
  const flipEase = U.bezier(0.45, 0.04, 0.2, 1);

  B.busy = false;

  B.canNext = () => B.state === 'reading' && B.current < B.leaves.length - 1;
  B.canPrev = () => B.state === 'reading' && B.current > 1;

  /* Что происходит, когда страница стала видимой */
  B.onPageShown = function (i, delay) {
    const lf = B.leaves[i];
    if (!lf) return;
    if (lf.kind === 'text') B.startWriting(i, delay || 0);
    else if (lf.kind === 'flower' && window.Flower) window.Flower.play(lf, delay || 0);
  };

  function animateLeaf(i, to, dur) {
    const from = B.leaves[i].t, epoch = B.epoch;
    return U.tween(dur, e => { if (epoch === B.epoch) B.setLeaf(i, from + (to - from) * e); }, flipEase);
  }

  function landed(leafIndex, forward) {
    B.setLeaf(leafIndex, forward ? 1 : 0);
    B.endBend(leafIndex);
    B.current = forward ? leafIndex + 1 : leafIndex;
    B.refreshOrder();
    B.busy = false;
    const lf = B.leaves[B.current];
    if (forward) B.onPageShown(B.current, 320);
    else if (lf.done) B.showCorner(lf, true);
  }

  B.next = async function () {
    if (B.busy || B.state !== 'reading') return;
    if (!B.canNext()) { B.close(0); return; }               // последняя страница — книга закрывается
    B.busy = true;
    B.finishWriting();
    const i = B.current;
    B.showCorner(B.leaves[i], false);
    B.beginBend(i);
    const epoch = B.epoch;
    await animateLeaf(i, 1, U.reducedMotion() ? 1 : 1150);
    if (epoch === B.epoch) landed(i, true);
  };

  B.prev = async function () {
    if (B.busy || B.state !== 'reading') return;
    if (!B.canPrev()) { B.close(0); return; }               // первая страница — книга закрывается
    B.busy = true;
    B.stopWriting();
    const i = B.current - 1;
    B.showCorner(B.leaves[B.current], false);
    B.beginBend(i);
    const epoch = B.epoch;
    await animateLeaf(i, 0, U.reducedMotion() ? 1 : 1050);
    if (epoch === B.epoch) landed(i, false);
  };

  /* Перемотка: перед закрытием листы один за другим возвращаются на правую сторону */
  B.rewind = async function () {
    const turned = [];
    for (let i = B.current - 1; i >= 1; i--) turned.push(i);
    if (!turned.length) return;
    const bend = turned.length <= 4;                         // изгиб для всех сразу — слишком тяжело
    const stagger = U.clamp(430 / Math.max(1, turned.length - 1), 40, 110);
    const dur = U.reducedMotion() ? 1 : 640;
    await Promise.all(turned.map((i, k) => U.wait(k * stagger).then(async () => {
      if (bend) B.beginBend(i);
      await animateLeaf(i, 0, dur);
      B.setLeaf(i, 0);
      B.endBend(i);
    })));
    B.current = 1;
    B.refreshOrder();
  };

  /* ───────── жесты ───────── */
  let drag = null;

  function onDown(e) {
    if (B.state !== 'reading' || B.busy) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, mode: '', dir: 0, leaf: -1, p: 0, samples: [{ x: e.clientX, t: performance.now() }] };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    drag.samples.push({ x: e.clientX, t: performance.now() });
    if (drag.samples.length > 6) drag.samples.shift();

    if (!drag.active) {
      if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.3) { drag = null; return; }         // вертикальный жест — не наш
      drag.dir = dx < 0 ? 1 : -1;
      drag.active = true;
      B.busy = true;
      B.viewportEl.classList.add('dragging');
      try { B.viewportEl.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }

      if (drag.dir === 1 ? B.canNext() : B.canPrev()) {
        drag.mode = 'flip';
        drag.leaf = drag.dir === 1 ? B.current : B.current - 1;
        if (drag.dir === 1) { B.finishWriting(); B.showCorner(B.leaves[B.current], false); } else B.stopWriting();
        B.beginBend(drag.leaf);
      } else if (drag.dir === -1) {
        drag.mode = 'close';                                                  // первая страница, жест назад
        B.stopWriting();
      } else {
        drag.mode = 'bump';                                                   // последняя страница, жест вперёд
      }
    }

    const span = B.geo.pw * B.cam.s * 0.92;
    if (drag.mode === 'flip') {
      const t = drag.dir === 1 ? -dx / span : 1 - dx / span;
      B.setLeaf(drag.leaf, U.clamp(t, 0, 1));
    } else if (drag.mode === 'close') {
      drag.p = U.clamp(dx / span, 0, 1);                                      // палец «перематывает» открытие назад
      B.scrubClose(drag.p);
    } else {
      B.cam.tx = U.clamp(dx * 0.3, -42, 0);                                   // лёгкое сопротивление у края
      B.render();
    }
  }

  async function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    B.viewportEl.classList.remove('dragging');
    if (!d.active) return;

    const epoch = B.epoch;
    const s = d.samples, a = s[0], b = s[s.length - 1];
    const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;            // px/мс, «влево» < 0

    if (d.mode === 'close') {
      if (d.p > 0.26 || v > 0.45) { B.close(d.p); return; }
      await U.tween(260 + 300 * d.p, k => B.scrubClose(d.p * (1 - k)), U.ease.outCubic);
      if (epoch !== B.epoch) return;
      B.scrubClose(0);
      B.busy = false;
      const cur = B.leaves[B.current];
      if (cur.kind === 'text' && !cur.done) B.startWriting(B.current, 150);
      return;
    }

    if (d.mode === 'bump') {
      if (b.x - d.x0 < -70 || v < -0.45) { B.close(0); return; }
      const tx0 = B.cam.tx;
      await U.tween(260, k => { B.cam.tx = tx0 * (1 - k); B.render(); }, U.ease.outCubic);
      if (epoch !== B.epoch) return;
      B.cam.tx = 0;
      B.render();
      B.busy = false;
      return;
    }

    const t = B.leaves[d.leaf].t;
    const forward = d.dir === 1;
    const go = forward ? (t > 0.3 || v < -0.4) : (t < 0.7 || v > 0.4);
    const target = forward ? (go ? 1 : 0) : (go ? 0 : 1);

    await animateLeaf(d.leaf, target, 250 + 800 * Math.abs(target - t));
    if (epoch !== B.epoch) return;
    if (go) landed(d.leaf, forward);
    else {                                                            // отпустили рано — лист вернулся
      B.setLeaf(d.leaf, target);
      B.endBend(d.leaf);
      B.refreshOrder();
      B.busy = false;
      const lf = B.leaves[B.current];
      if (forward && lf.done) B.showCorner(lf, true);
      if (!forward) { const cur = B.leaves[B.current]; if (cur.kind === 'text' && !cur.done) B.startWriting(B.current, 200); }
    }
  }

  B.cancelDrag = function () { drag = null; B.viewportEl.classList.remove('dragging'); };

  B.bindInput = function () {
    const vp = B.viewportEl;
    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp);
    vp.addEventListener('pointercancel', onUp);

    B.coverEl.addEventListener('click', () => B.open());

    let acc = 0, lock = 0;
    vp.addEventListener('wheel', e => {
      e.preventDefault();
      if (B.state !== 'reading' || B.busy) return;
      const now = performance.now();
      if (now < lock) { lock = Math.max(lock, now + 220); return; }   // пока идёт «хвост» инерции — ждём
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(acc) > 50) { (acc > 0 ? B.next : B.prev)(); acc = 0; lock = now + 900; }
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if (B.state === 'closed' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); B.open(); return; }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); B.next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); B.prev(); }
    });
  };

  /* Клик по загнутому уголку */
  B.bindCorners = function () {
    B.leaves.forEach(lf => {
      if (lf.corner) lf.corner.addEventListener('click', e => { e.stopPropagation(); B.next(); });
    });
  };
})();
