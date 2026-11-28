const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {JSDOM} = require('jsdom');
const read = p => fs.readFileSync(p,'utf8');
function harness(url='https://example.org/index.html') {
  const dom = new JSDOM('<html><head><link rel="stylesheet" href="assets/css/studylab-pet.css"></head><body></body></html>', {url,runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window, timers = new Map(), frames = new Map(); let id=0;
  w.matchMedia = () => ({matches:false,addEventListener(){},removeEventListener(){}});
  w.setTimeout = (fn,ms) => {timers.set(++id,{fn,ms});return id;};
  w.clearTimeout = id => timers.delete(id);
  w.setInterval = () => ++id; w.clearInterval = () => {};
  w.requestAnimationFrame = fn => {frames.set(++id,fn);return id;};
  w.cancelAnimationFrame = id => frames.delete(id);
  const tick = ms => { for(const [id,t] of [...timers]) if(t.ms===ms){timers.delete(id);t.fn();} };
  const frame = () => { const queued=[...frames];frames.clear();for(const [,fn] of queued) fn(100); };
  return {dom,w,timers,frames,tick,frame};
}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
(async()=>{
  for(const saved of ['dark','light','system','invalid']) {
    const h=harness();h.w.localStorage.setItem('studylab-room-mode-v1',saved);
    h.w.sessionStorage.setItem('studylab-first-entry-in-tab-v2','1');
    h.w.eval(read('assets/js/page-boot.js'));
    assert.equal(h.w.document.documentElement.dataset.theme,saved==='light'||saved==='system'?'light':'dark');
    assert(h.w.document.documentElement.classList.contains('sl-booting'));
    h.w.document.dispatchEvent(new h.w.Event('DOMContentLoaded'));h.tick(0);await flush();h.frame();h.frame();
    assert(!h.w.document.documentElement.classList.contains('sl-booting'));
    h.dom.window.close();
  }
  // First Home visit in every fresh tab uses the chemistry intro. Every
  // reload, normal navigation, Back/Forward and later return uses four rings.
  {
    const first=harness();
    first.w.eval(read('assets/js/page-boot.js'));
    const root=first.w.document.documentElement;
    assert(root.classList.contains('sl-first-intro'), 'fresh Home tab must show flask');
    assert(!root.classList.contains('sl-booting'), 'flask and rings must not overlap');
    assert.equal(first.w.sessionStorage.getItem('studylab-first-entry-in-tab-v2'),'1');
    const oldLoader=first.w.document.createElement('div');oldLoader.id='studylabLoader';
    first.w.document.body.append(oldLoader);
    first.w.dispatchEvent(new first.w.Event('pagehide'));
    assert(!first.w.document.getElementById('studylabLoader'), 'pagehide clears old flask');
    assert(!root.classList.contains('sl-first-intro'));
    first.dom.window.close();

    const returning=harness();
    returning.w.localStorage.setItem('studylab-first-welcome-intro-v2','1');
    returning.w.eval(read('assets/js/page-boot.js'));
    assert(returning.w.document.documentElement.classList.contains('sl-first-intro'),
      'returning student in fresh Home tab must also get flask');
    assert(!returning.w.document.documentElement.classList.contains('sl-booting'));
    returning.dom.window.close();

    const refresh=harness();
    Object.defineProperty(refresh.w.performance,'getEntriesByType',
      {value:()=>[{type:'reload'}],configurable:true});
    refresh.w.eval(read('assets/js/page-boot.js'));
    assert(refresh.w.document.documentElement.classList.contains('sl-booting'),
      'refresh must show the four rotating arcs');
    assert(!refresh.w.document.documentElement.classList.contains('sl-first-intro'));
    refresh.dom.window.close();

    const back=harness();
    Object.defineProperty(back.w.performance,'getEntriesByType',
      {value:()=>[{type:'back_forward'}],configurable:true});
    back.w.eval(read('assets/js/page-boot.js'));
    assert(back.w.document.documentElement.classList.contains('sl-booting'),
      'history navigation without BFCache must show rotating arcs');
    assert(!back.w.document.documentElement.classList.contains('sl-first-intro'));
    back.dom.window.close();

    const sameTab=harness();
    sameTab.w.sessionStorage.setItem('studylab-first-entry-in-tab-v2','1');
    sameTab.w.eval(read('assets/js/page-boot.js'));
    assert(sameTab.w.document.documentElement.classList.contains('sl-booting'),
      'returning to Home in same tab must show arcs');
    assert(!sameTab.w.document.documentElement.classList.contains('sl-first-intro'));
    sameTab.dom.window.close();

    const inner=harness('https://example.org/study-room.html');
    inner.w.eval(read('assets/js/page-boot.js'));
    assert(inner.w.document.documentElement.classList.contains('sl-booting'),
      'entering another StudyLab page must show rotating arcs');
    assert(!inner.w.document.documentElement.classList.contains('sl-first-intro'));
    inner.dom.window.close();

    const restored=harness();
    restored.w.sessionStorage.setItem('studylab-first-entry-in-tab-v2','1');
    restored.w.eval(read('assets/js/page-boot.js'));
    restored.w.document.dispatchEvent(new restored.w.Event('DOMContentLoaded'));
    restored.tick(0);await flush();restored.frame();restored.frame();
    assert(!restored.w.document.documentElement.classList.contains('sl-booting'));
    restored.w.dispatchEvent(new restored.w.Event('pagehide'));
    const restoreEvent=new restored.w.Event('pageshow');
    Object.defineProperty(restoreEvent,'persisted',{value:true});
    restored.w.dispatchEvent(restoreEvent);
    assert(restored.w.document.documentElement.classList.contains('sl-booting'),
      'BFCache Back/Forward must briefly show four rotating arcs');
    restored.tick(300);
    assert(!restored.w.document.documentElement.classList.contains('sl-booting'),
      'restored page must never remain blurred after rings finish');
    restored.dom.window.close();

    const home=read('index.html');
    assert(home.includes('sl-dropper-reagent'),'flask must contain matching green reagent');
    assert(home.includes('sl-flask-mark-a'),'intro uses science-themed background marks');
    assert(home.includes('html:not(.sl-first-intro) #studylabLoader'),
      'flask is hidden from the first paint on all non-fresh loads');
  }
  // Only four independent quarter-rings, not a GIF/canvas or progress bar.
  {
    const css=read('assets/css/page-boot.css');
    assert(css.includes('backdrop-filter: blur(3px)'));
    assert(css.includes('transform: translateZ(0)'), 'SL orbits/text must retain their own sharp compositing layer');
    assert(css.includes('#sl-boot-loader::before'), 'blur must stay in the loader background layer');
    assert(css.includes('.sl-boot-orbits, .sl-boot-name'), 'logo and text need their own foreground');
    assert(!/html\.sl-booting::before\s*\{[^}]*backdrop-filter/.test(css),
      'root overlay must not backdrop-blur the foreground logo');
    assert(css.includes('prefers-reduced-motion: reduce'));
    assert(css.includes('sl-boot-arc-rotate'));
    assert(css.includes('--rotation: -360deg'));
    assert(css.includes('--rotation: 360deg'));
    assert(!css.includes('sl-booting body { visibility: hidden'),
      'the live page must stay behind the translucent loader');
  }
  // The brand intro is always white even when the user's page uses a
  // light theme; cross-document transitions must not dim new loader frames.
  {
    const intro=read('assets/js/loader-splash.js');
    assert(intro.includes("text: 'rgba(245,252,255,'"));
    assert(!intro.includes("text: 'rgba(14,86,119,'"));
    const transition=read('assets/css/page-transitions.css');
    assert(transition.includes('::view-transition-new(root) { animation: none; opacity: 1; }'));
  }
  // Slow auth/CMS cannot indefinitely hide a usable page.
  {
    const h=harness();h.w.sessionStorage.setItem('studylab-first-entry-in-tab-v2','1');
    h.w.StudyLabContentReady=new Promise(()=>{});
    h.w.eval(read('assets/js/page-boot.js'));h.w.document.dispatchEvent(new h.w.Event('DOMContentLoaded'));h.tick(0);await flush();
    assert(h.w.document.documentElement.classList.contains('sl-booting'));
    h.tick(3000);await flush();h.frame();h.frame();assert(!h.w.document.documentElement.classList.contains('sl-booting'));h.dom.window.close();
  }
  // Storage denied and a blocked script/parser still recover via the hard deadline.
  {
    const h=harness();Object.defineProperty(h.w,'localStorage',{get(){throw Error('denied');}});
    h.w.eval(read('assets/js/page-boot.js'));h.tick(12000);
    assert(!h.w.document.documentElement.classList.contains('sl-booting'));h.dom.window.close();
  }
  for(const name of ['studylab-pet','studylab-pet-room']) {
    const h=harness('https://example.org/'+(name.endsWith('room')?'study-room.html':'index.html'));
    h.w.localStorage.setItem('studylab-pet-enabled','false');
    h.w.eval(read('assets/js/'+name+'.js'));
    assert.equal(h.frames.size,0,'disabled pet must not schedule animation work');
    assert.equal(h.w.document.querySelectorAll('link[href*="studylab-pet.css"]').length,1);
    h.w.document.querySelector('[data-pet-enable]').click();
    assert(h.frames.size>0,'enable must restart pet animation');
    h.w.document.querySelector('[data-pet-disable]').click();h.frame();
    assert.equal(h.frames.size,0,'disable must stop animation work');
    h.w.document.querySelector('[data-pet-enable]').click();
    Object.defineProperty(h.w.document,'hidden',{value:true,configurable:true});h.frame();
    assert.equal([...h.frames.values()].filter(fn=>fn.name==='lifeLoop').length,0,'hidden tab must stop pet loop');
    Object.defineProperty(h.w.document,'hidden',{value:false,configurable:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
    assert(h.frames.size>0,'visible tab must resume pet loop');h.dom.window.close();
  }
  // Repeat splash must never even acquire the canvas or schedule a frame.
  {
    const h=harness();h.w.document.body.innerHTML='<div id="studylabLoader"><canvas id="studylabSplashCanvas"></canvas></div>';
    h.w.sessionStorage.setItem('studylabSplashSeenV1','1');h.w.eval(read('assets/js/loader-splash.js'));assert.equal(h.frames.size,0);h.dom.window.close();
  }
  // Check actual deployment output: same style order/content, fewer requests,
  // no missing assets and stable content hashes on repeated builds.
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'studylab-css-'));
  try {
    fs.cpSync('assets',path.join(temp,'assets'),{recursive:true});
    const pages=fs.readdirSync('.').filter(x=>x.endsWith('.html'));
    for(const page of pages)fs.copyFileSync(page,path.join(temp,page));
    const build=()=>spawnSync(process.execPath,[path.resolve('scripts/bundle-styles.mjs')],{cwd:temp,encoding:'utf8'});
    const result=build();assert.equal(result.status,0,result.stderr);console.log(result.stdout.trim());
    const styleSequence=html=>[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>|<link\b[^>]*rel="stylesheet"[^>]*href="([^"?]+)(?:\?[^"]*)?"[^>]*>/g)].flatMap(m=>{
      if(m[1]!==undefined)return ['inline:'+m[1]];
      const href=m[2];if(href.includes('sl-bundle-'))return [...read(path.join(temp,href)).matchAll(/\/\* (assets\/css\/[^\n]+) \*\//g)].map(x=>x[1]);return [href];
    });
    for(const page of pages){
      const source=read(page),built=read(path.join(temp,page));
      assert.deepEqual(styleSequence(built),styleSequence(source),page+' cascade order');
      if(page==='index.html')console.log('Homepage stylesheet links:',(source.match(/rel="stylesheet"/g)||[]).length,'→',(built.match(/rel="stylesheet"/g)||[]).length);
      for(const m of built.matchAll(/href="(assets\/css\/sl-bundle-[^"]+)"/g)){
        const bundle=read(path.join(temp,m[1]));
        const members=[...bundle.matchAll(/\/\* (assets\/css\/[^\n]+) \*\//g)].map(x=>x[1]);
        const expected=members.map(p=>`/* ${p} */\n${read(p)}\n`).join('\n');
        assert.equal(bundle,expected,'every CSS rule preserved byte-for-byte');
      }
    }
    const once=read(path.join(temp,'index.html'));assert.equal(build().status,0);assert.equal(read(path.join(temp,'index.html')),once);
    // Build-time HTML injection must be correct, limited and repeatable.
    const sync=()=>spawnSync(process.execPath,[path.resolve('scripts/sync-page-boot.mjs')],{cwd:temp,encoding:'utf8'});
    const synced=sync();assert.equal(synced.status,0,synced.stderr);
    const firstRender=read(path.join(temp,'index.html'));
    assert.equal((firstRender.match(/id="sl-boot-loader"/g)||[]).length,1);
    assert.equal((firstRender.match(/class="sl-boot-ring"/g)||[]).length,4);
    assert(firstRender.includes('studylab-192.png?v=sl-infinity-20261127'));
    assert(firstRender.includes('<strong class="sl-boot-name">StudyLab</strong>'));
    assert.equal((firstRender.match(/id="sl-page-boot"/g)||[]).length,1);
    assert.equal(sync().status,0);
    assert.equal(read(path.join(temp,'index.html')),firstRender,
      'running loader injection twice must never duplicate markup');

  } finally {fs.rmSync(temp,{recursive:true,force:true});}
  console.log('PASS: early themes, slow/failed startup recovery, disabled/hidden pet suspension and restart, repeat splash, CSS cascade/content preservation and bundle idempotence.');
})().then(()=>{
  const result=spawnSync(process.execPath,[path.join(__dirname,"studylab-xp-tests.cjs")],{stdio:"inherit"});
  if(result.error)throw result.error;
  assert.equal(result.status,0,"XP release checks");
}).catch(e=>{console.error(e);process.exitCode=1;});
