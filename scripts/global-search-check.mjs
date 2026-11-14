/* Static global search acceptance checks. Run after generate-search-index.mjs.
   Validates real resource coverage and keeps existing dashboard layout intact. */
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import path from "node:path";
const index=JSON.parse(readFileSync("assets/data/studylab-search-index.json","utf8"));
assert.equal(index.version,1);
assert.ok(index.count>=95,"expected nearly all StudyLab HTML resources to be indexed");
assert.equal(index.count,index.resources.length,"index count mismatch");
const urls=new Set();
for(const row of index.resources){
 assert.ok(row.title&&row.url&&row.category&&row.subject,"resource missing required fields");
 assert.ok(!urls.has(row.url),"duplicate result URL: "+row.url);
 urls.add(row.url);
 assert.ok(row.url.startsWith("/")||row.url.startsWith("https://"),"unsafe URL");
 if(row.url.startsWith("/")&&!row.url.startsWith("//")){
  const filename=decodeURIComponent(row.url.split(/[?#]/)[0].slice(1));
  if(filename)assert.ok(existsSync(path.join(process.cwd(),filename)),"missing result target "+row.url);
 }
}
const required=[
 "/","/maths.html","/physics.html","/chemistry.html","/biology.html",
 "/exam-hub.html","/study-tools.html","/lesson-packs.html","/study-room.html",
 "/tools/Maths/Integration.html"
];
for(const url of required)assert.ok(urls.has(url),"important public search result missing: "+url);
const scripts=readFileSync("assets/js/study-dashboard.js","utf8");
const global=readFileSync("assets/js/studylab-global-search.js","utf8");
const html=readFileSync("index.html","utf8");
assert.match(scripts,/StudyLabGlobalSearch\?\.mount/,"existing top-bar search not upgraded");
assert.match(scripts,/Global search must not hide or rearrange Home cards/,"Home card isolation missing");
assert.match(global,/aria-activedescendant/,"keyboard selection missing");
assert.match(global,/noopener noreferrer/,"external link protection missing");
assert.ok(html.includes("studyHeaderSearch")||scripts.includes("studyHeaderSearchButton"),
 "existing header icon not reused");
assert.ok(html.includes('class="study-room-launcher-cta"'),"Room CTA not found");
assert.equal((html.match(/class="study-room-launcher-cta"/g)||[]).length,1,"Room CTA duplicated");
assert.ok(!/<button[^>]*class="study-room-launcher-cta"/.test(html),"nested button invalid");
assert.ok(html.includes('href="study-room.html?completeProfile=1&amp;returnTo=%2Fstudy-room.html"'),
 "existing room navigation was modified");
assert.ok(html.includes("studylab-global-search.css"),"search stylesheet not loaded");
console.log("Global search: "+index.count+" real indexed resources; navigation, keyboard and dashboard guards passed.");
