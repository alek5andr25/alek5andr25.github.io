// Просмотр из любой подборки. Кадр, управление и переход в Телеграм занимают отдельные строки.
(function () {
  const S = window.S, pictureDuration = 5000;
  let root, panel, stage, video, picture, bars, title, caption, soundButton, pauseButton, closeButton, link;
  let items = [], index = 0, sound = false, paused = false, pictureTime = 0, lastTick = 0, raf = 0;
  let opener, background = [], pushed = false, closing = false, touch, lastSwipe = 0;

  function element(tag, cls, parent) {
    const node = document.createElement(tag);
    node.className = cls;
    parent.appendChild(node);
    return node;
  }
  const icons = {
    close: 'M6 6l12 12M18 6L6 18', prev: 'M14 5l-7 7 7 7', next: 'M10 5l7 7-7 7',
    pause: 'M8 5v14M16 5v14', play: 'M7 4l12 8-12 8z',
    mute: 'M3 9h4l5-4v14l-5-4H3z M16 9l6 6m0-6l-6 6',
    volume: 'M3 9h4l5-4v14l-5-4H3z M16 8a6 6 0 010 8m3-11a10 10 0 010 14'
  };
  function describe(button, icon, text) {
    button.setAttribute('aria-label', text);
    button.title = text;
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + icons[icon] + '"/></svg>';
  }
  function control(parent, cls, icon, text, action) {
    const button = element('button', 'st-control ' + cls, parent);
    button.type = 'button';
    describe(button, icon, text);
    button.onclick = action;
    return button;
  }
  function updateSound() {
    video.muted = !sound;
    describe(soundButton, sound ? 'volume' : 'mute', sound ? 'Выключить звук' : 'Включить звук');
  }
  function setPaused(value) {
    paused = value;
    lastTick = performance.now();
    describe(pauseButton, paused ? 'play' : 'pause', paused ? 'Продолжить просмотр' : 'Приостановить просмотр');
    if (paused) video.pause();
    else if (!items[index].img) {
      video.play().catch(err => {
        if (err.name !== 'AbortError' && !root.hidden && !items[index].img && video.paused) setPaused(true);
      });
    }
  }
  function build() {
    root = element('div', 'st', document.body);
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Просмотр работ');
    panel = element('div', 'st-panel', root);
    const header = element('div', 'st-top', panel), row = element('div', 'st-row', header);
    const heading = element('div', 'st-heading', row);
    heading.setAttribute('aria-live', 'polite');
    caption = element('small', '', heading);
    title = element('strong', '', heading);
    soundButton = control(row, 'st-snd', 'mute', 'Включить звук', () => { sound = !sound; updateSound() });
    closeButton = control(row, 'st-x', 'close', 'Закрыть', close);
    bars = element('div', 'st-bars', header);
    bars.setAttribute('aria-hidden', 'true');
    stage = element('div', 'st-stage', panel);
    video = element('video', '', stage);
    Object.assign(video, {muted: true, playsInline: true, preload: 'none'});
    video.addEventListener('ended', () => { if (!root.hidden) show(index + 1) });
    video.addEventListener('loadedmetadata', () => {
      if (video.videoHeight) panel.style.setProperty('--ratio', video.videoWidth / video.videoHeight);
    });
    video.addEventListener('error', () => {
      if (!root.hidden && !video.hidden && video.hasAttribute('src')) {
        caption.textContent = 'Не удалось загрузить ролик';
        setPaused(true);
      }
    });
    picture = element('img', 'st-pic', stage);
    picture.alt = ''; picture.hidden = true;
    picture.onload = () => {
      if (!picture.hidden && picture.naturalHeight) panel.style.setProperty('--ratio', picture.naturalWidth / picture.naturalHeight);
    };
    const footer = element('div', 'st-foot', panel);
    control(footer, 'st-prev', 'prev', 'Предыдущая работа', () => show(index - 1));
    pauseButton = control(footer, 'st-pause', 'pause', 'Приостановить просмотр', () => setPaused(!paused));
    control(footer, 'st-next', 'next', 'Следующая работа', () => show(index + 1));
    link = element('a', 'st-cta', footer);
    link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Написать в Телеграм';
    link.addEventListener('click', () => setPaused(true));
    root.onclick = e => { if (e.target === root) close() };
    stage.onclick = e => {
      if (Date.now() - lastSwipe < 450) return;
      const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      if (x < .32) show(index - 1);
      else if (x > .68) show(index + 1);
      else setPaused(!paused);
    };
    stage.addEventListener('touchstart', e => { touch = e.touches.length === 1 ? e.touches[0] : null }, {passive:true});
    stage.addEventListener('touchcancel', () => { touch = null });
    stage.addEventListener('touchend', e => {
      if (!touch) return;
      const dx = e.changedTouches[0].clientX - touch.clientX, dy = e.changedTouches[0].clientY - touch.clientY;
      touch = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { lastSwipe = Date.now(); show(index + (dx < 0 ? 1 : -1)) }
      else if (dy > 90 && dy > Math.abs(dx)) { lastSwipe = Date.now(); close() }
    });
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close() }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(index + (e.key === 'ArrowRight' ? 1 : -1)) }
      if (e.key === 'Tab') {
        const controls = [...panel.querySelectorAll('button,a')].filter(n => !n.hidden);
        if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1).focus() }
        else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus() }
      }
    });
    addEventListener('popstate', () => { if (!root.hidden) hide() });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !root.hidden) setPaused(true) });
  }
  function show(n) {
    if (closing) return;
    if (n >= items.length) return close();
    index = Math.max(0, n);
    const item = items[index];
    title.textContent = item.title || item.label;
    caption.textContent = (index + 1) + ' / ' + items.length + (item.title ? ' · ' + item.label : '');
    const message = item.tekst || S.t.tak.replace(/\{(rabota|format)\}/g, (_, field) =>
      field === 'rabota' ? (item.title || item.label) : item.label);
    link.href = 'https://t.me/' + S.tg + '?text=' + encodeURIComponent(message + (S.ot || ''));
    [...bars.children].forEach((bar, k) => { bar.firstChild.style.transform = k < index ? 'scaleX(1)' : 'scaleX(0)' });
    video.pause();
    video.hidden = soundButton.hidden = !!item.img;
    picture.hidden = !item.img;
    if (item.img) {
      pictureTime = 0; picture.src = item.img; picture.alt = item.label;
    } else {
      const media = (S.media || {})[item.id] || [S.m + item.id + '.mp4', S.m + item.id + '.jpg'];
      video.poster = media[1]; video.src = media[0]; updateSound();
    }
    setPaused(false);
  }
  function tick(time) {
    if (root.hidden || closing) return;
    let progress = 0;
    if (items[index].img) {
      if (!paused && picture.complete && picture.naturalWidth) pictureTime += Math.max(0, time - lastTick);
      progress = pictureTime / pictureDuration;
    } else if (video.duration) progress = video.currentTime / video.duration;
    lastTick = time;
    bars.children[index].firstChild.style.transform = 'scaleX(' + Math.min(1, progress) + ')';
    if (items[index].img && progress >= 1) show(index + 1);
    raf = requestAnimationFrame(tick);
  }
  function hide() {
    root.hidden = true; root.classList.remove('open'); document.documentElement.classList.remove('story-lock', 'story-gutter');
    cancelAnimationFrame(raf);
    video.pause(); video.removeAttribute('src'); video.load(); picture.removeAttribute('src');
    background.forEach(node => { node.inert = false }); background = [];
    if (opener && opener.isConnected) opener.focus({preventScroll:true});
    opener = null; pushed = closing = false;
    document.dispatchEvent(new Event('storyclose'));
  }
  function close() {
    if (root.hidden || closing) return;
    closing = true; video.pause();
    if (pushed) history.back(); else hide();
  }
  window.openStory = function (list, start, trigger) {
    if (!list.length) return;
    if (!root) build();
    if (!root.hidden) return;
    items = list; sound = false; bars.replaceChildren(); touch = null;
    items.forEach(() => element('i', '', element('div', '', bars)));
    panel.style.removeProperty('--ratio');
    opener = trigger || document.activeElement;
    background = [...document.body.children].filter(x => x !== root && !x.inert && !/^(SCRIPT|STYLE|LINK)$/.test(x.tagName));
    background.forEach(x => { x.inert = true });
    document.documentElement.classList.toggle('story-gutter', innerWidth > document.documentElement.clientWidth);
    root.hidden = false; root.classList.add('open'); document.documentElement.classList.add('story-lock');
    closeButton.focus({preventScroll:true});
    try { history.pushState({story:1}, ''); pushed = true } catch { pushed = false }
    document.dispatchEvent(new Event('storyopen'));
    show(start || 0); raf = requestAnimationFrame(tick);
  };
})();
