/* Scoped custom Home section visual and publishing regression checks.
   Uses mocked public JSON rows; never calls a live StudyLab database. */
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {JSDOM}=require("jsdom");
const read=path=>readFileSync(path,"utf8");
const records=[
  {id:"sl-test-list",kind:"section",page:"index.html",title:"Student utilities",
    description:"Curated StudyLab links",kicker:"STUDY UTILITIES",layout:"list",
    order:100,hidden:false},
  {id:"sl-test-grid",kind:"section",page:"index.html",title:"Revision cards",
    description:"Grid remains unchanged",layout:"cards",order:110,hidden:false},
  {id:"sl-test-list-photo",kind:"card",page:"index.html",section:"sl-test-list",
    title:"MCQ practice",description:"Review exam questions",order:100,hidden:false,
    url:"https://example.org/practice",image:"https://example.org/picture.png",
    button_label:"Practice Now",eyebrow:"ONLINE PRACTICE"},
  {id:"sl-test-list-icon",kind:"card",page:"index.html",section:"sl-test-list",
    title:"Quick study tools",description:"Plan and review",order:110,hidden:false,
    url:"https://example.org/tools",image:"",emoji:"📘",button_label:"Open Tools"},
  {id:"sl-test-list-default",kind:"card",page:"index.html",section:"sl-test-list",
    title:"Useful link",description:"No picture or emoji",order:120,hidden:false,
    url:"https://example.org/other",image:""},
  {id:"sl-test-grid-card",kind:"card",page:"index.html",section:"sl-test-grid",
    title:"Revision",description:"Original card layout",order:130,hidden:false,
    url:"https://example.org/revision",button_label:"Open resource",image:""}
];
const dom=new JSDOM('<!doctype html><html data-theme="dark"><body>'+
  '<main class="container"><section class="sl-home-section" id="free-lesson-packs" '+
  'data-cms-id="free-lesson-packs" data-cms-order="70">'+
  '<h2>Free Lessons</h2></section><div id="more-learning-resources"></div></main>'+
  '</body></html>',{
    url:"https://studylablk.netlify.app/index.html",runScripts:"outside-only",
    pretendToBeVisual:true
  });
const w=dom.window,doc=w.document;
w.CSS={escape:value=>String(value)};
w.StudyLabAdminConfig={mode:"connected"};
let requests=0;
w.fetch=async (url)=>{
  requests++;
  assert.match(String(url),/\/rest\/v1\/studylab_site_content\?/);
  assert.match(String(url),/page=eq.index.html/);
  return {ok:true,json:async()=>records.map(payload=>({payload}))};
};
w.eval(read("assets/js/studylab-content.js"));
(async()=>{
  await w.StudyLabContentReady;
  assert.equal(requests,1,"Home reads the shared public database, not browser-local cards");
  const list=doc.getElementById("sl-test-list");
  const grid=doc.getElementById("sl-test-grid");
  assert(list && grid,"Both layouts must render");
  assert.equal(list.dataset.layout,"list");
  assert.equal(grid.dataset.layout,"cards");
  assert.equal(list.querySelector(".sl-cms-section-heading h2")?.textContent,
    "Student utilities");
  assert.equal(list.querySelector(".sl-cms-section-kicker")?.textContent,
    "STUDY UTILITIES");
  assert.equal(grid.querySelector(".sl-cms-section-kicker")?.hidden,true,
    "No empty badge when section heading is not configured");
  assert.equal(list.querySelector(":scope > .sl-cms-grid").children.length,3);
  const photo=doc.querySelector('[data-cms-id="sl-test-list-photo"]');
  const icon=doc.querySelector('[data-cms-id="sl-test-list-icon"]');
  const fallback=doc.querySelector('[data-cms-id="sl-test-list-default"]');
  assert.equal(photo.querySelector(".sl-cms-card-kicker").textContent,"ONLINE PRACTICE");
  assert.equal(photo.querySelector(".sl-cms-open").textContent,"Practice Now");
  assert.equal(photo.href,"https://example.org/practice");
  assert.ok(photo.querySelector('img.sl-cms-image'));
  assert.equal(photo.querySelector(".sl-cms-list-icon").hidden,true,
    "Uploaded pictures replace the list icon instead of creating a duplicate");
  photo.querySelector("img.sl-cms-image").dispatchEvent(new w.Event("error"));
  assert.equal(photo.querySelector("img.sl-cms-image"),null,
    "Broken image must not leave a missing-photo frame");
  assert.equal(photo.querySelector(".sl-cms-list-icon").hidden,false,
    "Failed image must automatically reveal the fallback resource icon");
  assert.equal(icon.querySelector(".sl-cms-list-icon").textContent,"📘");
  assert.equal(icon.querySelector(".sl-cms-open").textContent,"Open Tools");
  assert(!icon.querySelector("img.sl-cms-image"),"Emoji fallback must work without images");
  assert.ok(fallback.querySelector(".sl-cms-list-icon svg path"),
    "Unspecified list icon uses a clean default SVG");
  assert.equal(fallback.querySelector(".sl-cms-open").textContent,"Open resource");
  const gridCard=doc.querySelector('[data-cms-id="sl-test-grid-card"]');
  assert.equal(gridCard.parentElement,grid.querySelector(".sl-cms-grid"));
  assert.equal(gridCard.querySelector(".sl-cms-open").textContent,"Open resource");
  const css=read("assets/css/studylab-content.css");
  assert(css.includes('section.sl-cms-section[data-layout="list"] > .sl-cms-grid > a.sl-cms-card'),
    "New compact row layout must be strictly limited to list sections");
  assert(css.includes('section.sl-cms-section .sl-cms-list-icon {display:none;}'),
    "Existing grid mode must not show the fallback icon");
  assert(css.includes('background:\n    linear-gradient(132deg,var(--sl-cms-sheen),transparent 52%),'),
    "Keep the existing outer translucent glass background");
  assert(css.includes("@media(max-width:480px)"),
    "Resource rows must adapt to narrow mobile screens");
  assert(read("index.html").includes("studylab-content.css?v=pr114-custom-sections-v1"));
  assert(read("index.html").includes("studylab-content.js?v=pr114-custom-sections-v1"));
  assert(read("admin.html").includes("studylab-admin.js?v=pr114-custom-sections-v1"));
  assert(read("admin.html").includes("studylab-admin-publisher.js?v=pr114-custom-sections-v1"));
  assert(read("admin.html").includes("studylab-admin-api.js?v=pr114-custom-sections-v1"));
  const generator=read("scripts/generate-admin-config.mjs");
  assert(generator.includes('"114"'),"PR114 must remain explicitly live connected");
  w.close();
  console.log("PASS: custom sections preserve glass, responsive list rows, grid, badges and live config");
})().catch(error=>{console.error(error);process.exitCode=1;dom.window.close()});
