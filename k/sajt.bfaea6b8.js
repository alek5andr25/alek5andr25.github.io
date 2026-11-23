// Общий код страниц: ролики играют только в кадре, нажатие на ролик — сторис, вкладки ниш, кнопка внизу, первый экран.
// Разметка и ссылки в Телеграм готовы без этого кода: он только добавляет движение.
(function () {
  const S = window.S || {raboty: []}, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const LITE = !!(navigator.connection && navigator.connection.saveData);      // экономия трафика — только кадры-заставки
  const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Метка письма радара (?ot=…) — дописывается в набранный текст, чтобы было видно, какое письмо сработало.
  // Держится до конца посещения (вкладка браузера): человек перешёл на услугу — метка осталась.
  const goden = s => !!s && /^[\w-]{1,40}$/.test(s);
  let ot = new URLSearchParams(location.search).get('ot');
  try { if (goden(ot)) sessionStorage.setItem('ot', ot); else ot = sessionStorage.getItem('ot') } catch (e) {}
  if (goden(ot)) {
    S.ot = ' (с сайта, метка ' + ot + ')';
    $$('a[href^="https://t.me/"]').forEach(a => { a.href += encodeURIComponent(S.ot) });
  }

  // Автоматический просмотр только в «Потоке». В списках и услугах — заставка,
  // полный ролик запускается нажатием. Четыре декодера на телефоне задерживали интерфейс.
  // Все три колонны движутся сразу. На телефоне играет один видимый ролик,
  // на широком экране — не больше одного в каждой колонне. Остальные показывают заставки.
  const hero = $('.hero'), candidates = new Map();
  const play = es => {
    es.forEach(e => { if (e.isIntersecting && e.intersectionRatio >= .2) candidates.set(e.target, e.intersectionRatio); else candidates.delete(e.target) });
    const allowed = new Set(), columns = new Set(), limit = innerWidth < 700 ? 1 : 3;
    if (!LITE && !CALM && !document.body.classList.contains('paused')) {
      [...candidates].sort((a, b) => b[1] - a[1]).forEach(([tile]) => {
        const col = tile.closest('.col');
        if (allowed.size < limit && !columns.has(col)) { allowed.add(tile.querySelector('video')); columns.add(col) }
      });
    }
    $$('.wall video').forEach(v => { if (allowed.has(v)) { if (!v.getAttribute('src')) v.src = v.dataset.src; v.preload = 'auto'; if (v.paused) v.play().catch(() => {}) } else v.pause() });
  };
  const ioHero = hero && new IntersectionObserver(play, {root: hero,
    rootMargin: `-${Math.round(hero.clientHeight * .12)}px 0px -${Math.round(hero.clientHeight * .62)}px 0px`, threshold: [0, .2, .5, .8, 1]});
  const watch = () => { if (ioHero) { candidates.clear(); $$('.wall .tile.v').forEach(t => { ioHero.unobserve(t); ioHero.observe(t) }) } };
  // Ролики начинают грузиться после того, как страница показана: текст, кнопки и заставки — первыми.
  const pusk = () => setTimeout(watch, 250);
  if (document.readyState === 'complete') pusk(); else addEventListener('load', pusk, {once: true});

  // Нажатие на ролик — сторис по роликам того же блока. Без скриптов это обычная ссылка на страницу работы.
  const fmt = id => (S.raboty.find(r => r.i === id) || {}).f || '';
  document.addEventListener('click', e => {
    const kt = e.target.closest('.tile.kart'), K = S.kartinki;
    if (kt && K && window.openStory && !e.metaKey && !e.ctrlKey && !e.shiftKey && !/\/kartinki\//.test(kt.getAttribute('href'))) {
      e.preventDefault();
      return openStory(K.spisok.map(x => ({id: x.i, img: x.src, label: x.p, tekst: K.tekst})), 0);
    }
    const t = e.target.closest('.tile.v'); if (!t || e.metaKey || e.ctrlKey || e.shiftKey || !window.openStory) return;
    const box = t.closest('[data-storis]'); if (!box) return;
    // плитка вида роликов несёт свой список (data-ids): в просмотре — только ролики этого вида
    const ids = t.dataset.ids ? t.dataset.ids.split(',') : [...new Set($$('.tile.v', box).filter(x => !x.closest('[hidden]')).map(x => x.dataset.id))];
    const k = ids.indexOf(t.dataset.id); if (k < 0) return;
    e.preventDefault();
    openStory(ids.map(id => ({id, label: fmt(id) || (x => x ? x.textContent : '')($('.tile.v[data-id="' + id + '"] .cap i'))})), k);
  });
  document.addEventListener('storyopen', () => { document.body.classList.add('paused'); $$('.tile video, .media video').forEach(v => v.pause()) });
  document.addEventListener('storyclose', () => { document.body.classList.remove('paused'); watch() });

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
