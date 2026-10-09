// Minimal Spine 4.2 renderer for the live key art and character standing art.
// Static WebP renders sit underneath; the canvas fades in on top once the skeleton is ready.
// `rect` is the skeleton-space box that the static image covers, so both line up exactly.
(() => {
  const liveAllowed = () => {
    if (!window.spine) return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return false;
    try { return !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; }
  };

  class SpineStage {
    // opts.fit: 'cover' (fill the canvas, crop with focus) | 'rect' (canvas = rect grown by opts.margin)
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.opts = Object.assign({ fit: 'rect', margin: 0, focus: [0.5, 0.5], maxDpr: 2 }, opts);
      this.ctx = new spine.ManagedWebGLRenderingContext(canvas, { alpha: true, premultipliedAlpha: true });
      this.renderer = new spine.SceneRenderer(canvas, this.ctx, true);
      this.am = null;
      this.token = 0;
      this.visible = true;
      this.last = 0;
      this.loop = this.loop.bind(this);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.kick(); })
          .observe(canvas);
      }
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
    }

    load(base, name, rect, anim) {
      const token = ++this.token;
      const am = new spine.AssetManager(this.ctx, base);
      const wait = (fn, path) => new Promise((ok, no) => fn.call(am, path, ok, (p, e) => no(e)));
      return Promise.all([wait(am.loadTextureAtlas, name + '.atlas'), wait(am.loadJson, name + '.json')]).then(() => {
        if (token !== this.token) { am.dispose(); return false; }
        const data = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(am.require(name + '.atlas')))
          .readSkeletonData(am.require(name + '.json'));
        const skel = new spine.Skeleton(data);
        skel.setToSetupPose();
        const state = new spine.AnimationState(new spine.AnimationStateData(data));
        const old = this.am;
        Object.assign(this, { am, skel, state, rect, data });
        this.play(anim);
        if (old) try { old.dispose(); } catch (e) { /* textures already gone */ }
        this.last = 0;
        this.kick();
        return true;
      });
    }

    // anim: a name, or [intro, loop] to play the intro once and then loop
    play(anim) {
      const { data, state } = this;
      if (!state) return;
      const has = n => n && data.findAnimation(n);
      const fallback = has('idle') ? 'idle' : data.animations[0].name;
      if (Array.isArray(anim) && has(anim[0])) {
        state.setAnimation(0, anim[0], false);
        state.addAnimation(0, has(anim[1]) ? anim[1] : fallback, true, 0);
      } else {
        state.setAnimation(0, has(anim) ? anim : fallback, true);
      }
      this.kick();
    }

    kick() { if (!this.raf && this.skel) this.raf = requestAnimationFrame(this.loop); }

    // hide the current skeleton while the next one loads (static art shows through)
    clear() {
      this.token++;
      this.skel = null;
      this.canvas.classList.remove('is-ready');
    }

    view(cw, ch) {
      const r = this.rect, o = this.opts;
      if (o.fit === 'cover') {
        const ca = cw / ch, ra = r.w / r.h;
        const vw = ca > ra ? r.w : r.h * ca;
        const vh = ca > ra ? r.w / ca : r.h;
        const left = r.x + (r.w - vw) * o.focus[0];
        const top = r.y + r.h - (r.h - vh) * o.focus[1];
        return { cx: left + vw / 2, cy: top - vh / 2, vw, vh };
      }
      const m = o.margin;
      return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, vw: r.w * (1 + 2 * m), vh: r.h * (1 + 2 * m) };
    }

    loop(now) {
      this.raf = 0;
      if (!this.skel || !this.visible || document.hidden) return;
      const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 20) : 0;
      this.last = now;

      const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
      const cw = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
      const ch = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
      if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }

      this.state.update(dt);
      this.state.apply(this.skel);
      this.skel.update(dt);
      this.skel.updateWorldTransform(spine.Physics.update);

      const v = this.view(cw, ch), cam = this.renderer.camera, gl = this.ctx.gl;
      cam.position.x = v.cx; cam.position.y = v.cy;
      cam.setViewport(v.vw, v.vh); cam.update();
      gl.viewport(0, 0, cw, ch);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.renderer.begin();
      this.renderer.drawSkeleton(this.skel, true);
      this.renderer.end();

      if (!this.canvas.classList.contains('is-ready')) {
        this.canvas.classList.add('is-ready');
        this.canvas.dispatchEvent(new CustomEvent('spine-ready'));
      }
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  window.SpineStage = SpineStage;
  window.spineLiveAllowed = liveAllowed;
})();
