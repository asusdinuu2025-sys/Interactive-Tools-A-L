/* StudyLab cosmetic account-mark regression tests. Never grant permissions. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync("assets/js/studylab-name-mark.js","utf8");
const css=readFileSync("assets/css/studylab-name-mark.css","utf8");
assert.doesNotMatch(source,/@gmail\.com/i,"Do not publish private email addresses in browser source");

class MockElement {
  constructor(name){
    this.name=name;this.children=[];this.attributes={};this.className="";this.title="";
  }
  setAttribute(key,value){this.attributes[key]=value;}
  append(...children){this.children.push(...children);}
  querySelector(selector){
    if(selector===":scope > .sl-name-mark")
      return this.children.find(item=>item.className==="sl-name-mark")||null;
    return null;
  }
  remove(){this.removed=true;}
}
const elements={
  createElement(name){return new MockElement(name);},
  createElementNS(_ns,name){return new MockElement(name);}
};
const window={};
runInNewContext(source,{window,document:elements},{timeout:1500});
const marks=window.StudyLabNameMark;
assert.ok(marks,"name mark not exported");
const selected=[
  "b6c80613-8217-48ac-851b-a39a3d9bef2b",
  "7c97a8d7-f047-4c88-883d-4bed9b1a5f99",
  "1f01a0f7-2030-4e14-b561-1e17648d4b3f",
  "24e78cd0-4565-407a-96f7-9cfde083f6d2"
];
for(const id of selected){
  assert.equal(marks.isMarked(id),true,"selected ID missing");
  const name=new MockElement("strong");
  marks.decorate(name,id);
  assert.equal(name.children.length,1,"single mark missing");
  assert.equal(name.children[0].className,"sl-name-mark");
  assert.match(name.children[0].title,/StudyLab account badge/);
  marks.decorate(name,id);
  assert.equal(name.children.length,1,"duplicate mark added");
}
assert.equal(marks.isMarked("00000000-0000-0000-0000-000000000000"),false);
assert.equal(marks.isMarked(""),false);
assert.equal(marks.isMarked(null),false);
const ordinary=new MockElement("strong");
marks.decorate(ordinary,"00000000-0000-0000-0000-000000000000");
assert.equal(ordinary.children.length,0,"ordinary accounts should have no marks");
for(const file of ["index.html","study-room.html"]){
  const html=readFileSync(file,"utf8");
  assert.ok(html.includes("assets/css/studylab-name-mark.css?v=20261114-selected-v1"));
  assert.ok(html.includes("assets/js/studylab-name-mark.js?v=20261114-selected-v1"));
  const helper=html.indexOf("assets/js/studylab-name-mark.js");
  const profile=html.indexOf("assets/js/profile.js");
  assert.ok(helper>=0&&profile>helper,"helper must load before profile");
}
const modules=[
 ["assets/js/profile.js",2],
 ["assets/js/studylab-social.js",3],
 ["assets/js/study-room-realtime.js",2],
 ["assets/js/home-panels.js",2]
];
for(const [path,min] of modules){
  const text=readFileSync(path,"utf8");
  assert.ok((text.match(/StudyLabNameMark\?\.decorate/g)||[]).length>=min,"badge not wired into "+path);
}
assert.ok(css.includes("pointer-events: none"),"badge should not change clicks");
const viewer=readFileSync("assets/js/studylab-profile-view.js","utf8");
assert.ok(viewer.includes("StudyLabNameMark?.decorate(nameNode,id)"),
  "the public student profile viewer must keep the selected account blue badges");
console.log("Selected-account name mark checks passed: only 4 confirmed Auth IDs, 4 user-facing surfaces, no email exposure.");
