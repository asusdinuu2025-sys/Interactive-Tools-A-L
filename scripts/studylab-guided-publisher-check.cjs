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
 dom.window.CSS.escape=s=>String(s).replace(/[^a-zA-Z0-9_-]/g,"\\ dom.window.CSS.escape=s=>String(s).replace(/[^a-zA-Z0-9_-]/g,"\\$&");");
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
 const pack={...sample,resource_type:"lesson-pack",id:"custom-66666666-6666-4666-8666-666666666666",
  title:"Study Pack",subject:"physics",publisher:"StudyLab Teacher",series:"2027 Revision Pack"};
 render(pack,"https://example.org/lessons");
 assert.ok(doc.window.document.querySelector(".sl-lessons-publisher-card .sl-lesson-publisher-title"));
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
 d.window.document.querySelector(".sladmin-publish-dialog").close();
 d.window.document.querySelector("[data-kind=simulation]").click();
 d.window.document.querySelector("[data-kind=custom]").click();
 const names=[...d.window.document.querySelectorAll(".sladmin-path-choice")].map(x=>x.textContent);
 assert.ok(names.includes("Custom Extra"));
 d.window.close();

 const viewer=read("simulation-viewer.html");
 assert.ok(/sandbox="allow-scripts allow-forms"/.test(viewer),"Viewer must sandbox uploaded HTML");
 assert.ok(!/allow-same-origin/.test(viewer),"Never give user HTML StudyLab origin access");
 assert.ok(/studylab_site_content/.test(viewer),"Viewer must check publication status");
 assert.ok(!/service_role/.test(viewer),"Never expose privileged API keys");
 const api=read("assets/js/studylab-admin-api.js");
 assert.ok(api.includes('studylab-simulations'));
 assert.ok(api.includes("uploadSimulation"));
 const search=read("assets/js/studylab-global-search.js");
 assert.ok(search.includes('from("studylab_site_content")'));
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