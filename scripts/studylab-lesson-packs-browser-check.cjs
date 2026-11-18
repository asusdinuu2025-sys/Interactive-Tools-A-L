/* Free Lessons page checks: subject filter, cover fallback and newest first.
   JSDOM only: no production website, Netlify API or Supabase requests. */
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {JSDOM}=require("jsdom");
const read=path=>readFileSync(path,"utf8");

const dom=new JSDOM(`<!doctype html><html data-theme="dark"><body class="sl-lessons-hub">
  <main class="lesson-page sl-subject-main">
    <div class="sl-subject-intro-panel"><h1>Free Lessons</h1></div>
    <section class="sl-lessons-publisher-grid">
      <a class="sl-lesson-publisher-card" data-cms-id="lesson-packs-card-0"
         data-cms-order="10" href="smk-physics-lessons.html">
        <span class="sl-lesson-publisher-identity">
          <span class="sl-lesson-publisher-mark"><svg></svg></span>
          <span class="sl-lesson-publisher-topline">FREE PHYSICS · 2027 A/L</span>
        </span>
        <span class="sl-lesson-publisher-body">
          <strong class="sl-lesson-publisher-title">SMK PHYSICS</strong>
          <span class="sl-lesson-publisher-series">2027 SPEED REVISE PACK</span>
          <span class="sl-lesson-publisher-description">Revision practice</span>
        </span>
      </a>
    </section>
  </main>
</body></html>`,{
  url:"https://deploy-preview-0--studylablk.netlify.app/lesson-packs.html",
  runScripts:"outside-only",pretendToBeVisual:true
});
const w=dom.window, doc=w.document;
w.CSS={escape:value=>String(value)};
w.eval(read("assets/js/studylab-special-resources.js"));
w.eval(read("assets/js/lesson-pack-browser.js"));
const grid=doc.querySelector(".sl-lessons-publisher-grid");
const original=doc.querySelector('[data-cms-id="lesson-packs-card-0"]');
const hidden=card=>card.hidden||card.classList.contains("sl-lp-filtered-out");
const visible=()=>[...grid.children].filter(c=>!hidden(c));
assert.equal(doc.querySelectorAll("[data-lp-filter]").length,5,
  "All, Maths, Physics, Chemistry and Biology must exist");
assert.equal(doc.querySelector("[data-lp-filter=all]").getAttribute("aria-pressed"),"true");
assert.equal(visible().length,1,"Original SMK Physics card must remain visible");
assert.equal(original.getAttribute("href"),"smk-physics-lessons.html");

const make=(id,order,subject,publisher,image="",emoji="")=>({
  id,kind:"card",page:"lesson-packs.html",resource_type:"lesson-pack",
  resource_title:id,title:id,description:"Free lesson series",
  subject,publisher,series:id+" Theory",button_label:"View Lessons",
  image,emoji,order,hidden:false
});
function add(record){
  assert(w.StudyLabSpecialResources.apply(record,"https://example.org/"+record.id));
  return doc.querySelector('[data-cms-id="'+record.id+'"]');
}
const maths=add(make("Maths Old",20,"maths","Maths Teacher"));
const chemistry=add(make("Chemistry Pack",30,"chemistry","Organic Teacher"));
const biology=add(make("Bio Pack",40,"biology","Biology Teacher"));
const cover=add(make("Aj Cover",50,"maths","Ajantha Teacher","https://example.org/cover.jpg",":)"));
const mark=cover.querySelector(".sl-lesson-publisher-mark");
const picture=mark.querySelector("img.sl-cms-lesson-image");
assert(picture,"Uploaded cover must be inside the existing icon tile");
assert.equal(cover.querySelectorAll(".sl-lesson-publisher-identity > img").length,0,
  "Never place a duplicate picture next to the subject mark");
assert.equal(cover.querySelectorAll(".sl-lesson-publisher-mark").length,1);
assert(mark.classList.contains("sl-has-cover"),"Cover hides icon while image is available");
assert.equal(mark.querySelector(".sl-lesson-publisher-fallback")?.textContent,":)",
  "Explicit administrator icon remains available as fallback");
picture.dispatchEvent(new w.Event("error"));
assert.equal(mark.querySelector("img"),null,"Broken cover must be removed");
assert(!mark.classList.contains("sl-has-cover"),
  "Broken images must reveal the fallback icon immediately");
const fallbackMaths=maths.querySelector(".sl-lesson-publisher-fallback");
assert.equal(fallbackMaths.textContent,"📐","Missing Maths photo uses subject icon");
assert.equal(chemistry.querySelector(".sl-lesson-publisher-fallback").textContent,"⚗");
assert.equal(biology.querySelector(".sl-lesson-publisher-fallback").textContent,"🧬");

function refresh(){
  w.dispatchEvent(new w.CustomEvent("studylab-content-applied",{
    detail:{page:"lesson-packs.html"}
  }));
}
refresh();
assert.deepEqual([...grid.children].map(c=>c.dataset.cmsId),
  ["Aj Cover","Bio Pack","Chemistry Pack","Maths Old","lesson-packs-card-0"],
  "Newer uploads must be first; keep the original card after published packs");
assert.equal(visible().length,5);
assert.equal(grid.lastElementChild,original,"Never replace or delete original SMK card");
assert.equal(cover.href,"https://example.org/Aj%20Cover",
  "Reordering must not break destination links");
const newest=add(make("Brand New Physics",60,"physics","Latest Physics Teacher"));
refresh();
assert.equal(grid.firstElementChild,newest,
  "Newly published card automatically becomes the first card");

doc.querySelector("[data-lp-filter=maths]").click();
assert.deepEqual(visible().map(c=>c.dataset.cmsId),["Aj Cover","Maths Old"]);
doc.querySelector("[data-lp-filter=biology]").click();
assert.deepEqual(visible().map(c=>c.dataset.cmsId),["Bio Pack"]);
doc.querySelector("[data-lp-filter=physics]").click();
assert.deepEqual(visible().map(c=>c.dataset.cmsId),
  ["Brand New Physics","lesson-packs-card-0"],"Built-in subject must filter correctly");

const search=doc.querySelector(".sl-lp-search input");
search.value="latest physics teacher";
search.dispatchEvent(new w.Event("input",{bubbles:true}));
assert.deepEqual(visible().map(c=>c.dataset.cmsId),["Brand New Physics"],
  "Search also matches teacher / publisher");
search.value="unfindable-term";
search.dispatchEvent(new w.Event("input",{bubbles:true}));
assert.equal(visible().length,0);
assert.equal(doc.querySelector(".sl-lp-no-results").hidden,false);
search.value="";
search.dispatchEvent(new w.Event("input",{bubbles:true}));
assert.equal(doc.querySelector(".sl-lp-no-results").hidden,true);
doc.querySelector("[data-lp-filter=all]").click();
assert.equal(visible().length,6);
const hiddenPack=add({...make("Hidden",80,"maths","Private"),hidden:true});
refresh();
assert(hidden(hiddenPack),"Do not expose hidden Admin resources");
assert.equal(visible().length,6);
assert.equal(grid.querySelectorAll(".sl-lesson-publisher-card").length,7,
  "All existing links and resources must be preserved");

const css=read("assets/css/lesson-pack-browser.css");
const html=read("lesson-packs.html");
assert(css.includes("html[data-theme=\"light\"] body.sl-lessons-hub .sl-lp-filter-bar"),
  "Filter must adapt to StudyLab light mode");
assert(css.includes(".sl-lesson-publisher-mark.sl-has-cover .sl-lesson-publisher-fallback"));
assert(css.includes("prefers-reduced-motion"),"Respect reduced-motion preference");
assert(html.includes("lesson-pack-browser.css?v=lesson-filter-v1"));
assert(html.includes("lesson-pack-browser.js?v=lesson-filter-v1"));
assert(html.includes("studylab-special-resources.js?v=lesson-cover-fallback-v1"));
assert(!read("Telegram_Channels.html").includes("lesson-pack-browser"),
  "No Telegram or other page should inherit this filter");
dom.window.close();
console.log("PASS: lesson pack cover fallback, subject filters, search, newest-first and originals");
