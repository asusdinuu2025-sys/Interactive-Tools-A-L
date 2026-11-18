/* PR112 Telegram browser interaction checks, entirely local JSDOM.
   No Netlify, Supabase or live student data is accessed. */
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {JSDOM}=require("jsdom");
const dom=new JSDOM(
  '<!doctype html><html><body class="sl-telegram-hub">'+
    '<main class="sl-subject-main">'+
      '<div class="sl-subject-intro-panel"><h1>Telegram Channels</h1></div>'+
      '<div class="telegram-sponsored-bar">SPONSORED</div>'+
      '<section class="telegram-featured-channel" aria-label="Original A/L Lessons">'+
      '<div class="telegram-featured-copy">A/L Lessons</div>'+
      '<a class="telegram-open" href="https://t.me/AL_LESSONS">Join Channel</a></section>'+
      '<section class="telegram-subject-grid">'+
      ["Mathematics","Biology","Chemistry","Physics"].map(name=>
        '<section class="telegram-subject"><div class="telegram-subject-head">'+
        '<div><h2>'+name+'</h2></div></div></section>').join("")+
      '</section>'+
      '<section class="telegram-all"><div class="telegram-all-head">'+
      '<div><h2>All Subjects</h2></div></div>'+
      '<div class="telegram-all-grid"></div></section>'+
    '</main></body></html>',{
    url:"https://deploy-preview-112--studylablk.netlify.app/Telegram_Channels.html",
    runScripts:"outside-only",pretendToBeVisual:true
  });
const w=dom.window,doc=w.document;
// Fake the clock: assert exact intervals and transitions without waiting.
const pending=new Map();let timerId=0;
w.setTimeout=(callback,delay)=>{const id=++timerId;pending.set(id,{callback,delay});return id;};
w.clearTimeout=id=>pending.delete(id);
const pendingTimer=()=>[...pending.values()][0];
w.CSS={escape:token=>String(token)};
function staticCard(host,title,order,all=false) {
  const a=doc.createElement("a");
  a.className=all?"telegram-all-channel":"telegram-channel";
  a.href="https://t.me/"+title.toLowerCase().replaceAll(" ","_");
  a.dataset.cmsId="telegram_channels-card-"+String(order);
  a.dataset.cmsOrder=String(order);
  a.innerHTML='<span class="telegram-channel-icon"></span><span><strong>'+
    title+'</strong><span>Study resources</span></span><span class="telegram-open">Open Channel</span>';
  host.append(a);return a;
}
const sections=[...doc.querySelectorAll(".telegram-subject")];
const maths=sections[0],bio=sections[1],chem=sections[2],physics=sections[3];
for(let i=1;i<=5;i++)staticCard(maths,"Legacy Maths "+i,i*10);
staticCard(bio,"Bio Basics",60);
staticCard(chem,"Chemistry Basics",70);
staticCard(physics,"Physics Basics",80);
staticCard(doc.querySelector(".telegram-all-grid"),"General A/L",90,true);
w.eval(readFileSync("assets/js/studylab-special-resources.js","utf8"));
w.eval(readFileSync("assets/js/telegram-channel-browser.js","utf8"));
assert(w.StudyLabTelegramBrowser,"Browser controls must initialize before content retrieval");
const host=doc.querySelector("#sl-tg-sponsored-cards");
assert(host,"Carousel must use stable parent for both static and new sponsored cards");
assert(host.contains(doc.querySelector(".telegram-featured-channel")),
  "Original featured channel must be preserved and included in the carousel");
assert.equal(doc.querySelectorAll("[data-tg-filter]").length,7,
  "All, Sponsored, Maths, Biology, Chemistry, Physics, All Subjects must be selectable");
const make=(id,category,order,title)=>({
  id,resource_type:"telegram",kind:"card",page:"Telegram_Channels.html",
  telegram_category:category,order,title,resource_title:title,description:"Resources and notes",
  url:"https://t.me/"+id,hidden:false
});
const add=row=>assert(w.StudyLabSpecialResources.apply(row,row.url),
 "New Telegram channel must use native renderer");
add(make("math-early","maths",300,"Maths Newer"));
add(make("math-late","maths",310,"Maths Newest"));
add(make("sponsor-earlier","sponsored",280,"Sponsored Earlier"));
add(make("sponsor-latest","sponsored",320,"Sponsored Latest"));
add(make("bio-latest","biology",330,"BIO New"));
add({...make("chem-latest","chemistry",340,"Organic Chemistry New"),
  publisher:"Teacher Search Alias Unique"});
add(make("physics-latest","physics",350,"Physics New"));
add(make("general-latest","all",360,"Mixed Subjects New"));
w.dispatchEvent(new w.CustomEvent("studylab-content-applied",{detail:{page:"Telegram_Channels.html"}}));
const visible=c=>!c.hidden&&!c.classList.contains("sl-tg-filtered-out");
const visibleCards=sel=>[...doc.querySelectorAll(sel)].filter(visible);
const cats=key=>doc.querySelector('[data-tg-category="'+key+'"]');
assert.equal(doc.querySelector('[data-tg-filter="all"]').getAttribute("aria-pressed"),"true");
assert.equal(visibleCards(".telegram-subject:nth-child(1) > .telegram-channel").length,4,
  "Default All view shows a concise preview of four Maths channels");
assert.equal(maths.querySelector(":scope > .telegram-channel").textContent.includes("Maths Newest"),true,
  "Newest published Maths channel must be first in DOM and keyboard order");
const mathNames=[...maths.querySelectorAll(":scope > .telegram-channel")]
  .map(x=>x.querySelector("strong")?.textContent);
assert.deepEqual(mathNames.slice(0,3),["Maths Newest","Maths Newer","Legacy Maths 1"],
  "New channels sort before old ones but original built-in order is unchanged");
const sponsorList=[...host.querySelectorAll(":scope > .telegram-featured-channel")];
assert.equal(sponsorList[0].querySelector("h2")?.textContent,"Sponsored Latest",
  "Newest sponsored channel becomes first carousel slide");
assert.equal(visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel").length,1,
  "Collapsed sponsored carousel occupies one card's height");
const next=doc.querySelector('[aria-label="Next sponsored channel"]');
const prev=doc.querySelector('[aria-label="Previous sponsored channel"]');
assert(!next.hidden && !prev.hidden,"Carousel arrows appear with multiple sponsors");
const glassNav=doc.querySelector(".sl-tg-carousel-nav");
assert(glassNav && glassNav.contains(next) && glassNav.contains(prev),
  "Both sponsored arrows must share one glass navigation pill");
assert.equal(glassNav.hidden,false,"Visible carousel must reveal its navigation pill");
assert.equal(glassNav.querySelectorAll(".sl-tg-carousel-arrow svg path").length,2,
  "Navigation uses crisp SVG chevrons instead of oversized text arrows");
assert.equal(glassNav.getAttribute("aria-label"),"Sponsored channel navigation");
next.click();
assert.equal(visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel")[0]
 .querySelector("h2")?.textContent,"Sponsored Earlier");
next.click();
assert(visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel")[0]
 .textContent.includes("A/L Lessons"),"Original featured card remains reachable");
next.click();
assert.equal(visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel")[0]
 .querySelector("h2")?.textContent,"Sponsored Latest","Carousel wraps at the end");
prev.click();
assert(visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel")[0]
 .textContent.includes("A/L Lessons"),"Previous arrow wraps back to original");

const sponsorMore=cats("sponsored").querySelector(".sl-tg-view-all");
sponsorMore.click();
assert.equal(glassNav.hidden,true,"Expanded sponsors must hide the empty navigation pill");
assert.equal(sponsorMore.getAttribute("aria-expanded"),"true");
assert.equal(visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel").length,3,
  "Sponsored View All expands the same page and displays every existing/new sponsor");
assert.equal(sponsorMore.textContent,"Show Less");
assert.equal(w.location.pathname,"/Telegram_Channels.html","View All must not navigate");
sponsorMore.click();
assert.equal(glassNav.hidden,false,"Collapsing sponsors restores navigation");
assert.equal(visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel").length,1);

// Auto rotation defaults to two seconds and is configurable by Admin.
assert.equal(w.StudyLabTelegramBrowser.getAutoAdvanceSeconds(),2);
assert.equal(pending.size,1,"One carousel timer only; never stack intervals");
assert.equal(pendingTimer().delay,2000,"Default auto-slide interval is 2 seconds");
const currentSlide=visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel")[0];
const [firedId,firedTimer]=pending.entries().next().value;
// Real one-shot timeouts remove themselves before invoking their callback.
pending.delete(firedId);
firedTimer.callback();
assert.notEqual(visibleCards("#sl-tg-sponsored-cards > .telegram-featured-channel")[0],
  currentSlide,"Automatic carousel timeout advances to the next card");
assert.equal(pending.size,1,"Each automatic transition schedules exactly one next tick");
w.StudyLabTelegramBrowser.setAutoAdvanceSeconds(5);
assert.equal(w.StudyLabTelegramBrowser.getAutoAdvanceSeconds(),5);
assert.equal(pendingTimer().delay,5000,"Admin-configured five-second interval must be honored");
w.StudyLabTelegramBrowser.setAutoAdvanceSeconds(1);
assert.equal(w.StudyLabTelegramBrowser.getAutoAdvanceSeconds(),2,
  "Unsafe intervals outside 2–60 must use the 2s default");
const sponsored=cats("sponsored");
sponsored.dispatchEvent(new w.Event("mouseenter"));
assert.equal(pending.size,0,"Stop automatic motion while hovering");
sponsored.dispatchEvent(new w.Event("mouseleave"));
assert.equal(pendingTimer().delay,2000,"Resume when pointer leaves carousel");
sponsored.dispatchEvent(new w.Event("focusin"));
assert.equal(pending.size,0,"Stop carousel when user is navigating by keyboard");
sponsored.dispatchEvent(new w.FocusEvent("focusout",{relatedTarget:null}));
assert.equal(pending.size,1,"Resume when keyboard focus leaves");
sponsorMore.click();
assert.equal(pending.size,0,"Never auto-advance when View All is expanded");
sponsorMore.click();
assert.equal(pending.size,1,"Return to auto-advance in compact mode");

const mathMore=cats("maths").querySelector(".sl-tg-view-all");
assert.equal(mathMore.textContent,"View All");
mathMore.click();
assert.equal(visibleCards('#sl-tg-maths > .telegram-channel').length,7,
  "Mathematics View All must reveal every channel in the current grid");
mathMore.click();
assert.equal(visibleCards('#sl-tg-maths > .telegram-channel').length,4,
  "Show Less must return Mathematics to four cards");
assert.equal(w.location.href.includes("Telegram_Channels.html"),true);

for(const [label,key] of [
  ["Sponsored","sponsored"],["Maths","maths"],["Biology","biology"],
  ["Chemistry","chemistry"],["Physics","physics"],["All Subjects","all-subjects"]
]){
 const button=doc.querySelector('[data-tg-filter="'+key+'"]');
 button.click();
 assert.equal(button.getAttribute("aria-pressed"),"true");
 for(const [other,element] of [
  ["sponsored",cats("sponsored")],["maths",cats("maths")],
  ["biology",cats("biology")],["chemistry",cats("chemistry")],
  ["physics",cats("physics")],["all-subjects",cats("all-subjects")]
 ])assert.equal(element.hidden,other!==key,
   "Selecting "+label+" should show only "+label+" section");
}
doc.querySelector('[data-tg-filter="all"]').click();
assert([...doc.querySelectorAll("[data-tg-category]")].every(s=>!s.hidden),
 "All filter restores every section");

const query=doc.querySelector(".sl-tg-search input");
query.value="organic";
query.dispatchEvent(new w.Event("input",{bubbles:true}));
assert.equal(cats("chemistry").hidden,false,"Search must show matching Chemistry section");
assert.equal(cats("maths").hidden,true,"Search hides unrelated sections");
assert.equal(visibleCards('#sl-tg-chemistry > .telegram-channel').length,1);
query.value="teacher search alias unique";
query.dispatchEvent(new w.Event("input",{bubbles:true}));
assert.equal(cats("chemistry").hidden,false,
  "Teacher field must be searchable even when absent from visible channel title");
assert.equal(visibleCards("#sl-tg-chemistry > .telegram-channel").length,1);
query.value="xxxxxxxx-no-channel";
query.dispatchEvent(new w.Event("input",{bubbles:true}));
assert.equal(doc.querySelector(".sl-tg-no-results").hidden,false,
 "Unmatched searches must display a no-results message");
query.value="";
query.dispatchEvent(new w.Event("input",{bubbles:true}));
assert.equal(doc.querySelector(".sl-tg-no-results").hidden,true);

add(make("math-even-newer","maths",380,"Just Published Maths"));
w.dispatchEvent(new w.CustomEvent("studylab-content-applied",{detail:{page:"Telegram_Channels.html"}}));
assert.equal(maths.querySelector(":scope > .telegram-channel strong")?.textContent,"Just Published Maths",
 "Newly published cards must become first after refreshing content, without deployment");
assert.equal(visibleCards("#sl-tg-maths > .telegram-channel").length,4);
const hiddenNew=make("hidden-physics","physics",390,"Hidden Physics Draft");
hiddenNew.hidden=true;
add(hiddenNew);
w.dispatchEvent(new w.CustomEvent("studylab-content-applied",{detail:{page:"Telegram_Channels.html"}}));
assert.equal(doc.querySelector('[data-cms-id="hidden-physics"]').hidden,true,
 "Admin-hidden cards must not be exposed by filters or View All");
assert.equal(doc.querySelectorAll(".sl-tg-filtered-out").length>0,true);
dom.window.close();
console.log("PASS: seven Telegram filters, 2s/configurable sponsored rotation, pause/resume, ordering, in-page View All, search, and hidden-content safety.");