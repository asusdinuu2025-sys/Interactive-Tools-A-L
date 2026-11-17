/* PR #102: test profile-driven countdown and visible-panel sidebar tracking.
   Entirely synthetic page: never reads or changes live account data. */
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
const {readFileSync}=require("node:fs");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const js=p=>readFileSync(p,"utf8");
function dom(html){
  const instance=new JSDOM("<!doctype html><html><body>"+html+"</body></html>",{
    url:"https://studylablk.netlify.app/index.html",
    runScripts:"outside-only",pretendToBeVisual:true
  });
  const w=instance.window;
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.HTMLElement.prototype.scrollTo=function(){};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  return instance;
}
(async()=>{
  const scene=dom(`<section data-live-layer data-countdown-target="2027-08-01T00:00:00+05:30">
    <span data-live-online></span><span data-live-status></span>
    <select data-cd-year><option value="2027">2027</option><option value="2028">2028</option></select>
    <span data-cd-days></span><span data-cd-hours></span>
    <span data-cd-minutes></span><span data-cd-seconds></span>
    <span data-countdown-note></span></section>`);
  const w=scene.window;
  const channel={
    presenceState:()=>({}),
    on(){return this;},subscribe(fn){fn("SUBSCRIBED");return this;},
    track:async()=>({}),untrack:async()=>({})
  };
  const client={channel:()=>channel};
  w.supabase={createClient:()=>client};
  w.StudyLabAccount={
    ready:Promise.resolve(),
    getUser:()=>({id:"11111111-1111-4111-8111-111111111111"}),
    getProfile:async()=>({exam_year:"2028"}),
    client
  };
  w.eval(js("assets/js/live-layer.js"));
  await wait(55);
  const select=w.document.querySelector("[data-cd-year]");
  const root=w.document.querySelector("[data-live-layer]");
  assert.equal(select.value,"2028","Profile exam_year=2028 defaults to 2028 countdown");
  assert.match(root.dataset.countdownTarget,/^2028-08-01/);
  assert.ok(Number(w.document.querySelector("[data-cd-days]").textContent)>0);
  w.dispatchEvent(new w.CustomEvent("studylab-profile-updated",{
    detail:{exam_year:"2027"}
  }));
  assert.equal(select.value,"2027");
  select.value="2028";select.dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.equal(select.value,"2028","Small selector can switch countdown");
  w.dispatchEvent(new w.CustomEvent("studylab-profile-updated",{
    detail:{exam_year:"Other"}
  }));
  assert.equal(select.value,"2027","Unrecognized exam year falls back to 2027");
  scene.window.close();

  const sidebarScene=dom(`<header class="site-header"></header>
    <div id="studyLabHomeLayout" class="sl-home-layout">
    <div class="sl-home-content"><main class="container">
      <section id="home-overview"></section>
      <section id="free-lesson-packs" data-cms-order="60"></section>
      <section id="other-al-resources" data-cms-order="70"></section>
      <div id="more-learning-resources" class="sl-home-more-anchor"></div>
    </main></div></div>`);
  const s=sidebarScene.window;
  s.document.querySelector("header").getBoundingClientRect=()=>({bottom:90,top:0});
  s.document.getElementById("home-overview").getBoundingClientRect=()=>
    ({top:-1000,bottom:-700});
  s.document.getElementById("free-lesson-packs").getBoundingClientRect=()=>
    ({top:-100,bottom:220});
  s.document.getElementById("other-al-resources").getBoundingClientRect=()=>
    ({top:225,bottom:690});
  s.document.getElementById("more-learning-resources").getBoundingClientRect=()=>
    ({top:900,bottom:901});
  s.eval(js("assets/js/home-sidebar.js"));
  s.dispatchEvent(new s.Event("scroll"));
  await wait(65);
  const active=s.document.querySelector(".sl-home-nav-item.is-active");
  assert.equal(active?.dataset.navId,"other-al-resources",
    "Sidebar must highlight Other A/L Resources once it fills the visible screen");
  sidebarScene.window.close();
  console.log("PASS: 2027/2028 profile countdown + accurate sidebar visible section.");
})().catch(e=>{console.error(e);process.exitCode=1});
