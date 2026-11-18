/* PR #102 guided publishing and native card rendering regression suite.
   Pure local JSDOM fixtures, no Supabase or student-data writes. */
const assert=require("node:assert/strict"),fs=require("node:fs");
const {JSDOM}=require("jsdom");
const read=p=>fs.readFileSync(p,"utf8");
function make(html){
 const dom=new JSDOM("<!doctype html><html><body>"+html+"</body></html>",{
   url:"https://studylablk.netlify.app/index.html",runScripts:"outside-only",
   pretendToBeVisual:true
 });
 if(!dom.window.CSS)dom.window.CSS={};
 dom.window.CSS.escape = s => String(s);
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){
   this.open=false;this.dispatchEvent(new dom.window.Event("close"));
 };
 return dom;
}
(async()=>{
 const doc=make(
 '<div class="tool-grid"></div>'+
 '<div class="telegram-subject"><h2>Mathematics</h2></div>'+
 '<div class="telegram-subject"><h2>Biology</h2></div>'+
 '<div class="telegram-subject"><h2>Physics</h2></div>'+
 '<div class="telegram-subject"><h2>Chemistry</h2></div>'+
 '<div class="telegram-all-grid"></div>'+
 '<section class="telegram-featured-channel"></section>'+
 '<div class="sl-lessons-publisher-grid"></div>');
 doc.window.eval(read("assets/js/studylab-special-resources.js"));
 const render=doc.window.StudyLabSpecialResources.apply;
 const sample={
   id:"custom-11111111-1111-4111-8111-111111111111",kind:"card",
   resource_type:"simulation",page:"physics.html",title:"08. Fields",
   description:"Interactive fields",order:90,emoji:"⚡",lesson_number:8
 };
 assert.equal(render(sample,"simulation-viewer.html?id="+sample.id),true);
 const card=doc.window.document.querySelector(".tool-grid > a.tool-card");
 assert.equal(card.dataset.lesson,"8");
 assert.equal(card.querySelector(".card-icon").textContent,"⚡");
 assert.equal(card.querySelector(".open-tool-btn").textContent,"Open Tool");
 assert.ok(card.href.includes("simulation-viewer.html"));
 const math={...sample,resource_type:"simulation",id:"custom-22222222-2222-4222-8222-222222222222",maths_category:"applied"};
 render(math,"simulation-viewer.html?id="+math.id);
 assert.equal(doc.window.document.querySelectorAll(".tool-card")[1].dataset.filterCategory,"applied");
 const channel={...sample,resource_type:"telegram",id:"custom-33333333-3333-4333-8333-333333333333",
   telegram_category:"maths",title:"Revision Channel"};
 render(channel,"https://t.me/example");
 assert.ok(doc.window.document.querySelector(".telegram-subject .telegram-channel"));
 const all={...channel,id:"custom-44444444-4444-4444-8444-444444444444",telegram_category:"all"};
 render(all,"https://t.me/example");
 assert.ok(doc.window.document.querySelector(".telegram-all-grid .telegram-all-channel"));
 const sponsored={...channel,id:"custom-55555555-5555-4555-8555-555555555555",telegram_category:"sponsored"};
 render(sponsored,"https://t.me/example");
 assert.ok(doc.window.document.querySelector(".sl-cms-sponsored-grid .sl-cms-sponsored"));

 // PR112: Existing emoji strings no longer replace the default Telegram
 // symbol. Uploaded channel images cover the same square without resizing it.
 const channelCard=doc.window.document.querySelector(".telegram-subject .telegram-channel");
 assert.ok(channelCard.querySelector(".telegram-channel-icon img[src$='brand-telegram.svg']"));
 assert.equal(channelCard.querySelector(".telegram-channel-icon").textContent.includes("⚡"),false,
   "Legacy emoji values must not replace the default paper-plane icon");
 const pictured={...channel,id:"custom-photo-channel",image:"https://example.org/group.webp",emoji:":)"};
 render(pictured,"https://t.me/photo");
 let icon=doc.window.document.querySelector('[data-cms-id="custom-photo-channel"] .telegram-channel-icon');
 assert.equal(icon.querySelector(".sl-cms-avatar-photo")?.src,"https://example.org/group.webp");
 assert.ok(icon.querySelector('img[src$="brand-telegram.svg"]'),
   "Telegram fallback must remain underneath uploaded pictures");
 render({...pictured,image:""},"https://t.me/photo");
 icon=doc.window.document.querySelector('[data-cms-id="custom-photo-channel"] .telegram-channel-icon');
 assert.equal(icon.querySelector(".sl-cms-avatar-photo"),null,
   "Removing the picture must immediately restore Telegram fallback");
 render({...pictured,image:"javascript:alert(1)"},"https://t.me/photo");
 assert.equal(icon.querySelector(".sl-cms-avatar-photo"),null,"Unsafe URLs are ignored");

 const featured=doc.window.document.querySelector(".sl-cms-sponsored-grid > .telegram-featured-channel.sl-cms-sponsored");
 assert.ok(featured,"New sponsored cards must reuse the original featured layout");
 assert.equal(featured.tagName,"SECTION","Sponsor's own Join button must be the only link");
 assert.equal(featured.hasAttribute("href"),false);
 assert.ok(featured.querySelector(".telegram-featured-avatar"));
 assert.ok(featured.querySelector(".telegram-featured-copy h2"));
 assert.ok(featured.querySelector(".telegram-featured-eyebrow"));
 assert.ok(featured.querySelector(".telegram-featured-action .telegram-open"));
 assert.equal(featured.querySelector(".telegram-featured-action .telegram-open").href,
   "https://t.me/example");
 assert.equal(featured.querySelector(".telegram-featured-count")?.textContent.includes("Telegram"),true);
 assert.ok(featured.previousElementSibling.classList.contains("telegram-featured-channel"),
   "Additional sponsors appear directly under the existing featured channel");
 render({...sponsored,image:"https://example.org/sponsor.png"},"https://t.me/example");
 assert.equal(featured.querySelector(".telegram-featured-avatar .sl-cms-avatar-photo")?.src,
   "https://example.org/sponsor.png");
 render({...sponsored,image:"",emoji:":)"},"https://t.me/example");
 assert.equal(featured.querySelector(".sl-cms-avatar-photo"),null);
 assert.ok(featured.querySelector(".telegram-featured-avatar-fallback img"));
 assert.equal(doc.window.document.querySelectorAll(".sl-cms-sponsored-grid .sl-cms-sponsored").length,1,
   "Rerender must not duplicate featured cards");

 const pack={...sample,resource_type:"lesson-pack",id:"custom-66666666-6666-4666-8666-666666666666",
  title:"Study Pack",subject:"physics",publisher:"StudyLab Teacher",series:"2027 Revision Pack"};
 render(pack,"https://example.org/lessons");
 assert.ok(doc.window.document.querySelector(".sl-lesson-publisher-card .sl-lesson-publisher-title"));
 assert.equal(render({...sample,resource_type:"custom"},"https://example.org"),false);
 doc.window.close();

 const d=make("<main id='host'></main>");
 d.window.eval(read("assets/js/studylab-admin-publisher.js"));
 const groups=[{id:"free-lesson-packs",draft:{id:"free-lesson-packs",kind:"section",page:"index.html",title:"Free Lessons",order:60,hidden:false}},
 {id:"custom-extra",draft:{id:"custom-extra",kind:"section",page:"index.html",title:"Custom Extra",order:100,hidden:false}}];
 d.window.StudyLabAdminPublisher.mount(d.window.document.querySelector("#host"),{},groups,()=>{});
 assert.equal(d.window.document.querySelectorAll(".sladmin-publish-choice").length,4);
 d.window.document.querySelector("[data-kind=simulation]").click();
 assert.equal(d.window.document.querySelectorAll(".sladmin-path-choice").length,4);
 d.window.document.querySelector(".sladmin-path-choice").click();
 assert.ok(d.window.document.querySelector(".sladmin-publish-dialog input[name=html]"));
 assert.ok(d.window.document.querySelector(".sladmin-publish-dialog input[name=lesson_number]"));
 assert.ok(d.window.document.querySelector(".sladmin-publish-dialog select[name=maths_category]"),
   "Maths simulation form includes Pure/Applied categories");
 d.window.document.querySelector(".sladmin-publish-dialog").close();
 d.window.document.querySelectorAll(".sladmin-path-choice")[1].click();
 assert.ok(d.window.document.querySelector(".sladmin-publish-dialog input[name=lesson_number]"));
 assert.equal(d.window.document.querySelector(".sladmin-publish-dialog select[name=maths_category]"),null,
   "Physics uses lesson filtering, not Pure/Applied category choices");
 d.window.document.querySelector(".sladmin-publish-dialog").close();
 d.window.document.querySelector("[data-kind=simulation]").click();
 d.window.document.querySelector("[data-kind=custom]").click();
 const names=[...d.window.document.querySelectorAll(".sladmin-path-choice")].map(x=>x.textContent);
 assert.ok(names.includes("Custom Extra"));
 d.window.close();


 // End-to-end public CMS load, not just direct calls to the native renderer.
 // Uses entirely mocked records, with no actual Supabase queries or writes.
 async function loadPublicPage(name,markup,published,withSidebar=false){
   const canonical=published[0]?.page || "index.html";
   const dom=new JSDOM("<!doctype html><html><body>"+markup+"</body></html>",{
     url:"https://studylablk.netlify.app/"+name,runScripts:"outside-only",
     pretendToBeVisual:true
   });
   const w=dom.window;
   if(!w.CSS)w.CSS={};
   w.CSS.escape=value=>String(value);
   w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
   w.HTMLElement.prototype.scrollIntoView=function(){};
   w.HTMLElement.prototype.scrollTo=function(){};
   const client={
     from(table){
       assert.equal(table,"studylab_site_content","Public data reader must use only the public CMS table");
       return {
         select(){
           return {
             eq(column,value){
               assert.equal(column,"page");
               assert.equal(value,canonical,"SDK fallback must query canonical .html page");
               return {limit:async()=>({data:published.filter(p=>p.page===canonical).map(payload=>({payload})),error:null})};
             }
           };
         }
       };
     }
   };
   w.supabase={createClient:()=>client};
   // Preview disables admin writes, but must NOT hide already published cards.
   w.StudyLabAdminConfig={mode:"preview"};
   w.eval(read("assets/js/studylab-special-resources.js"));
   if(withSidebar)w.eval(read("assets/js/home-sidebar.js"));
   w.eval(read("assets/js/studylab-content.js"));
   await new Promise(resolve=>w.setTimeout(resolve,45));
   return dom;
 }
 // The public pages must load data without any Supabase JS SDK, JWT, or
 // logged-in user. This reproduces a slow/blocked CDN on real browsers.
 async function loadWithoutSdk(name,markup,row,selector) {
   const dom=new JSDOM("<!doctype html><html><body>"+markup+"</body></html>",{
     url:"https://deploy-preview-102--studylablk.netlify.app/"+name,
     runScripts:"outside-only",pretendToBeVisual:true
   });
   const w=dom.window;
   if(!w.CSS)w.CSS={};
   w.CSS.escape=value=>String(value);
   let requested=false;
   w.fetch=async(url,options)=>{
     requested=true;
     assert.match(url,/\/rest\/v1\/studylab_site_content\?select=payload&page=eq\./);
     assert.ok(url.includes("page=eq."+encodeURIComponent(row.page)),"Request must filter by destination page");
     assert.equal(options.headers.Accept,"application/json");
     assert.ok(options.headers.apikey.startsWith("sb_publishable_"));
     assert.equal(options.cache,"no-store");
     return {ok:true,json:async()=>[{payload:row}]};
   };
   w.StudyLabAdminConfig={mode:"connected"};
   w.eval(read("assets/js/studylab-special-resources.js"));
   w.eval(read("assets/js/studylab-content.js"));
   await new Promise(resolve=>w.setTimeout(resolve,45));
   assert.equal(requested,true,"Native public REST request must run");
   assert.ok(w.document.querySelector(selector),
     "Published "+row.resource_type+" must appear without optional Supabase SDK");
   dom.window.close();
 }
 await loadWithoutSdk("maths.html",
   '<main><section class="tool-grid"></section></main>',
   {...sample,page:"maths.html",url:"/simulation-viewer.html?id="+sample.id},
   ".tool-grid > a.sl-cms-special");
 await loadWithoutSdk("Telegram_Channels.html",
   '<main><section class="telegram-featured-channel"></section><div class="telegram-all-grid"></div></main>',
   {...channel,page:"Telegram_Channels.html",telegram_category:"sponsored",
     url:"https://t.me/study"},
   ".sl-cms-sponsored-grid > a.sl-cms-special");
 await loadWithoutSdk("lesson-packs.html",
   '<main><section class="sl-lessons-publisher-grid"></section></main>',
   {...pack,page:"lesson-packs.html",url:"https://example.org/pack.pdf"},
   ".sl-lessons-publisher-grid > a.sl-cms-special");


 // Netlify serves /lesson-packs and /lesson-packs.html as the same page.
 // Public REST and fallback SDK must always query the canonical .html key.
 for (const [route,canonical] of [
   ["maths","maths.html"],["maths/","maths.html"],
   ["physics","physics.html"],["chemistry","chemistry.html"],
   ["biology","biology.html"]
 ]) {
   await loadWithoutSdk(route,
     '<main><section class="tool-grid"></section></main>',
     {...sample,page:canonical,url:"/simulation-viewer.html?id="+sample.id},
     ".tool-grid > a.sl-cms-special");
 }
 for (const route of ["lesson-packs","lesson-packs/","lesson-packs.html"]) {
   await loadWithoutSdk(route,
     '<main><section class="sl-lessons-publisher-grid"></section></main>',
     {...pack,page:"lesson-packs.html",url:"https://example.org/pack.pdf"},
     ".sl-lessons-publisher-grid > a.sl-cms-special");
 }
 for (const route of ["Telegram_Channels","telegram_channels","Telegram_Channels.html"]) {
   await loadWithoutSdk(route,
     '<main><section class="telegram-featured-channel"></section><div class="telegram-all-grid"></div></main>',
     {...channel,page:"Telegram_Channels.html",telegram_category:"sponsored",
       url:"https://t.me/study"},
     ".sl-cms-sponsored-grid > a.sl-cms-special");
 }
 for (const route of ["","index","index.html"]) {
   await loadWithoutSdk(route,'<main><div data-cms-additions></div></main>',
     {id:"generic-home-test",kind:"card",page:"index.html",title:"Public Home card",
       description:"Live without redeploy",url:"https://example.org/resources",order:20,
       hidden:false},
     '[data-cms-additions] > a[data-cms-id="generic-home-test"]');
 }
 const cleanSdk=await loadPublicPage("lesson-packs",
   '<main><section class="sl-lessons-publisher-grid"></section></main>',
   [{...pack,page:"lesson-packs.html",url:"https://example.org/pack.pdf"}]);
 assert.ok(cleanSdk.window.document.querySelector(".sl-lessons-publisher-grid > a.sl-cms-special"),
   "SDK fallback on clean URL must render already-published lesson packs");
 cleanSdk.window.close();

 const legacySim={...sample,page:"maths.html",title:"05. Test simulation",
   url:"https://simulation-viewer.html?id="+sample.id};
 const mathsPage=await loadPublicPage("maths.html",
   '<main><section class="tool-grid"></section></main>',[legacySim]);
 const repaired=mathsPage.window.document.querySelector(".tool-grid > .sl-cms-special");
 assert.ok(repaired,"Public preview-mode must display live Maths simulation cards");
 assert.equal(new URL(repaired.href).origin,"https://studylablk.netlify.app",
   "Old malformed simulation URLs must be repaired locally, not sent to external domains");
 assert.equal(new URL(repaired.href).pathname,"/simulation-viewer.html");
 assert.equal(new URL(repaired.href).searchParams.get("id"),sample.id);
 mathsPage.window.close();

 const sponsoredRecord={...channel,page:"Telegram_Channels.html",telegram_category:"sponsored",
   url:"https://t.me/example"};
 const telegramPage=await loadPublicPage("Telegram_Channels.html",
   '<main><section class="telegram-featured-channel"></section><div class="telegram-all-grid"></div></main>',
   [sponsoredRecord]);
 assert.equal(telegramPage.window.document.querySelectorAll(".sl-cms-sponsored-grid .sl-cms-special").length,1,
   "A published sponsored Telegram channel must render on page load");
 assert.equal(telegramPage.window.document.querySelector(".sl-cms-sponsor-label")?.textContent,
   "SPONSORED","Sponsored Telegram badge must contain the right text");
 telegramPage.window.close();

 const lessonRecord={...pack,page:"lesson-packs.html",url:"https://example.org/lessons"};
 const lessonsPage=await loadPublicPage("lesson-packs.html",
   '<main><section class="sl-lessons-publisher-grid"></section></main>',
   [lessonRecord]);
 assert.ok(lessonsPage.window.document.querySelector(".sl-lessons-publisher-grid .sl-cms-special"),
   "A published lesson pack must be visible on page load");
 lessonsPage.window.close();

 // CMS runtime has Free Lesson Packs order 60, Other A/L Resources 70.
 // Sidebar must follow the DOM after that change; More must follow the last
 // built-in panel, never point into the middle of Other A/L Resources.
 const builtins=[
   ["practical-simulations",10],["live-study-room",20],["social",30],
   ["past-papers",40],["telegram-links",50],["other-al-resources",60],
   ["free-lesson-packs",70]
 ];
 const mainMarkup=builtins.map(([id,order])=>
   '<section class="sl-home-section" id="'+id+'" data-cms-id="'+id+
   '" data-cms-order="'+order+'"><h2>'+id+'</h2></section>').join("");
 const homeMarkup='<div id="studyLabHomeLayout" class="sl-home-layout">'+
   '<div class="sl-home-content"><main class="container">'+
   '<div id="home-overview"></div>'+mainMarkup+
   '<div id="more-learning-resources"></div></main></div></div>'+
   '<footer class="site-footer"></footer>';
 const homeRecords=[
   {id:"free-lesson-packs",kind:"section",page:"index.html",title:"Free Lesson Packs",
     order:60,hidden:false,description:"",layout:"cards"},
   {id:"other-al-resources",kind:"section",page:"index.html",title:"Other A/L Resources",
     order:70,hidden:false,description:"",layout:"cards"},
   {id:"custom-hidden",kind:"section",page:"index.html",title:"Hidden",order:100,
     hidden:true,description:"",layout:"cards"},
   {id:"custom-hidden-card",kind:"card",page:"index.html",title:"Hidden card",
     description:"",url:"https://example.org/hidden",section:"custom-hidden",order:100,hidden:false},
   {id:"custom-visible",kind:"section",page:"index.html",title:"Extra lessons",
     order:110,hidden:false,description:"",layout:"cards"},
   {id:"custom-visible-card",kind:"card",page:"index.html",title:"Public card",
     description:"Visible",url:"https://example.org/visible",section:"custom-visible",
     order:110,hidden:false}
 ];
 const homePage=await loadPublicPage("index.html",homeMarkup,homeRecords,true);
 const homeDoc=homePage.window.document;
 const elements=[...homeDoc.querySelector("main.container").children];
 const getIndex=id=>elements.indexOf(homeDoc.getElementById(id));
 assert.ok(getIndex("free-lesson-packs")<getIndex("other-al-resources"));
 assert.ok(getIndex("other-al-resources")<getIndex("more-learning-resources"),
   "More anchor must be placed AFTER the last built-in section");
 const navOrder=[...homeDoc.querySelectorAll(".sl-home-nav-item")]
   .map(node=>node.dataset.navId);
 assert.ok(navOrder.indexOf("free-lesson-packs")<navOrder.indexOf("other-al-resources"),
   "Sidebar must use the saved visual section order");
 assert.ok(navOrder.indexOf("other-al-resources")<navOrder.indexOf("more"));
 assert.equal(homeDoc.getElementById("custom-hidden").hidden,true,
   "Cards inside deliberately hidden custom sections must remain hidden");
 assert.ok(homeDoc.querySelector("#custom-visible .sl-cms-card"),
   "Published cards in visible custom sections must appear");
 homePage.window.close();

 const viewer=read("simulation-viewer.html");
 assert.ok(/sandbox="allow-scripts allow-forms"/.test(viewer),"Viewer must sandbox uploaded HTML");
 assert.ok(!/sandbox\\s*=\\s*["'][^"']*allow-same-origin/.test(viewer),"Never give user HTML StudyLab origin access");
 assert.ok(/studylab_site_content/.test(viewer),"Viewer must check publication status");
 assert.ok(!/service_role/.test(viewer),"Never expose privileged API keys");
 const api=read("assets/js/studylab-admin-api.js");
 assert.ok(api.includes('studylab-simulations'));
 assert.ok(api.includes("uploadSimulation"));
 const search=read("assets/js/studylab-global-search.js");
 assert.ok(search.includes("/rest/v1/studylab_site_content"),"Published search must use the public REST reader without an SDK dependency");
 const lesson=read("assets/js/lesson-filter.js");
 assert.ok(lesson.includes("element.dataset.lesson"));
 assert.ok(lesson.includes("element.dataset.filterCategory"));
 const sidebar=read("assets/js/home-sidebar.js");
 assert.ok(sidebar.includes("studylab-content-applied"));
 assert.ok(sidebar.includes("syncNavigationOrder"));
 const chat=read("assets/js/chat.js");
 assert.ok(chat.includes('class="study-chat-editorline"'));
 assert.ok(chat.includes('M22 2 11 13'));
 assert.ok(chat.includes('typingActive'));
 assert.ok(chat.includes("messageFailure"));
 const css=read("assets/css/chat.css");
 assert.ok(css.includes("PR #102 unified Telegram-style glass composer"));
 console.log("PASS: guided publishing, special resource layout, safe HTML viewer, dynamic search and integrated chat composer.");
})().catch(e=>{console.error(e);process.exitCode=1;});