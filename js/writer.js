/* «Письмо пером без пера»: строки проявляются слева направо мягкой кромкой,
   темп следует ритму слов — быстрее внутри слова, короткая пауза между словами. */
(function () {
  const U = window.U;
  const Writer = window.Writer = {};

  const SPEED = 9.2;          // em/с — скорость внутри слова
  const WORD_GAP = 85;        // мс — «перо приподнято» между словами
  const ROW_GAP = 260;        // мс — между строками
  const STANZA_GAP = 460;     // мс — дополнительно перед новой строфой
  const EDGE_EM = 0.85;       // мягкость кромки, em
  const PAD_EM = 0.6;         // запас по краям строки под выносные элементы букв

  const penEase = k => 0.55 * k + 0.45 * U.ease.inOutSine(k);

  /* Строка -> набор слов с их положением; на этом строится график движения кромки */
  function prepare(rowEl, fs, stanzaGap) {
    const ink = rowEl.querySelector('.ink');
    const words = [...ink.querySelectorAll('.w')].map(w => ({ x0: w.offsetLeft, x1: w.offsetLeft + w.offsetWidth }));
    const segs = [];
    let t = 0;
    words.forEach((w, i) => {
      const dur = ((w.x1 - w.x0) / fs) / SPEED * 1000;
      segs.push({ t0: t, t1: t + dur, x0: w.x0, x1: w.x1, pen: true });
      t += dur;
      if (i < words.length - 1) {
        segs.push({ t0: t, t1: t + WORD_GAP, x0: w.x1, x1: words[i + 1].x0, pen: false });
        t += WORD_GAP;
      }
    });
    const first = words[0].x0, last = words[words.length - 1].x1;
    return {
      el: rowEl, ink, segs, dur: t, first, last,
      total: ink.offsetWidth, fs,
      gapAfter: ROW_GAP + (stanzaGap ? STANZA_GAP : 0)
    };
  }

  function paint(it, tau) {
    let seg = it.segs[it.segs.length - 1];
    for (let i = 0; i < it.segs.length; i++) if (tau < it.segs[i].t1) { seg = it.segs[i]; break; }
    const k = U.clamp((tau - seg.t0) / (seg.t1 - seg.t0 || 1), 0, 1);
    const x = seg.x0 + (seg.x1 - seg.x0) * (seg.pen ? penEase(k) : k);
    const f = U.clamp((x - it.first) / ((it.last - it.first) || 1), 0, 1);
    const edge = EDGE_EM * it.fs, pad = PAD_EM * it.fs;
    it.ink.style.setProperty('--x', (x + (edge + pad) * f).toFixed(1) + 'px');
  }

  function reveal(it) {
    it.ink.classList.remove('wet');
    it.ink.classList.add('done');
    it.ink.style.removeProperty('--x');
  }

  /* rows: [{el, gapBefore}] — DOM-строки страницы в порядке письма.
     opts: { fs, delay, onRow(idx), onDone(skipped) } */
  Writer.play = function (rows, opts) {
    const items = rows.map((r, i) => {
      const next = rows[i + 1];
      return prepare(r.el, opts.fs, next && next.gapBefore);
    });
    let idx = 0, t = -(opts.delay || 0), last = performance.now(), raf = 0, stopped = false;
    const handle = { finished: false };

    function finishAll(skipped) {
      cancelAnimationFrame(raf);
      stopped = true;
      for (; idx < items.length; idx++) { reveal(items[idx]); opts.onRow && opts.onRow(idx); }
      handle.finished = true;
      opts.onDone && opts.onDone(skipped);
    }

    function frame(now) {
      if (stopped) return;
      t += U.clamp(now - last, 0, 100);          // не даём времени «прыгать» после возврата на вкладку
      last = now;
      while (idx < items.length && t >= 0) {
        const it = items[idx];
        if (t < it.dur) { it.ink.classList.add('wet'); paint(it, t); break; }
        reveal(it);
        opts.onRow && opts.onRow(idx);
        t = t - it.dur - it.gapAfter;
        idx++;
      }
      if (idx >= items.length) { finishAll(false); return; }
      raf = requestAnimationFrame(frame);
    }

    handle.skip = () => { if (!handle.finished) finishAll(true); };
    handle.stop = () => { stopped = true; cancelAnimationFrame(raf); };
    raf = requestAnimationFrame(frame);
    return handle;
  };
})();
