(() => {
  'use strict';

  const canvas = document.getElementById('studylabSplashCanvas');
  const loader = document.getElementById('studylabLoader');
  if (!canvas || !loader) return;

  const reactionCore = document.querySelector('.studylab-loader-reaction-core');
  if (reactionCore) reactionCore.remove();

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let w = 0, h = 0, dpr = 1, raf = 0;
  const start = performance.now();

  const smoke = Array.from({ length: 24 }, (_, i) => ({
    angle: i * 2.399963 + 0.5,
    radius: 0.035 + ((i * 17) % 23) / 1000,
    size: 0.035 + ((i * 13) % 31) / 900,
    drift: 0.018 + ((i * 7) % 17) / 1000,
    speed: 0.45 + ((i * 11) % 23) / 45,
    phase: ((i * 19) % 29) / 29
  }));

  let wordAlpha = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function themeValues() {
    const light = document.documentElement.dataset.theme === 'light';
    return light
      ? {
          core: 'rgba(145,248,255,.44)',
          mid: 'rgba(28,212,241,.30)',
          edge: 'rgba(0,145,190,0)',
          text: 'rgba(14,86,119,',
          glow: 'rgba(28,210,239,.20)'
        }
      : {
          core: 'rgba(190,255,255,.68)',
          mid: 'rgba(35,229,255,.44)',
          edge: 'rgba(0,137,210,0)',
          text: 'rgba(235,255,255,',
          glow: 'rgba(51,231,255,.42)'
        };
  }

  function drawSmoke(t) {
    const elapsed = t - start;
    if (elapsed < 2480 || elapsed > 3920) return;

    const values = themeValues();
    const cx = w * 0.5;
    const baseY = h * 0.61;
    const s = Math.min(w, h);
    const grow = Math.min(1, Math.max(0, (elapsed - 2500) / 460));
    const fade = elapsed > 3500 ? Math.min(1, (elapsed - 3500) / 380) : 0;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    ctx.filter = 'blur(' + Math.max(4, s*.012) + 'px)';
    for (let i = 0; i < smoke.length; i++) {
      const p = smoke[i];
      const phase = elapsed * 0.001 * p.speed + p.phase * Math.PI * 2;
      const x = cx + Math.cos(phase + p.angle) * s*p.radius * (1 + grow*.6) + Math.sin(phase*1.7) * s*p.drift;
      const y = baseY - (elapsed - 2480) * (0.018 + p.speed*.004) - Math.abs(Math.sin(phase*.8)) * s*.055;
      const r = s * p.size * (0.7 + grow*.75);
      const a = (0.16 + (i%5)*.022) * (1-fade);
      const g = ctx.createRadialGradient(x-r*.25,y-r*.30,r*.05,x,y,r);
      g.addColorStop(0, values.core);
      g.addColorStop(.38, values.mid);
      g.addColorStop(1, values.edge);
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWordmark(t) {
    const elapsed = t - start;
    if (elapsed < 2640 || elapsed > 3920) return;

    const appear = Math.min(1, Math.max(0, (elapsed - 2640) / 380));
    const fade = elapsed > 3640 ? Math.min(1, (elapsed - 3640) / 280) : 0;
    wordAlpha = appear * (1 - fade*.35);

    const values = themeValues();
    const size = Math.max(46, Math.min(w * .105, 112));
    const y = h * 0.57 + fade * h * .025;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 ' + size + 'px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = values.text + wordAlpha + ')';
    ctx.shadowBlur = document.documentElement.dataset.theme === 'light' ? 8 : 24;
    ctx.shadowColor = values.glow;
    ctx.fillText('Study-Lab', w*.5, y);
    ctx.restore();
  }

  function frame(now) {
    ctx.clearRect(0, 0, w, h);
    drawSmoke(now);
    drawWordmark(now);
    if (!loader.classList.contains('is-exiting')) {
      raf = requestAnimationFrame(frame);
    }
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  raf = requestAnimationFrame(frame);
})();