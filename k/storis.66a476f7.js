// Просмотр работ (основа — z30) «как сторис» — на весь экран, полоски сверху, тап слева/справа или свайп — соседний ролик,
// смахнуть вниз, «×» или «Назад» на телефоне — закрыть. Звук включается кнопкой и остаётся включённым до конца просмотра.
// Полоска идёт по длине самого ролика, по концу — следующий.
// openStory(items, start), items: [{id, label}] — ролик /r/<id>.mp4, кадр-заставка /r/<id>.jpg;
// {id, img, label, tekst} — картинка: 5 секунд, без звука; tekst — свой набранный текст для кнопки.
(function () {
  const S = window.S, M = S.m, TG = t => 'https://t.me/' + S.tg + '?text=' + encodeURIComponent(t);
  const css = `
.st{position:fixed;inset:0;z-index:50;background:#03060A;color:#FEFBF5;font-family:var(--body);
  opacity:0;transform:scale(.96);transition:opacity .28s ease,transform .38s cubic-bezier(.22,1,.36,1);touch-action:none}
.st.open{opacity:1;transform:none}
.st video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.st .st-pic{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.st video.in-l,.st .st-pic.in-l{animation:st-in-l .3s cubic-bezier(.22,1,.36,1)}
.st video.in-r,.st .st-pic.in-r{animation:st-in-r .3s cubic-bezier(.22,1,.36,1)}
@keyframes st-in-l{from{transform:translateX(-14%);opacity:.3}}
@keyframes st-in-r{from{transform:translateX(14%);opacity:.3}}
.st-shade{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(0,0,0,.6) 0,rgba(0,0,0,0) 18%,rgba(0,0,0,0) 70%,rgba(0,0,0,.75) 100%)}
.st-top{position:absolute;top:0;left:0;right:0;padding:max(10px,env(safe-area-inset-top)) 12px 0;z-index:2}
.st-bars{display:flex;gap:3px}
.st-bars div{flex:1;height:2px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden}
.st-bars i{display:block;height:100%;background:#FEFBF5;transform-origin:left;transform:scaleX(0)}
.st-row{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;font-weight:600}
.st-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-snd{flex:none;display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 10px;border:0;border-radius:20px;
  background:rgba(255,255,255,.16);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#FEFBF5;font:600 13px/1 inherit;cursor:pointer}
.st-snd.on{padding:0 9px}
.st-snd svg{width:18px;height:18px}
.st-x{flex:none;width:40px;height:40px;margin-right:-8px;border:0;background:none;color:#FEFBF5;display:grid;place-items:center;cursor:pointer}
.st-x svg{width:22px;height:22px}
.st-tap{position:absolute;top:96px;bottom:110px;width:42%}
.st-tap.l{left:0}.st-tap.r{right:0}
.st-cta{position:absolute;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));height:52px;border-radius:4px;
  display:flex;align-items:center;justify-content:center;background:#FEFBF5;color:#080F16;font-weight:600;font-size:15px;text-decoration:none}
@media (prefers-reduced-motion:reduce){.st{transition:none}.st video.in-l,.st video.in-r,.st .st-pic.in-l,.st .st-pic.in-r{animation:none}}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const NS = 'http://www.w3.org/2000/svg';
  function svg(ds, fill) {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    ds.forEach(d => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d);
      if (fill && d === ds[0]) p.setAttribute('fill', 'currentColor'); else { p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round') }
      s.appendChild(p) });
    return s;
  }
  const SPK = 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z';
  const I_OFF = () => svg([SPK, 'M16 9.5l5 5M21 9.5l-5 5'], true);
  const I_ON = () => svg([SPK, 'M15.5 9a4 4 0 0 1 0 6', 'M18.5 6.5a8 8 0 0 1 0 11'], true);

  let opener = null, zakryto = [];
  let root, vid, bars, label, snd, cta, items = [], cur = 0, sound = false, raf = 0, failT = 0, pushed = false, x0 = null, y0 = 0, swipedAt = 0;
  let pic, t0 = 0; const DUR = 5000;   // картинка держится 5 секунд
  function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function setSnd() {
    snd.textContent = ''; snd.classList.toggle('on', sound); snd.setAttribute('aria-pressed', sound);
    snd.setAttribute('aria-label', sound ? 'Выключить звук' : 'Включить звук');
    if (sound) snd.appendChild(I_ON()); else { snd.appendChild(I_OFF()); snd.append('Звук') }
  }
  function play() {
    vid.muted = !sound;
    vid.play().catch(() => { if (!vid.muted) { sound = false; setSnd(); vid.muted = true; vid.play().catch(() => {}) } });
  }
  function build() {
    root = el('div', 'st', document.body); root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Просмотр работ');
    vid = el('video', '', root); Object.assign(vid, {muted: true, playsInline: true, preload: 'auto'});
    vid.setAttribute('playsinline', ''); vid.setAttribute('muted', '');
    vid.addEventListener('ended', () => show(cur + 1));
    vid.addEventListener('error', () => { clearTimeout(failT); failT = setTimeout(() => show(cur + 1), 4000) });
    vid.addEventListener('animationend', () => vid.className = '');
    pic = el('img', 'st-pic', root); pic.alt = ''; pic.hidden = true;
    pic.addEventListener('animationend', () => pic.className = 'st-pic');
    el('div', 'st-shade', root);
    const l = el('div', 'st-tap l', root), r = el('div', 'st-tap r', root);
    l.onclick = () => { if (Date.now() - swipedAt > 400) show(cur - 1, -1) };
    r.onclick = () => { if (Date.now() - swipedAt > 400) show(cur + 1, 1) };
    const top = el('div', 'st-top', root); bars = el('div', 'st-bars', top);
    const row = el('div', 'st-row', top); label = el('span', '', row);
    snd = el('button', 'st-snd', row); snd.type = 'button'; setSnd();
    snd.onclick = () => { sound = !sound; setSnd(); play() };
    const x = el('button', 'st-x', row); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.appendChild(svg(['M6 6l12 12M18 6L6 18']));
    x.onclick = close;
    cta = el('a', 'st-cta', root); cta.target = '_blank'; cta.rel = 'noopener'; cta.textContent = 'Хочу так же · написать в Телеграм';
    cta.addEventListener('click', () => { vid.pause() });
    // свайп влево/вправо — соседний ролик, вниз — закрыть
    root.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY }, {passive: true});
    root.addEventListener('touchend', e => { if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { swipedAt = Date.now(); show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1) }
      else if (dy > 90 && dy > Math.abs(dx)) { swipedAt = Date.now(); close() } });
    document.addEventListener('keydown', e => { if (root.hidden) return;
      if (e.key === 'Tab') {             // Tab ходит по кругу внутри окна: звук → закрыть → написать
        const f = [snd, root.querySelector('.st-x'), cta], i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i < 0 ? 0 : i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); return;
      }
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(cur + 1, 1); else if (e.key === 'ArrowLeft') show(cur - 1, -1) });
    addEventListener('popstate', () => { if (!root.hidden) { pushed = false; hide() } });
  }
  // полоска текущего ролика — по его времени
  function tick() {
    const b = bars.children[cur], it = items[cur];
    if (b && it && it.img) {
      const p = Math.min(1, Math.max(0, (performance.now() - t0) / DUR)); b.firstChild.style.transform = `scaleX(${p})`;
      if (p >= 1) { t0 = Infinity; show(cur + 1, 1) }    // Infinity — чтобы конец картинки сработал один раз
    } else if (b && vid.duration) b.firstChild.style.transform = `scaleX(${Math.min(1, vid.currentTime / vid.duration)})`;
    raf = requestAnimationFrame(tick);
  }
  function show(n, dir) {
    if (n >= items.length) return close();
    if (n < 0) n = 0;
    clearTimeout(failT);
    const back = n === cur && dir === -1;           // «назад» на первом — просто с начала
    cur = n; const it = items[cur];
    [...bars.children].forEach((b, i) => { b.firstChild.style.transform = i < cur ? 'scaleX(1)' : 'scaleX(0)' });
    label.textContent = it.label;
    cta.href = TG((it.tekst || S.t.tak.replace('{format}', it.label)) + (S.ot || ''));
    if (it.img) {                                   // картинка: ролик молчит, звук не нужен
      vid.pause(); vid.hidden = true; snd.hidden = true; pic.hidden = false; t0 = performance.now();
      if (!back) { pic.src = it.img; pic.alt = it.label; pic.className = 'st-pic'; if (dir) { void pic.offsetWidth; pic.className = 'st-pic ' + (dir > 0 ? 'in-r' : 'in-l') } }
      return;
    }
    pic.hidden = true; vid.hidden = false; snd.hidden = false;
    if (back) { vid.currentTime = 0; return play() }
    const md = (S.media || {})[it.id] || [M + it.id + '.mp4', M + it.id + '.jpg'];
    vid.poster = md[1]; vid.src = md[0];
    vid.className = ''; if (dir) { void vid.offsetWidth; vid.className = dir > 0 ? 'in-r' : 'in-l' }
    play();
  }
  function hide() {
    cancelAnimationFrame(raf); clearTimeout(failT); root.classList.remove('open'); vid.pause();
    zakryto.forEach(x => { x.inert = false }); zakryto = [];
    if (opener && opener.focus) opener.focus({preventScroll: true}); opener = null;
    setTimeout(() => { root.hidden = true; vid.removeAttribute('src'); vid.load(); pic.removeAttribute('src'); document.dispatchEvent(new Event('storyclose')) }, 300);
  }
  function close() { if (root.hidden) return; if (pushed) { pushed = false; history.back() } else hide() }
  window.openStory = function (list, start) {
    if (!root) build();
    items = list; cur = -1; bars.textContent = '';
    items.forEach(() => { const b = el('div', '', bars); el('i', '', b) });
    root.hidden = false; void root.offsetWidth; root.classList.add('open');
    // фокус клавиатуры — внутри окна; страница под ним недоступна, пока окно открыто
    opener = document.activeElement;
    zakryto = [...document.body.children].filter(x => x !== root && !x.inert && !/^(SCRIPT|STYLE|LINK)$/.test(x.tagName));
    zakryto.forEach(x => { x.inert = true });
    root.querySelector('.st-x').focus({preventScroll: true});
    try { history.pushState({story: 1}, ''); pushed = true } catch (e) { pushed = false }
    document.dispatchEvent(new Event('storyopen'));
    show(start || 0);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  };
})();
