/* Run production avatar service through a deterministic mock DOM/browser.
   Regression: an upload must REPLACE the SVG visibly, not merely append a hidden
   image while reporting "saved". Removing must restore the original SVG. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const uid="11111111-2222-4333-8444-555555555555";
const actualSource=readFileSync("assets/js/studylab-avatar.js","utf8");
const uuidRule=actualSource.match(/const UUID = (\/[^;]+\/i);/);
assert.ok(uuidRule,"Avatar must explicitly validate Supabase user IDs");
const standardUuid="11111111-2222-4333-8444-555555555555";
assert.ok(new RegExp(uuidRule[1].slice(1,-2),"i").test(standardUuid),
  "Avatar validator must accept standard five-section Supabase UUIDs");

const tokens=new Set();
const fallback=()=>({
  nodeType:1,tagName:"svg",className:"original-svg",
  classList:{contains:()=>false},
  cloneNode(){return fallback();}
});
const node={
  dataset:{},isConnected:true,childNodes:[fallback()],
  classList:{
    add(v){tokens.add(v)},remove(v){tokens.delete(v)},
    contains(v){return tokens.has(v)}
  },
  replaceChildren(...children){this.childNodes=children;},
  querySelector(selector){
    if(selector.includes("img.sl-avatar-photo"))
      return this.childNodes.find(n=>n.className==="sl-avatar-photo")||null;
    if(selector.includes("svg"))
      return this.childNodes.find(n=>n.tagName==="svg")||null;
    return null;
  }
};
const viewer={
  hidden:false,
  querySelector(selector){return selector===".sl-pv-avatar"?node:null}
};
class MockImage{
  constructor(){
    this.nodeType=1;this.tagName="IMG";this.className="";
    this.style={};this.naturalWidth=0;this.naturalHeight=0;
    this.complete=false;this.onload=null;this.onerror=null;
    this.classList={contains:name=>this.className.split(" ").includes(name)};
  }
  set src(value){
    this._src=value;
    this.naturalWidth=320;this.naturalHeight=320;this.complete=true;
    queueMicrotask(()=>this.onload?.());
  }
  get src(){return this._src}
  setAttribute(){}
  getBoundingClientRect(){return {width:68,height:68}}
  decode(){return Promise.resolve()}
}
class MockFile{
  constructor(){this.type="image/jpeg";this.size=10000}
}
const storage={
  from:()=>({
    getPublicUrl:path=>({data:{publicUrl:"https://example.test/"+path}}),
    upload:async()=>({error:null}),
    update:async()=>({error:null}),
    remove:async()=>({error:null})
  })
};
const updatedAt="2026-11-15T17:09:00.000Z";
const profileTable={
  select(){return this},
  in:async()=>({data:[{user_id:uid,updated_at:updatedAt}],error:null}),
  upsert(){return this},
  single:async()=>({data:{updated_at:updatedAt.replace("09","10")},error:null}),
  delete(){return this},
  eq:async()=>({error:null})
};
const account={
  ready:Promise.resolve(),
  getUser:()=>({id:uid,is_anonymous:false}),
  client:{storage,from:()=>profileTable}
};
let lastCropArgs=null;
const doc={
  hidden:false,
  addEventListener(){},
  getElementById:id=>id==="slProfileViewer"?viewer:null,
  querySelectorAll:selector=>selector.includes(uid)?[node]:[],
  createElement:name=>{
    if(name!=="canvas")throw Error("Unexpected element: "+name);
    return {
      getContext:()=>({drawImage(...args){lastCropArgs=args;}}),
      toBlob:cb=>cb({size:9000,type:"image/webp"})
    };
  }
};
const objectURL={createObjectURL:()=> "blob:test",revokeObjectURL(){}};
const win={StudyLabAccount:account,dispatchEvent(){}};
vm.runInNewContext(actualSource,{
  window:win,document:doc,Image:MockImage,File:MockFile,URL:objectURL,
  Date,Promise,Map,WeakMap,Set,console,
  setTimeout,clearTimeout,setInterval:()=>0,
  requestAnimationFrame:cb=>queueMicrotask(cb),
  getComputedStyle:el=>({
    display:el.style.display||"block",
    visibility:el.style.visibility||"visible",
    opacity:el.style.opacity||"1"
  }),
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}}
},{timeout:2000});

win.StudyLabAvatar.decorate(node,uid);
await win.StudyLabAvatar.get(uid,true);
await new Promise(resolve=>setTimeout(resolve,15));
assert.equal(node.childNodes.length,1);
assert.equal(node.childNodes[0].tagName,"IMG","Photo must replace SVG, not overlay it");
assert.ok(tokens.has("sl-avatar-has-image"),"Avatar must enter the visible-photo state");
assert.equal(node.childNodes[0].style.opacity,"1");
assert.equal(node.dataset.slAvatarUser,uid);
assert.equal(await win.StudyLabAvatar.save(new MockFile()),true);
assert.equal(node.childNodes[0].tagName,"IMG");
assert.equal(await win.StudyLabAvatar.save(new MockFile(),{x:40,y:50,size:120}),true);
assert.deepEqual(lastCropArgs.slice(1,5),[40,50,120,120], "Saved photo must use manual square crop");
assert.equal(node.querySelector(":scope > svg"),null,"SVG must not remain on a successful photo");
await win.StudyLabAvatar.remove();
assert.equal(node.childNodes[0].tagName,"svg","Original SVG must return when photo removed");
assert.ok(!tokens.has("sl-avatar-has-image"));

const css=readFileSync("assets/css/studylab-follow.css","utf8");
assert.match(css,/\.sl-pv-backdrop \.sl-pv-avatar-toggle svg/);
assert.match(css,/color:#14629b!important/);
for(const page of ["index.html","study-room.html"]){
  const html=readFileSync(page,"utf8");
  assert.match(html,/studylab-avatar\.js\?v=20261116-manual-crop-v1/);
  assert.match(html,/studylab-follow\.css\?v=20261116-follow-colors-v2/);
}
console.log("StudyLab atomic avatar display, SVG restoration, image verification and camera styles passed.");
