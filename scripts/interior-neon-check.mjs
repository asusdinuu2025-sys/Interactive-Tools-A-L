/* Read-only Node smoke test for StudyLab interior-page decorative opt-ins.
   No browser, external requests, Supabase, or saved data are accessed. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const pages = {
  "maths.html":"maths",
  "physics.html":"physics",
  "chemistry.html":"chemistry",
  "biology.html":"biology",
  "exam-hub.html":"exam",
  "study-tools.html":"utilities",
  "lesson-packs.html":"lessons",
  "smk-physics-lessons.html":"revise",
  "Audio_Books.html":"audio",
  "generalenglish.html":"english",
  "generalknowledge.html":"gct",
  "git.html":"git",
  "Telegram_Channels.html":"telegram",
  "study-room.html":"study-room"
};
const js = readFileSync("assets/js/interior-neon-doodles.js","utf8");
const css = readFileSync("assets/css/interior-neon-glass.css","utf8");
const expectedCssRef = "assets/css/interior-neon-glass.css?v=20261114-neon-v1";
const expectedScriptRef = "assets/js/interior-neon-doodles.js?v=20261114-neon-v1";
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.dataset = {};
    this.innerHTML = "";
  }
  setAttribute(key,value){this.attributes[key] = String(value);}
  append(...nodes){this.children.push(...nodes);}
  prepend(...nodes){this.children.unshift(...nodes);}
}
function simulate(page) {
  const body = new Element("body");
  body.dataset.slNeonPage = page;
  const document = {
    body,
    querySelector(selector) {
      if(selector === ".sl-neon-layer")return body.children.find(x=>x.className==="sl-neon-layer")||null;
      return null;
    },
    createElement(tag){return new Element(tag);},
    createElementNS(_ns,tag){return new Element(tag);}
  };
  runInNewContext(js,{document}, {timeout:1500, filename:"interior-neon-doodles.js"});
  return body.children;
}
let observed = {};
for (const [file,page] of Object.entries(pages)) {
  const source = readFileSync(file,"utf8");
  assert.match(source,new RegExp('data-sl-neon-page="'+page+'"'),file+" missing page identity");
  assert.ok(source.includes(expectedCssRef),file+" missing scoped styles");
  assert.equal((source.match(/interior-neon-glass\.css/g)||[]).length,1,file+" duplicate styles");
  const icons = simulate(page);
  if(page === "telegram"){
    assert.equal(icons.length,0,"Telegram must reuse its licensed existing doodle layer");
    assert.ok(source.includes("sl-tg-doodle-layer"),"Telegram's original doodles missing");
    assert.ok(!source.includes(expectedScriptRef),"Telegram must not load duplicate icons");
  }else{
    assert.ok(source.includes(expectedScriptRef),file+" missing shared renderer");
    assert.equal(icons.length,1,file+" should add exactly one decorative layer");
    assert.equal(icons[0].attributes["aria-hidden"],"true");
    assert.equal(icons[0].children.length,8,file+" should have eight unique subject symbols");
    assert.ok(icons[0].children.every(x=>x.children.length===1&&x.children[0].tagName==="svg"));
    observed[page] = icons[0].children.map(x=>x.dataset.icon);
    assert.equal(new Set(observed[page]).size,8,page+" duplicate icon definitions");
  }
}
assert.equal(simulate("")[0],undefined,"Home should not get a decorative interior layer");
assert.ok(!readFileSync("index.html","utf8").includes(expectedScriptRef),"Home must stay unchanged");
assert.ok(!readFileSync("study-room-mini.html","utf8").includes(expectedScriptRef),"Mini timer must stay unchanged");
assert.ok(css.includes('body.study-room-page[data-room-doodles="off"] .sl-neon-layer'),"Room doodles off must hide new icons");
assert.ok(css.includes('data-sl-neon-page="study-room"'),"Room theme palette must be supported");
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'),"Reduced motion support missing");
assert.ok(css.includes('[data-theme="light"]'),"Light-mode neon palette missing");
assert.ok(css.includes('data-sl-performance="lite"'),"Lite performance fallback missing");
for(const [page,icons] of Object.entries(observed)){
  assert.ok(css.includes('data-sl-neon-page="'+page+'"'),page+" missing scoped page styling");
  assert.ok(icons.every(Boolean),page+" has empty icon name");
}
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,"CSS braces unbalanced");
console.log("Interior neon glass checks passed for 14 page hubs and 13 original icon configurations.");
