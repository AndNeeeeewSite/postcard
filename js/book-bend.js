/* Изгиб листа при перелистывании.
   На время поворота лист заменяется цепочкой узких полос: каждая довёрнута чуть больше
   предыдущей, поэтому бумага гнётся, а не вращается жёстко. Форма изгиба зависит только
   от прогресса t, так что это работает и при перетаскивании пальцем. */
(function () {
  const U = window.U, B = window.Book;
  const N = 10;                 // число полос
  const AMP = 20;               // на сколько градусов край листа опережает/отстаёт от корешка в пике
  const OVERLAP = 1.2;          // нахлёст полос, px — прячет швы

  const div = cls => { const d = document.createElement('div'); d.className = cls; return d; };

  function slice(src, cls, left, W) {
    const c = src.cloneNode(true);
    c.className = cls;
    c.querySelectorAll('.corner, .shade, .under').forEach(n => n.remove());
    c.style.left = left.toFixed(2) + 'px';
    c.style.width = W.toFixed(2) + 'px';
    return c;
  }

  B.beginBend = function (i) {
    const lf = B.leaves[i];
    if (!lf || lf.kind !== 'text' || lf.bend || U.reducedMotion()) return;
    const W = B.geo.pw, w = W / N, wp = w + OVERLAP;

    const root = div('bend');
    const segs = [];
    let parent = root;
    for (let k = 0; k < N; k++) {
      const seg = div('seg');
      seg.style.width = wp.toFixed(2) + 'px';
      seg.style.left = k ? w.toFixed(2) + 'px' : '0px';

      const f = div('sface sfront');
      f.append(slice(lf.front, 'slice front paper page', -k * w, W), div('sshade'));
      const b = div('sface sback');
      b.append(slice(lf.back, 'slice back paper blank', -(W - k * w - wp), W), div('sshade'));

      seg.append(f, b);
      parent.appendChild(seg);
      segs.push({ seg, f, b });
      parent = seg;
    }

    lf.el.insertBefore(root, lf.el.firstChild);
    lf.front.style.display = 'none';
    lf.back.style.display = 'none';
    lf.bend = { root, segs };
    B.updateBend(i, lf.t);
  };

  B.updateBend = function (i, t) {
    const lf = B.leaves[i], bd = lf && lf.bend;
    if (!bd) return;
    // приращение угла на каждую полосу: сначала край опережает, к концу — отстаёт
    const d = (AMP / (N - 1)) * Math.sin(2 * Math.PI * t) * Math.pow(Math.sin(Math.PI * t), 0.35);
    const cosDeg = deg => Math.cos(deg * Math.PI / 180);
    for (let k = 0; k < N; k++) {
      const s = bd.segs[k];
      if (k) s.seg.style.transform = `rotateY(${(-d).toFixed(3)}deg)`;
      // затемнение плавное: у каждой полосы градиент между углами её левого и правого края
      const a0 = 180 * t + k * d, a1 = 180 * t + (k + 1) * d;
      const c0 = cosDeg(a0), c1 = cosDeg(a1);
      const f0 = c0 > 0 ? 0.62 * (1 - c0) : 0;      // лицевая сторона темнеет по мере отворота
      const f1 = c1 > 0 ? 0.62 * (1 - c1) : 0;
      const b0 = c0 < 0 ? 0.62 * (1 + c0) : 0;      // оборот светлеет по мере укладывания
      const b1 = c1 < 0 ? 0.62 * (1 + c1) : 0;
      s.f.style.setProperty('--s0', f0.toFixed(3)); s.f.style.setProperty('--s1', f1.toFixed(3));
      // у обратной стороны локальная ось зеркальна: слева — правый край полосы
      s.b.style.setProperty('--s0', b1.toFixed(3)); s.b.style.setProperty('--s1', b0.toFixed(3));
    }
  };

  B.endBend = function (i) {
    const lf = B.leaves[i];
    if (!lf || !lf.bend) return;
    lf.bend.root.remove();
    lf.front.style.display = '';
    lf.back.style.display = '';
    lf.bend = null;
  };
})();
