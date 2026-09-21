/* Вёрстка стиха: подбор шрифта под страницу, перенос строк, разбивка на страницы по месту. */
(function () {
  const U = window.U;
  const FAMILY = '"Marck Script"';
  const ctx = document.createElement('canvas').getContext('2d');
  const width = (text, fs) => { ctx.font = `${fs}px ${FAMILY}`; return ctx.measureText(text).width; };

  /* Перенос строки стиха по словам. Если строка не влезает — делим на равные по длине ряды. */
  function wrapLine(text, fs, W) {
    if (width(text, fs) <= W) return [text];
    const words = text.split(' ');
    const greedy = limit => {
      const rows = [];
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (!cur || width(t, fs) <= limit) cur = t;
        else { rows.push(cur); cur = w; }
      }
      rows.push(cur);
      return rows;
    };
    const n = greedy(W).length;
    let lo = Math.max(...words.map(w => width(w, fs))), hi = W;
    for (let i = 0; i < 14; i++) {                 // самый узкий предел, при котором число рядов то же
      const mid = (lo + hi) / 2;
      if (greedy(mid).length <= n) hi = mid; else lo = mid;
    }
    return greedy(hi);
  }

  const CONT = 0.8;                                        // перенесённый ряд ближе к предыдущему
  const lineH = (rows, lh) => lh * (1 + (rows.length - 1) * CONT);

  /* Разбивка по страницам. Правила: страница заполняется до конца; строфу можно
     разорвать только между строками стиха и так, чтобы по обе стороны осталось не меньше двух. */
  function paginate(stanzas, lh, gap, cap) {
    const pages = [];
    let page = { rows: [], used: 0 };
    const flush = () => { if (page.rows.length) pages.push(page); page = { rows: [], used: 0 }; };

    stanzas.forEach((lines, si) => {
      let li = 0;
      while (li < lines.length) {
        const startsStanza = li === 0;
        const startGap = startsStanza && page.rows.length ? gap : 0;
        const avail = cap - page.used - startGap + 0.5;
        const total = lines.length - li;

        let m = 0, h = 0;                                   // сколько строк стиха ещё помещается
        while (m < total && h + lineH(lines[li + m], lh) <= avail) { h += lineH(lines[li + m], lh); m++; }

        let take = m;
        if (m < total) {
          take = Math.min(m, total - 2);                    // не оставлять «вдову»
          if (take < 2) take = page.rows.length ? 0 : Math.max(1, m);
        }
        if (take === 0) { flush(); continue; }

        for (let k = 0; k < take; k++) {
          lines[li + k].forEach((text, ri) => {
            page.rows.push({
              text,
              lineId: si * 10 + li + k,
              lineStart: ri === 0,
              cont: ri > 0,
              lineEnd: ri === lines[li + k].length - 1,
              gapBefore: startsStanza && k === 0 && ri === 0 && page.rows.length > 0
            });
          });
        }
        let placed = 0;
        for (let k = 0; k < take; k++) placed += lineH(lines[li + k], lh);
        page.used += startGap + placed;
        li += take;
        if (li < lines.length) flush();
      }
    });
    flush();
    return pages;
  }

  const Layout = window.Layout = {};

  /* Главная функция: принимает размеры страницы, возвращает страницы и метрики. */
  Layout.compute = function (pw, ph) {
    const frame = Math.max(11, pw * 0.042);
    const padX = frame + Math.max(14, pw * 0.04);
    const padY = frame + Math.max(24, ph * 0.05);
    const textW = pw - padX * 2;
    const textH = ph - padY * 2;

    const flat = window.POEM.flat();
    // шрифт подбираем так, чтобы в одну строку помещались все, кроме трёх самых длинных
    const ems = flat.map(l => width(l, 100) / 100).sort((a, b) => b - a);
    const fitEm = ems[Math.min(3, ems.length - 1)];
    const minFs = pw < 420 ? 19 : 19.5;
    const fs = U.clamp(textW / fitEm * 0.985, minFs, 34);

    const stanzas = window.POEM.map(st => st.map(line => wrapLine(line, fs, textW)));

    /* Межстрочный интервал подбираем так, чтобы страницы легли максимально полно
       при том же числе страниц — текст «дышит», а последняя страница не пустует. */
    const LH_MIN = 1.4, LH_MAX = 1.7, GAP = 0.6;
    const base = paginate(stanzas, fs * LH_MIN, fs * LH_MIN * GAP, textH).length;
    let lhF = LH_MIN;
    for (let f = LH_MIN; f <= LH_MAX + 1e-6; f += 0.02) {
      if (paginate(stanzas, fs * f, fs * f * GAP, textH).length === base) lhF = f; else break;
    }
    const lh = fs * lhF, gap = lh * GAP;
    const pages = paginate(stanzas, lh, gap, textH).map(p => ({ kind: 'text', rows: p.rows, used: p.used }));
    pages.push({ kind: 'flower' });

    return { pw, ph, frame, padX, padY, textW, textH, fs, lh, gap, pages };
  };
})();
