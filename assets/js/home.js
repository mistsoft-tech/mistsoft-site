// mistsoft.kr home: hero parallax, OverCloud live key art (intro → loop), YouTube click-to-play.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* hero parallax (pointer + scroll) */
  const hero = $('.hero'), art = $('.hero__art'), logo = $('.hero__logo'), frame = $('.hero__frame');
  const setScanH = () => frame && art.style.setProperty('--h', (frame.clientHeight - 20) + 'px');
  setScanH(); window.addEventListener('resize', setScanH);
  if (!reduced) {
    let px = 0, py = 0, sy = 0, raf = 0;
    const apply = () => {
      raf = 0;
      // individual translate/rotate properties so they compose with the entrance animations' transform
      art.style.translate = `${px * -18}px ${py * -14 - sy * .12}px`;
      art.style.rotate = `y ${px * 4}deg`;
      logo.style.translate = `${px * 10}px ${py * 8 + sy * .18}px`;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
    if (fine) hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5; queue(); });
    window.addEventListener('scroll', () => { sy = Math.min(window.scrollY, innerHeight); queue(); }, { passive: true });
  }

  /* OverCloud key art: the title Spine plays its intro the first time the band scrolls in */
  const oc = $('.oc'), ocCanvas = $('.oc__live');
  const TITLE_RECT = { x: -2230.71, y: -1071.16, w: 4466.75, h: 2148.37 };
  const whenSpine = new Promise(res => {
    const t = setInterval(() => { if (window.spine && window.SpineStage) { clearInterval(t); res(true); } }, 60);
    setTimeout(() => { clearInterval(t); res(false); }, 9000);
  });
  if (oc && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      whenSpine.then(ok => {
        if (!ok || !window.spineLiveAllowed() || innerWidth < 760) return;
        try {
          const stage = new SpineStage(ocCanvas, { fit: 'cover', focus: [.5, .4] });
          stage.load('assets/spine/title/', 'title', TITLE_RECT, ['start', 'loop']).then(r => { if (r) oc.classList.add('is-live'); }).catch(() => {});
        } catch (err) { /* static art stays */ }
      });
    }, { threshold: .25 });
    io.observe(oc);
  }

  /* YouTube thumbnails (fall back when maxres doesn't exist) + click-to-play modal */
  $$('img[data-yt]').forEach(img => {
    const id = img.dataset.yt;
    img.onload = () => { if (img.naturalWidth <= 120) { img.onload = null; img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; } };
    img.onerror = () => { img.onerror = null; img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; };
    img.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  });
  const modal = $('.vmodal'), frameEl = $('.vmodal iframe');
  $$('[data-video]').forEach(b => b.addEventListener('click', () => {
    frameEl.src = `https://www.youtube-nocookie.com/embed/${b.dataset.video}?autoplay=1&rel=0&playsinline=1`;
    frameEl.title = b.dataset.title || 'YouTube 영상';
    modal.showModal();
  }));
  // stop playback right away (the dialog's close event can arrive late in background tabs)
  const close = () => { modal.close(); frameEl.src = 'about:blank'; };
  $('.vmodal__close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.addEventListener('close', () => { frameEl.src = 'about:blank'; });
})();
