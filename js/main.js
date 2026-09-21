/* Точка входа: измерения, сборка страниц, перестроение при изменении размера окна. */
(function () {
  const B = window.Book;
  let ready = false;
  let pendingRelayout = false;

  const hasSize = () => window.innerWidth > 0 && window.innerHeight > 0;

  async function loadFonts() {
    try { await document.fonts.load('26px "Marck Script"', 'Оксано Анатоліївно «Фармасел» Здоров’я!:,.і ї є'); }
    catch (e) { /* шрифт не критичен: сработает запасной */ }
    document.documentElement.classList.add('fonts-ready');      // надпись на обложке появляется, когда шрифт готов
  }

  function buildPages() {
    const L = window.Layout.compute(B.geo.pw, B.geo.ph);
    B.buildPages(L);
    B.bindCorners();
    return L;
  }

  /* Пересборка при resize / смене ориентации */
  let lastW = 0, lastH = 0;
  const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;

  async function relayout() {
    if (!hasSize()) return;
    if (!ready) return begin();
    if (B.state === 'opening' || B.state === 'closing') { pendingRelayout = true; return; }
    // на телефонах адресная строка меняет высоту на ~50–80px — это не повод перестраивать страницы
    if (B.state === 'reading' && coarse() && Math.abs(innerWidth - lastW) < 2 && Math.abs(innerHeight - lastH) < 120) return;
    lastW = innerWidth; lastH = innerHeight;

    B.measure();
    if (B.state === 'closed') {
      B.setClosed();
      B.placeHint();
      buildPages();
      return;
    }

    // читатель уже внутри: сохраняем место, где он остановился
    const cur = B.leaves[B.current];
    const anchor = cur.kind === 'text' ? cur.rows[0].lineId : Infinity;
    B.stopWriting();
    B.cancelDrag();
    B.busy = false;
    const L = buildPages();

    const pageIdx = L.pages.findIndex(p => p.kind === 'flower' || p.rows[p.rows.length - 1].lineId >= anchor);
    const now = pageIdx + 1;
    for (let i = 1; i < now; i++) {
      const lf = B.leaves[i];
      lf.rows.forEach(r => { r.el.querySelector('.ink').classList.add('done'); B.written.add(r.lineId); });
      lf.done = true;
    }
    for (let i = 0; i < now; i++) B.setLeaf(i, 1);
    B.current = now;
    Object.assign(B.cam, B.readingCam());
    B.render();
    B.refreshOrder();
    B.onPageShown(now, 150);
  }

  /* Книга закрыта после чтения: всё с чистого листа — при новом открытии стих пишется заново */
  B.resetBook = function () {
    pendingRelayout = false;
    B.written = new Set();
    if (window.Flower) window.Flower.played = false;
    B.current = 1;
    B.measure();
    B.setClosed();
    B.placeHint();
    buildPages();
    B.hintEl.classList.remove('off');
    B.hintEl.classList.add('on');
    B.startIdle();
  };

  async function begin() {
    ready = true;
    lastW = innerWidth; lastH = innerHeight;
    B.measure();
    B.setClosed();
    B.placeHint();
    await loadFonts();
    buildPages();
    B.hintEl.classList.add('on');
    B.startIdle();
  }

  // после открытия применяем отложенную пересборку
  const origOpen = B.open;
  B.open = async function () {
    await origOpen.apply(B, arguments);
    if (pendingRelayout) { pendingRelayout = false; relayout(); }
  };

  let timer = 0;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(relayout, 140); });
  window.addEventListener('orientationchange', () => { clearTimeout(timer); timer = setTimeout(relayout, 320); });

  B.bind();
  B.bindInput();
  relayout();
  // если страницу загрузили в скрытой вкладке (размер окна 0) — ждём, пока появится размер
  const poll = setInterval(() => { if (ready) clearInterval(poll); else relayout(); }, 250);
})();
