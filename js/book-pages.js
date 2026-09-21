/* Страницы: построение DOM, положение листов, тени поворота, запуск «письма». */
(function () {
  const B = window.Book;
  B.written = new Set();          // id строк стиха, которые уже «написаны»
  B.epoch = 0;                    // растёт при каждой пересборке страниц — отсекает устаревшие анимации

  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function rowHTML(text) {
    const words = text.split(' ').map(w =>
      `<span class="w">${esc(w).replace(/’/g, '<span class="ap">’</span>')}</span>`);
    return `<span class="ink">${words.join(' ')}</span>`;
  }

  /* ── построение ── */
  B.buildPages = function (L) {
    B.leaves.forEach((lf, i) => { if (i > 0) lf.el.remove(); });
    B.leaves = [{ el: B.coverEl, kind: 'cover', t: 0 }];
    B.L = L;
    B.epoch++;

    L.pages.forEach(p => {
      const leaf = el('div', 'leaf');
      const front = el('div', 'face front paper page');
      const back = el('div', 'face back paper blank');
      front.style.setProperty('--fs', L.fs.toFixed(2) + 'px');
      front.style.setProperty('--lh', L.lh.toFixed(2) + 'px');
      front.style.setProperty('--f', L.frame.toFixed(2) + 'px');
      front.style.setProperty('--padX', L.padX.toFixed(2) + 'px');
      front.style.setProperty('--padY', L.padY.toFixed(2) + 'px');
      front.appendChild(el('div', 'frame'));

      const entry = { el: leaf, front, back, kind: p.kind, t: 0, rows: [], done: false };

      if (p.kind === 'text') {
        const text = el('div', 'text');
        p.rows.forEach(r => {
          const row = el('p', 'row');
          row.innerHTML = rowHTML(r.text);
          if (r.cont) row.classList.add('cont');
          if (r.gapBefore) row.style.marginTop = L.gap.toFixed(2) + 'px';
          text.appendChild(row);
          entry.rows.push({ el: row, lineId: r.lineId, lineEnd: r.lineEnd, gapBefore: r.gapBefore });
        });
        front.appendChild(text);
      } else {
        const bloom = el('div', 'bloom');
        if (window.Flower) window.Flower.mount(bloom);
        front.appendChild(bloom);
        entry.bloom = bloom;
      }

      front.appendChild(el('div', 'under'));
      front.appendChild(el('div', 'shade'));
      back.appendChild(el('div', 'shade'));

      if (p.kind === 'text') {                                  // уголок — на всех, кроме последней
        const corner = el('button', 'corner');
        corner.type = 'button';
        corner.setAttribute('aria-label', 'Далі');
        corner.innerHTML = '<span class="hole"></span><span class="flap"></span>';
        front.appendChild(corner);
        entry.corner = corner;
      }

      leaf.append(front, back);
      B.bookEl.appendChild(leaf);
      B.leaves.push(entry);
    });
    B.refreshOrder();
  };

  /* ── порядок листов и видимость ── */
  B.refreshOrder = function () {
    const n = B.leaves.length;
    B.leaves.forEach((lf, i) => {
      const turned = lf.t >= 1;
      const moving = lf.t > 0 && lf.t < 1;
      lf.el.style.zIndex = moving ? 1000 : (turned ? 100 + i : 100 + n - i);
      // далеко лежащие листы не рисуем — они всё равно закрыты соседними
      const near = i === 0 ? lf.t < 1 || B.current <= 2 : Math.abs(i - B.current) <= 2 || moving;
      lf.el.hidden = !near && !moving;
    });
  };

  /* ── поворот листа: t от 0 (справа) до 1 (слева) ── */
  B.setLeaf = function (i, t) {
    const lf = B.leaves[i];
    lf.t = t;
    lf.el.style.transform = t <= 0 ? '' : `rotateY(${(-180 * t).toFixed(3)}deg)`;
    const th = t * Math.PI, c = Math.cos(th);
    const front = lf.front || lf.el.querySelector('.front');
    const back = lf.back || lf.el.querySelector('.back');
    front.style.setProperty('--shade', t < 0.5 ? (0.7 * (1 - c)).toFixed(3) : '0');
    back.style.setProperty('--shade', t > 0.5 ? (0.7 * (1 + c)).toFixed(3) : '0');
    // тень от поворачивающегося листа на тот, что лежит под ним
    const under = B.leaves[i + 1];
    if (under && under.front) under.front.style.setProperty('--under', (Math.sin(th) * 0.45).toFixed(3));
    if (lf.bend) B.updateBend(i, t);
    const zMoving = t > 0 && t < 1;
    if (zMoving !== !!lf.moving) { lf.moving = zMoving; B.refreshOrder(); }
    // несколько листов в воздухе (перемотка): выше тот, что сейчас ближе к зрителю
    if (zMoving) lf.el.style.zIndex = 1000 + Math.round(Math.sin(th) * 90);
  };

  /* ── письмо ── */
  B.showCorner = function (lf, on) { if (lf.corner) lf.corner.classList.toggle('on', on); };

  B.startWriting = function (i, delay) {
    const lf = B.leaves[i];
    B.stopWriting();
    if (!lf || lf.kind !== 'text') return;
    const pending = [];
    lf.rows.forEach(r => {
      if (B.written.has(r.lineId)) r.el.querySelector('.ink').classList.add('done');
      else pending.push(r);
    });
    if (!pending.length) { lf.done = true; B.showCorner(lf, true); return; }
    if (U.reducedMotion()) {
      pending.forEach(r => { r.el.querySelector('.ink').classList.add('done'); B.written.add(r.lineId); });
      lf.done = true; B.showCorner(lf, true); return;
    }
    B.writer = {
      page: i,
      handle: Writer.play(pending, {
        fs: B.L.fs,
        delay: delay || 0,
        onRow: idx => { if (pending[idx].lineEnd) B.written.add(pending[idx].lineId); },
        onDone: () => { lf.done = true; B.writer = null; B.showCorner(lf, true); }
      })
    };
  };

  B.stopWriting = function () {
    if (B.writer) { B.writer.handle.stop(); B.writer = null; }
  };

  /* Быстро дописать текущую страницу (если читатель уже листает) */
  B.finishWriting = function () {
    if (B.writer) B.writer.handle.skip();
  };
})();
