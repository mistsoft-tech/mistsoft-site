// mistsoft.kr shared behaviour: header, scroll progress, reveal, drifting fog, KO/EN toggle, copy buttons.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  /* header + progress + to-top */
  const hdr = document.querySelector('.hdr');
  const bar = document.querySelector('.progress');
  const top = document.querySelector('.totop');
  const onScroll = () => {
    const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    if (hdr) hdr.classList.toggle('is-solid', y > 30);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (top) top.classList.toggle('is-on', y > innerHeight * .8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));

  const burger = document.querySelector('.burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = hdr.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    hdr.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => { hdr.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }));
  }

  /* reveal on scroll */
  const items = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }),
      { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    items.forEach(el => io.observe(el));
  } else items.forEach(el => el.classList.add('is-in'));

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  /* drifting fog: soft blobs on a half-res canvas; the cursor clears a hole through it */
  class Fog {
    constructor(canvas) {
      this.c = canvas; this.x = canvas.getContext('2d');
      this.density = +canvas.dataset.density || 22;
      this.tint = canvas.dataset.tint || '225,225,232';
      this.alpha = +canvas.dataset.alpha || .07;
      this.interactive = canvas.hasAttribute('data-interactive');
      this.mouse = { x: -999, y: -999, tx: -999, ty: -999 };
      this.blobs = [];
      this.visible = true;
      this.resize();
      for (let i = 0; i < this.density; i++) this.blobs.push(this.spawn(true));
      window.addEventListener('resize', () => this.resize());
      if (this.interactive) {
        const host = canvas.parentElement;
        host.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); this.mouse.tx = (e.clientX - r.left) * this.s; this.mouse.ty = (e.clientY - r.top) * this.s; });
        host.addEventListener('pointerleave', () => { this.mouse.tx = this.mouse.ty = -999; });
      }
      if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.kick(); }).observe(canvas);
      this.loop = this.loop.bind(this);
      reduced ? this.draw(0) : this.kick();
    }
    resize() { this.s = .5; this.w = this.c.width = Math.max(1, Math.round(this.c.clientWidth * this.s)); this.h = this.c.height = Math.max(1, Math.round(this.c.clientHeight * this.s)); }
    spawn(any) {
      const r = (.18 + Math.random() * .32) * Math.max(this.w, this.h);
      return { x: any ? Math.random() * this.w : -r, y: this.h * (.15 + Math.random() * .85), r, v: (.04 + Math.random() * .12) * this.s * 2, a: this.alpha * (.5 + Math.random()), p: Math.random() * 6.28 };
    }
    kick() { if (!this.raf) this.raf = requestAnimationFrame(this.loop); }
    loop(t) { this.raf = 0; if (!this.visible || document.hidden) return; this.draw(t); this.raf = requestAnimationFrame(this.loop); }
    draw(t) {
      const { x: g, w, h } = this;
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
      for (const b of this.blobs) {
        b.x += b.v; b.p += .004;
        const yy = b.y + Math.sin(b.p) * 12;
        if (b.x - b.r > w) Object.assign(b, this.spawn(false));
        const gr = g.createRadialGradient(b.x, yy, 0, b.x, yy, b.r);
        gr.addColorStop(0, `rgba(${this.tint},${b.a})`);
        gr.addColorStop(1, `rgba(${this.tint},0)`);
        g.fillStyle = gr; g.fillRect(b.x - b.r, yy - b.r, b.r * 2, b.r * 2);
      }
      if (this.interactive && this.mouse.tx > -900) {
        const m = this.mouse;
        m.x += (m.tx - m.x) * .12; m.y += (m.ty - m.y) * .12;
        const R = 130;
        g.globalCompositeOperation = 'destination-out';
        const hole = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, R);
        hole.addColorStop(0, 'rgba(0,0,0,.85)'); hole.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = hole; g.fillRect(m.x - R, m.y - R, R * 2, R * 2);
      }
    }
  }
  document.querySelectorAll('canvas.fog').forEach(c => new Fog(c));
  window.MSFog = Fog;

  /* KO / EN toggle for the policy pages (both texts stay in the page) */
  const root = document.querySelector('[data-lang-root]');
  if (root) {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    const set = l => {
      root.dataset.langRoot = l;
      document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
      document.documentElement.lang = l;
      store.set('ms-lang', l);
    };
    set(fromUrl === 'en' || fromUrl === 'ko' ? fromUrl : (store.get('ms-lang') || 'ko'));
    document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => set(b.dataset.lang)));
  }

  /* copy-to-clipboard */
  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btn.dataset.copy); } catch (e) { return; }
    const old = btn.textContent; btn.textContent = '복사됨 ✓'; btn.classList.add('is-done');
    setTimeout(() => { btn.textContent = old; btn.classList.remove('is-done'); }, 1600);
  }));
})();
