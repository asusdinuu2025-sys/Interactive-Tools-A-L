const assert=require("node:assert/strict"),{readFileSync}=require("node:fs"),{JSDOM}=require("jsdom");
const {move,orderedImages,videoURL}=require("../assets/js/studylab-social-tools.js");
const first={bucket_path:"u/p/order-01-abc.webp"},second={bucket_path:"u/p/order-02-def.webp"},old={bucket_path:"u/p/legacy.webp"};
assert.deepEqual(move([1,2,3,4],3,0),[4,1,2,3]);assert.deepEqual(move([1,2],0,-1),[1,2]);
assert.deepEqual(orderedImages([second,first]),[first,second]);assert.deepEqual(orderedImages([second,old,first]),[second,old,first]);
assert.equal(videoURL("https://youtu.be/AbCdEfGhI_1?si=example"),"https://www.youtube.com/watch?v=AbCdEfGhI_1");
for(const raw of ["javascript:alert(1)","https://youtube.com.example.invalid/watch?v=AbCdEfGhI_1","https://youtube.com@evil.invalid/watch?v=AbCdEfGhI_1","https://www.youtube.com/playlist?list=example","http://youtu.be/AbCdEfGhI_1"])assert.equal(videoURL(raw),"");
const wait=()=>new Promise(r=>setTimeout(r,35));
(async()=>{
const dom=new JSDOM('<!doctype html><html data-theme="dark"><body><header class="site-header"><div class="header-actions"></div></header><main class="container"></main></body></html>',{url:"https://example.invalid/",runScripts:"outside-only",pretendToBeVisual:true});
const w=dom.window,d=w.document;
try{
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"));};
let serial=0;w.URL.createObjectURL=()=> "blob:mock-"+(++serial);w.URL.revokeObjectURL=()=>{};
const user={id:"test-student"},events=[],uploaded=[],meta=[];
let guardianReject=false,likeReject=false,likeResolve;
const post={id:"existing-post",author_id:user.id,author_display_name:"Test student",author_username:"test",author_gender:"neutral",body:"Synthetic study post",status:"approved",created_at:"2026-01-01T00:00:00Z",studylab_social_post_images:[]};
const client={auth:{refreshSession:async()=>({data:{user},error:null}),onAuthStateChange(){}},channel(){return {on(){return this;},subscribe(){return this;}}},removeChannel:async()=>{},
rpc:async name=>{if(name==="studylab_social_publish_own_post"){events.push("publish");return {data:true,error:null};}return {data:false,error:null};},
storage:{from:()=>({upload:async(path,file)=>{events.push("upload");uploaded.push({path,name:file.name});return {error:null};},remove:async()=>({error:null})})},
from(table){return {select(){return this;},eq(){return this;},gte(){return this;},order(){return this;},in(){return this;},limit(){return this;},delete(){return this;},
insert(row){if(table==="studylab_social_posts"){events.push("insert-post");return {select(){return this;},single:async()=>({data:{id:"new-post"},error:null})};}if(table==="studylab_social_post_images"){meta.push(row);return Promise.resolve({error:null});}if(table==="studylab_social_likes")return new Promise(resolve=>{likeResolve=()=>resolve({error:likeReject?{message:"Synthetic save failed"}:null});});throw Error("Unexpected insert "+table);},
then(resolve){resolve({data:table==="studylab_social_posts"?[post]:[],error:null,count:0});}};}};
w.StudyLabAccount={ready:Promise.resolve(),client,getUser:()=>user,getProfile:async()=>({display_name:"Test student",username:"test",exam_year:2027,study_stream:"maths"})};
w.StudyLabGuardianCheck=async(_client,surface)=>{assert.equal(surface,"posts");events.push("guardian");if(guardianReject)throw Error("Synthetic Guardian rejection");};
for(const path of ["feed-drawer","studylab-social-tools","studylab-social"])w.eval(readFileSync("assets/js/"+path+".js","utf8"));
const tools=w.StudyLabSocialTools;tools.updateUnread("social",2);tools.updateUnread("follow",1);
assert.equal(d.querySelector(".sl-feed-toggle .sl-social-unread-dot").hidden,false);tools.updateUnread("social",0);assert.equal(d.querySelector(".sl-feed-toggle .sl-social-unread-dot").hidden,false);tools.updateUnread("follow",0);assert.equal(d.querySelector(".sl-feed-toggle .sl-social-unread-dot").hidden,true);
const form=d.querySelector(".sl-feed-compose"),editor=form.querySelector(".sl-feed-editor"),fileInput=form.querySelector(".sl-feed-file-input");
editor.textContent="Synthetic learning notes";
const add=files=>{Object.defineProperty(fileInput,"files",{configurable:true,value:files});fileInput.dispatchEvent(new w.Event("change",{bubbles:true}));};
add([new w.File(["1"],"one.png",{type:"image/png"}),new w.File(["2"],"two.png",{type:"image/png"})]);add([new w.File(["3"],"three.png",{type:"image/png"})]);
assert.equal(form.querySelectorAll(".sl-feed-image-preview-item").length,3);
form.querySelectorAll('[aria-label="Move photo earlier"]')[2].click();
const submit=()=>form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
submit();await wait();assert.ok(d.querySelector(".sl-social-modal[open]"));assert.equal(events.length,0);
d.querySelector(".sl-social-modal-actions button").click();await wait();assert.equal(editor.textContent,"Synthetic learning notes");assert.equal(form.querySelectorAll(".sl-feed-image-preview-item").length,3);assert.equal(events.length,0);
guardianReject=true;submit();await wait();d.querySelector(".sl-social-modal .is-primary").click();await wait();assert.deepEqual(events,["guardian"]);assert.equal(uploaded.length,0);assert.equal(form.querySelectorAll(".sl-feed-image-preview-item").length,3);
guardianReject=false;events.length=0;submit();await wait();d.querySelector(".sl-social-modal .is-primary").click();await wait();await wait();
assert.deepEqual(events,["guardian","insert-post","upload","upload","upload","publish"]);assert.deepEqual(uploaded.map(x=>x.name),["one.png","three.png","two.png"]);assert.match(uploaded[0].path,/\/order-01-/);assert.match(uploaded[1].path,/\/order-02-/);assert.equal(meta.length,3);
assert.equal(form.querySelectorAll(".sl-feed-image-preview-item").length,0);
const like=d.querySelector(".sl-feed-post-actions button[aria-pressed]");assert.ok(like);likeReject=true;like.click();assert.equal(like.getAttribute("aria-pressed"),"true");likeResolve();await wait();assert.equal(like.getAttribute("aria-pressed"),"false");likeReject=false;like.click();likeResolve();await wait();assert.equal(like.getAttribute("aria-pressed"),"true");
d.querySelector(".sl-feed-delete-post").click();await wait();assert.match(d.querySelector(".sl-social-modal").textContent,/Delete this post/);d.querySelector(".sl-social-modal-actions button").click();await wait();assert.ok(d.querySelector(".sl-feed-post"));
assert.ok(d.querySelector(".sl-feed-member-list"));assert.match(d.querySelector(".sl-feed-right-rail").textContent,/Community profiles/);assert.equal(d.querySelector(".sl-social-featured-list"),null);
console.log("PASS: Social photo ordering, preview cancel, Guardian-first publication, failed-like rollback, delete confirmation and combined unread dot.");
}finally{dom.window.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
