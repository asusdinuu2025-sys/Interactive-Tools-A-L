(() => {
  'use strict';

  const canvas = document.getElementById('studylabSplashCanvas');
  const loader = document.getElementById('studylabLoader');
  if (!canvas || !loader) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  let w = 0, h = 0, dpr = 1, raf = 0;
  const start = performance.now();

  const drops = [
    [-.44,-.28,10,.9], [.35,-.33,9,.7], [-.58,-.07,6,.9], [.52,-.12,7,.75],
    [-.32,-.48,5,.7], [.10,-.52,8,.85], [.61,.18,9,.72], [-.66,.23,5,.9],
    [-.25,.50,6,.74], [.18,.54,4,.83], [.67,.40,7,.62], [-.74,-.35,3,.8],
    [.77,-.18,4,.78], [-.80,.05,3,.7], [.06,.69,3,.65], [-.11,-.67,4,.82],
    [.38,.66,3,.68], [-.42,.64,3,.72]
  ];

  function rand(i) {
    const x = Math.sin(i * 91.317 + 17.13) * 43758.5453;
    return x - Math.floor(x);
  }

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

  function center() {
    return { x: w * 0.5, y: h * 0.62 };
  }

  function drawOrb(x, y, r, green, alpha, stretch) {
    const g = ctx.createRadialGradient(x - r*.32, y - r*.35, r*.05, x, y, r*1.12);
    const light = document.documentElement.dataset.theme === 'light';
    if (green) {
      g.addColorStop(0, 'rgba(245,255,220,' + (.98*alpha) + ')');
      g.addColorStop(.30, 'rgba(139,255,76,' + (.90*alpha) + ')');
      g.addColorStop(.75, 'rgba(48,225,110,' + (.72*alpha) + ')');
      g.addColorStop(1, 'rgba(30,170,90,0)');
    } else if (light) {
      g.addColorStop(0, 'rgba(235,255,255,' + (.92*alpha) + ')');
      g.addColorStop(.32, 'rgba(66,211,235,' + (.82*alpha) + ')');
      g.addColorStop(.78, 'rgba(12,150,190,' + (.60*alpha) + ')');
      g.addColorStop(1, 'rgba(0,100,150,0)');
    } else {
      g.addColorStop(0, 'rgba(242,255,255,' + (.98*alpha) + ')');
      g.addColorStop(.30, 'rgba(87,239,255,' + (.88*alpha) + ')');
      g.addColorStop(.78, 'rgba(20,179,233,' + (.70*alpha) + ')');
      g.addColorStop(1, 'rgba(0,110,185,0)');
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, stretch || 1);
    ctx.fillStyle = g;
    ctx.shadowBlur = r * 2.1;
    ctx.shadowColor = green ? 'rgba(64,255,92,.48)' : 'rgba(65,225,255,.34)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSplash(t) {
    const p = Math.max(0, Math.min(1, (t - 2550) / 330));
    const slip = Math.max(0, Math.min(1, (t - 3280) / 700));
    const a = t < 3270 ? 1 : 1 - Math.min(1, (t - 3270) / 520);
    const c = center();
    const s = Math.min(w, h);
    const scale = .74 + p * .31;

    ctx.save();
    ctx.translate(c.x, c.y + slip * h * .07);
    ctx.scale(scale, scale * .78);
    ctx.globalAlpha = a;

    const light = document.documentElement.dataset.theme === 'light';
    const grad = ctx.createRadialGradient(-s*.08,-s*.10,s*.03,0,0,s*.42);
    if (light) {
      grad.addColorStop(0,'rgba(229,255,255,.94)');
      grad.addColorStop(.28,'rgba(65,215,237,.74)');
      grad.addColorStop(.72,'rgba(12,150,190,.48)');
    } else {
      grad.addColorStop(0,'rgba(242,255,255,.99)');
      grad.addColorStop(.28,'rgba(80,239,255,.84)');
      grad.addColorStop(.72,'rgba(16,171,228,.52)');
    }
    grad.addColorStop(1,'rgba(0,120,180,0)');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(-s*.25,s*.07);
    ctx.bezierCurveTo(-s*.31,s*.02,-s*.28,-s*.11,-s*.18,-s*.14);
    ctx.bezierCurveTo(-s*.11,-s*.19,-s*.08,-s*.06,-s*.02,-s*.13);
    ctx.bezierCurveTo(s*.03,-s*.20,s*.08,-s*.10,s*.13,-s*.13);
    ctx.bezierCurveTo(s*.19,-s*.18,s*.28,-s*.08,s*.25,s*.02);
    ctx.bezierCurveTo(s*.23,s*.12,s*.12,s*.10,s*.05,s*.15);
    ctx.bezierCurveTo(-s*.02,s*.20,-s*.11,s*.14,-s*.17,s*.17);
    ctx.bezierCurveTo(-s*.21,s*.18,-s*.24,s*.13,-s*.25,s*.07);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const x = d[0] * s * .34;
      const y = d[1] * s * .29;
      drawOrb(x, y, d[2] * (.78 + .22*Math.sin(i+1)), i % 6 === 0, .70, .84 + (i%3)*.08);
    }

    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const x = (i - 3.5) * s * .055;
      const top = s * (.15 + (i%4)*.035);
      ctx.strokeStyle = (i===3 || i===4) ? 'rgba(111,255,125,.70)' : 'rgba(96,239,255,.66)';
      ctx.lineWidth = Math.max(2, s*.008);
      ctx.beginPath();
      ctx.moveTo(x, -s*.035);
      ctx.quadraticCurveTo(x + Math.sin(i*2.4)*s*.018, -s*.09, x + Math.cos(i*1.8)*s*.014, -top);
      ctx.stroke();
      drawOrb(x + Math.cos(i*1.8)*s*.014, -top, s*.012, i===3 || i===4, .72, 1);
    }
    ctx.restore();
  }

  function makeTextTargets() {
    const off = document.createElement('canvas');
    const o = off.getContext('2d');
    if (!o) return [];
    const size = Math.max(44, Math.min(w*.095, 104));
    o.font = '800 ' + size + 'px Segoe UI, Arial, sans-serif';
    const label = 'Study-Lab';
    const mw = Math.ceil(o.measureText(label).width) + 24;
    off.width = Math.min(760, Math.max(280, mw));
    off.height = Math.ceil(size * 1.35);
    o.font = '800 ' + size + 'px Segoe UI, Arial, sans-serif';
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillStyle = '#fff';
    o.fillText(label, off.width/2, off.height/2);
    const data = o.getImageData(0,0,off.width,off.height).data;
    const step = Math.max(3, Math.round(size/25));
    const pts = [];
    for (let y=0;y<off.height;y+=step) {
      for (let x=0;x<off.width;x+=step) {
        if (data[(y*off.width+x)*4+3] > 190) pts.push({x:x-off.width/2,y:y-off.height/2});
      }
    }
    return pts;
  }

  let targets = [];
  function drawWord(t) {
    if (!targets.length) return;
    const p = Math.max(0, Math.min(1, (t-2770)/430));
    const fade = Math.max(0, Math.min(1, (t-3370)/420));
    const c = center();
    const size = Math.max(44, Math.min(w*.095, 104));
    const count = targets.length;
    ctx.save();
    for (let i=0;i<count;i++) {
      const q = targets[i];
      const seed = (i*7)%drops.length;
      const d = drops[seed];
      const fromX = c.x + d[0]*Math.min(w,h)*.34;
      const fromY = c.y + d[1]*Math.min(w,h)*.29;
      const x = fromX + (c.x + q.x*1.18 - fromX)*p;
      const y = fromY + (c.y + q.y*1.18 - fromY)*p;
      const alpha = (.78 + .18*Math.sin(i*.61+t*.007))*p*(1-fade);
      ctx.fillStyle = document.documentElement.dataset.theme === 'light'
        ? 'rgba(15,92,125,'+alpha+')'
        : 'rgba(233,255,255,'+alpha+')';
      ctx.shadowBlur = document.documentElement.dataset.theme === 'light' ? 0 : 11;
      ctx.shadowColor = 'rgba(70,235,255,.40)';
      ctx.beginPath();
      ctx.arc(x,y,Math.max(1.2,size*.008),0,Math.PI*2);
      ctx.fill();
    }
    if (p > .82 && fade < .62) {
      const aa = Math.min(1,(p-.82)/.18) * (1-fade*.92);
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font='800 '+size+'px Segoe UI, Arial, sans-serif';
      ctx.fillStyle=document.documentElement.dataset.theme === 'light'
        ? 'rgba(13,88,121,'+aa+')'
        : 'rgba(233,255,255,'+aa+')';
      ctx.shadowBlur=document.documentElement.dataset.theme === 'light' ? 0 : 18;
      ctx.shadowColor='rgba(70,235,255,.38)';
      ctx.fillText('Study-Lab',c.x,c.y-h*.03+fade*h*.055);
    }
    ctx.restore();
  }

  function frame(now) {
    const t = now - start;
    ctx.clearRect(0,0,w,h);
    if (t >= 2520 && t < 3420) drawSplash(t);
    if (t >= 2720 && t < 3760) drawWord(t);
    if (!loader.classList.contains('is-exiting')) raf=requestAnimationFrame(frame);
  }

  resize();
  targets = makeTextTargets();
  window.addEventListener('resize', () => { resize(); targets = makeTextTargets(); }, {passive:true});
  raf = requestAnimationFrame(frame);
})();