// Общий код страниц: ролики играют только в кадре, нажатие на ролик — сторис, вкладки ниш, кнопка внизу, первый экран.
// Разметка и ссылки в Телеграм готовы без этого кода: он только добавляет движение.
(function () {
  const S = window.S || {raboty: []}, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  // Метка письма радара (?ot=…) — дописывается в набранный текст, чтобы было видно, какое письмо сработало.
  // Держится до конца посещения (вкладка браузера): человек перешёл на услугу — метка осталась.
  const goden = s => !!s && /^[\w-]{1,40}$/.test(s);
  let ot = new URLSearchParams(location.search).get('ot');
  try { if (goden(ot)) sessionStorage.setItem('ot', ot); else ot = sessionStorage.getItem('ot') } catch (e) {}
  if (goden(ot)) {
    S.ot = ' (с сайта, метка ' + ot + ')';
    $$('a[href^="https://t.me/"]').forEach(a => { a.href += encodeURIComponent(S.ot) });
  }

  // Заставка работает без скрипта. Один анонс на телефоне, на широком экране — до трёх в «Потоке».
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const calm = () => motion.matches || !!connection?.saveData;
  const hero = $('.cut-hero');
  const toggles = $$('[data-motion]');
  const visible = new Map();
  const active = new Map();
  let userPaused = false;
  let heroInView = false;
  let pointed = null;
  const player = $('.player video');

  function stopPreview(tile, video) {
    active.delete(tile);
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }

  function startPreview(tile) {
    const video = document.createElement('video');
    Object.assign(video, {muted: true, defaultMuted: true, loop: true, playsInline: true, preload: 'none'});
    video.setAttribute('aria-hidden', 'true');
    video.addEventListener('playing', () => video.classList.add('playing'), {once:true});
    active.set(tile, video);
    tile.querySelector('picture, img').after(video);
    video.src = (innerWidth < 700 && tile.dataset.small) || tile.dataset.src;
    video.play().catch(() => {}); // Браузер может разрешать видео только по нажатию. Заставка остаётся на месте.
  }

  function updateControls() {
    for (const button of toggles) {
      button.hidden = calm();
      button.toggleAttribute('data-stopped', userPaused);
      button.textContent = userPaused ? 'Включить движение' : 'Остановить движение';
    }
  }

  function refresh() {
    const stopped = userPaused || calm() || document.hidden || document.body.classList.contains('paused') || (player && !player.paused);
    if (hero) hero.classList.toggle('rest', stopped || !heroInView);
    const wanted = new Set();
    if (!stopped && visible.size) {
      const candidates = [...visible.keys()].sort((a, b) => visible.get(b) - visible.get(a));
      const first = [document.activeElement, pointed].find(tile => visible.has(tile)) || candidates[0];
      wanted.add(first);
      if (innerWidth >= 700 && first.closest('.wall')) {
        const columns = new Set([first.closest('.col')]);
        for (const tile of candidates) {
          const col = tile.closest('.col');
          if (col && !columns.has(col)) { wanted.add(tile); columns.add(col); }
        }
      }
    }
    for (const [tile, video] of active) if (!wanted.has(tile)) stopPreview(tile, video);
    for (const tile of wanted) if (!active.has(tile)) startPreview(tile);
  }

  if (hero) {
    new IntersectionObserver(([entry]) => { heroInView = entry.isIntersecting; refresh(); }).observe(hero);
  }
  for (const button of toggles) {
    button.addEventListener('click', () => { userPaused = !userPaused; updateControls(); refresh(); });
  }
  const observeTiles = () => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= .2) visible.set(entry.target, entry.intersectionRect.width * entry.intersectionRect.height);
        else visible.delete(entry.target);
      }
      refresh();
    }, {threshold:[0, .2, .5, .8, 1]});
    $$('.tile[data-src]').forEach(tile => observer.observe(tile));
  };
  document.addEventListener('visibilitychange', refresh);
  const preferenceChanged = () => { updateControls(); refresh(); };
  motion.addEventListener('change', preferenceChanged);
  connection?.addEventListener('change', preferenceChanged);
  document.addEventListener('focusin', refresh);
  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const tile = event.target.closest('.tile[data-src]');
    if (tile !== pointed) { pointed = tile; refresh(); }
  });
  player?.addEventListener('play', refresh);
  player?.addEventListener('pause', refresh);
  updateControls();
  refresh();
  const afterLoad = () => setTimeout(observeTiles, 250);
  if (document.readyState === 'complete') afterLoad(); else addEventListener('load', afterLoad, {once:true});

  if (!calm()) {
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        if (!calm() && !userPaused) entry.target.classList.add('section-arrived');
        reveal.unobserve(entry.target);
      }
    });
    $$('.headline, .trial-title').forEach(el => reveal.observe(el));
  }

  // Нажатие на ролик — сторис по роликам того же блока. Без скриптов это обычная ссылка на страницу работы.
  document.addEventListener('click', e => {
    const kt = e.target.closest('.tile.kart'), K = S.kartinki;
    if (kt && K && window.openStory && !e.metaKey && !e.ctrlKey && !e.shiftKey && !/\/kartinki\//.test(kt.getAttribute('href'))) {
      e.preventDefault();
      return openStory(K.spisok.map(x => ({id: x.i, img: x.src, label: x.p, tekst: K.tekst})), 0, kt);
    }
    const t = e.target.closest('.tile.v'); if (!t || e.metaKey || e.ctrlKey || e.shiftKey || !window.openStory) return;
    const box = t.closest('[data-storis]'); if (!box) return;
    // плитка вида роликов несёт свой список (data-ids): в просмотре — только ролики этого вида
    const ids = t.dataset.ids ? t.dataset.ids.split(',') : [...new Set($$('.tile.v', box).filter(x => !x.closest('[hidden]')).map(x => x.dataset.id))];
    const k = ids.indexOf(t.dataset.id); if (k < 0) return;
    e.preventDefault();
    const list = ids.map(id => {
      const item = S.raboty.find(r => r.i === id);
      return {id, label: item?.f || '', title: item?.n || ''};
    });
    openStory(list, k, t);
  });
  document.addEventListener('storyopen', () => { document.body.classList.add('paused'); refresh(); });
  document.addEventListener('storyclose', () => { document.body.classList.remove('paused'); refresh(); });

  // Вкладки ниш.
  const tabs = $('#tabs'), works = $('#works');
  if (tabs && works) tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', tabs).forEach(x => x.setAttribute('aria-pressed', x === b));
    [...works.children].forEach(w => { w.hidden = !(b.dataset.n === 'all' || w.dataset.n === b.dataset.n) });
  });

  // Карточки услуг: точки показывают, какая сейчас.
  const cards = $('#cards'), dots = $$('#dots i');
  if (cards && dots.length) cards.addEventListener('scroll', () => {
    const c = cards.children[0], i = Math.round(cards.scrollLeft / (c.offsetWidth + 12));
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  }, {passive: true});

  // Кнопка внизу: появляется после первого экрана, прячется на финале.
  const dock = $('#dock'), top = $('[data-dock-top]') || $('.hero, .uhero'), fin = $('#final');
  if (dock && top) {
    const seen = {top: true, fin: false};
    const dio = new IntersectionObserver(es => { es.forEach(e => { seen[e.target === top ? 'top' : 'fin'] = e.isIntersecting });
      dock.classList.toggle('on', !seen.top && !seen.fin) }, {threshold: 0.12});
    dio.observe(top); if (fin) dio.observe(fin);
  }

  // Первый экран статичен по тексту: нет сдвига шрифта, счётчика с нуля и скрытых слов.
  // Движение сохраняется в трёх колоннах; режим уменьшенного движения уважён выше.
})();
