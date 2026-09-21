/* Фоновая музыка.
   Браузеры не разрешают звук без жеста пользователя, поэтому музыка включается кликом по открытке.
   Она плавно нарастает, мягко «дышит» на стыке повторов, затихает при закрытии книги,
   а маленькая кнопка в углу позволяет её выключить (выбор запоминается). */
(function () {
  const U = window.U;
  const M = window.Music = { muted: false, failed: false };

  const SRC = 'audio/music.mp3';
  const LEVEL = 0.7;           // общая громкость, 0..1 (запись нормализована до −29 LUFS)
  const FADE_IN = 4200;        // мс — нарастание при открытии
  const FADE_OUT = 1800;       // мс — затихание при закрытии
  const EDGE = 2.6;            // с — «вдох» в начале и «выдох» в конце каждого повтора
  const KEY = 'card-music-muted';

  let a = null;                // <audio>
  let btn = null;
  let raf = 0, last = 0;
  let gain = 0, target = 0, rate = 0;   // множитель громкости: текущий, целевой, скорость (1/мс)
  let wanted = false;          // книга открыта — музыка нужна
  let playing = false;
  let volumeWorks = true;      // на iOS громкость программно не меняется

  const load = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const save = v => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* не критично */ } };

  function create() {
    if (a) return a;
    a = new Audio();
    a.preload = 'auto';
    a.src = SRC;
    a.volume = 0.5;
    volumeWorks = Math.abs(a.volume - 0.5) < 0.01;
    a.volume = 0;
    a.loop = !volumeWorks;                       // без управления громкостью — обычный повтор
    a.addEventListener('ended', () => { if (wanted && !M.muted) { a.currentTime = 0; play(); } });
    a.addEventListener('error', () => { M.failed = true; wanted = false; showButton(false); });
    return a;
  }

  function play() {
    const p = a.play();
    if (p && p.catch) p.catch(() => { /* звук без жеста не разрешён — включится при следующем нажатии */ });
  }

  /* Итоговая громкость: общий множитель × мягкие края повтора, в квадрате — на слух плавнее */
  function apply() {
    if (!a || !volumeWorks) return;
    let edge = 1;
    if (isFinite(a.duration) && a.duration > EDGE * 4) {
      edge = Math.min(1, a.currentTime / EDGE, (a.duration - a.currentTime) / EDGE);
    }
    const g = U.clamp(gain * Math.max(0, edge), 0, 1);
    a.volume = U.clamp(LEVEL * g * g, 0, 1);
  }

  function tick(now) {
    const dt = last ? U.clamp(now - last, 0, 100) : 16;
    last = now;
    if (gain !== target) {
      const step = rate * dt;
      gain = Math.abs(target - gain) <= step ? target : gain + Math.sign(target - gain) * step;
    }
    apply();
    if (gain <= 0 && target === 0) {
      a.pause();
      playing = false;
      if (!wanted) { try { a.currentTime = 0; } catch (e) { /* не критично */ } }
      raf = 0; last = 0;
      return;
    }
    if (!volumeWorks && gain === target) { raf = 0; last = 0; return; }   // играем без покадровой работы
    raf = requestAnimationFrame(tick);
  }

  function fadeTo(v, ms) {
    target = v;
    if (!volumeWorks) gain = v;                   // громкость не меняется (iOS) — без плавности
    else rate = Math.abs(v - gain) / Math.max(1, ms);
    if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
  }

  /* ───────── кнопка ───────── */
  function buildButton() {
    if (btn) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'sound';
    btn.className = 'sound';
    btn.setAttribute('aria-label', 'Музика');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path class="sp" d="M4 9.6h3.6L12 6v12l-4.4-3.6H4z"/>' +
      '<path class="w1" d="M15.2 9.3a4 4 0 0 1 0 5.4"/>' +
      '<path class="w2" d="M17.7 7a7.2 7.2 0 0 1 0 10"/>' +
      '<path class="x" d="M4.5 4.5l15 15"/></svg>';
    btn.addEventListener('pointerdown', e => e.stopPropagation());     // с кнопки не начинается листание
    btn.addEventListener('click', e => { e.stopPropagation(); M.toggle(); btn.blur(); });
    document.getElementById('viewport').appendChild(btn);
    paintButton();
  }

  function paintButton() {
    if (!btn) return;
    btn.classList.toggle('muted', M.muted);
    btn.setAttribute('aria-pressed', String(!M.muted));
    btn.setAttribute('aria-label', M.muted ? 'Увімкнути музику' : 'Вимкнути музику');
  }

  function showButton(on) { if (btn) btn.classList.toggle('on', on && !M.failed); }

  /* ───────── публичное ───────── */
  M.init = function () {
    M.muted = load();
    buildButton();
    setTimeout(create, 1200);                    // заранее подгружаем запись, чтобы к клику она была готова
  };

  M.start = function () {                        // вызывать прямо из клика по открытке
    if (M.failed) return;
    create();
    wanted = true;
    showButton(true);
    if (M.muted) return;
    play();
    playing = true;
    fadeTo(1, FADE_IN);
  };

  M.stop = function () {
    wanted = false;
    showButton(false);
    if (a && playing) fadeTo(0, FADE_OUT);
  };

  M.element = () => a;                           // для проверок и отладки

  M.toggle = function () {
    M.muted = !M.muted;
    save(M.muted);
    paintButton();
    if (!wanted) return;
    if (M.muted) fadeTo(0, 700);
    else { create(); play(); playing = true; fadeTo(1, 1500); }
  };

  document.addEventListener('visibilitychange', () => {
    if (!a || !playing) return;
    if (document.hidden) a.pause();
    else if (wanted && !M.muted) { play(); if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
  });
})();
