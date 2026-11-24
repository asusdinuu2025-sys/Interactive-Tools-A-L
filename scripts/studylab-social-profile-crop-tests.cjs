/* Browser-free crop and Social profile regression checks. */
const assert=require("node:assert/strict"),{readFileSync}=require("node:fs"),{JSDOM}=require("jsdom");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const dom=new JSDOM('<!doctype html><html><body><div class="sl-feed-panel"><button data-feed-close></button><aside class="sl-feed-right-rail"></aside></div></body></html>',{url:"https://example.invalid/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window,d=w.document;try{
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"));};
 w.URL.createObjectURL=()=>"blob:test";w.URL.revokeObjectURL=()=>{};
 w.Image=class{constructor(){this.naturalWidth=800;this.naturalHeight=600;}set src(_){queueMicrotask(()=>this.onload());}};
 const ctx={drawImage(){},translate(){},rotate(){},scale(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 w.HTMLCanvasElement.prototype.getContext=()=>ctx;
 let encoded;w.HTMLCanvasElement.prototype.toBlob=function(cb){encoded=[this.width,this.height];cb(new w.Blob(["image"],{type:"image/webp"}));};
 w.eval(readFileSync("assets/js/studylab-social-tools.js","utf8"));
 const original=new w.File(["source"],"original.png",{type:"image/png"});
 const result=w.StudyLabSocialTools.crop(original);await wait(25);
 const view=d.querySelector(".sl-social-crop-interactive");assert.ok(view);view.getBoundingClientRect=()=>({left:0,top:0,width:view.width,height:view.height});
 const pointer=(type,x,y,id=1)=>{const ev=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(ev,{clientX:x,clientY:y,pointerId:id,pointerType:"mouse"});view.dispatchEvent(ev);};
 // Move left crop edge in by 1/4 of the original width.
 pointer("pointerdown",0,view.height/2);pointer("pointermove",view.width/4,view.height/2);pointer("pointerup",view.width/4,view.height/2);
 d.querySelector(".sl-social-modal .is-primary").click();const out=await result;assert.equal(out.type,"image/webp");assert.deepEqual(encoded,[600,600]);
 assert.equal(original.name,"original.png");
 const cancel=w.StudyLabSocialTools.crop(original);await wait(25);d.querySelector(".sl-social-modal-actions button").click();assert.equal(await cancel,null);
 let status=null,requests=0;const opened=[];
 w.StudyLabAccount={ready:Promise.resolve(),getUser:()=>({id:"student"}),getProfile:async()=>({display_name:"Test student",username:"study",bio:"Physics",gender:"female"}),client:{
  from(table){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:table==="studylab_verification_requests"&&status?{status}:null,error:null}),then(resolve){resolve({count:3,error:null});}};},
  rpc:async(name)=>{assert.equal(name,"studylab_request_verification");requests++;status="pending";return{data:status,error:null};}
 }};
 w.StudyLabFollow={stats:async()=>({followers:2,following:5})};w.StudyLabProfileView={open:async(opts)=>{opened.push(opts);return true;}};
 w.eval(readFileSync("assets/js/studylab-social-own-profile.js","utf8"));await wait(25);
 w.dispatchEvent(new w.CustomEvent("studylab:social-visibility",{detail:{open:true}}));await wait(25);
 const profile=d.querySelector(".sl-feed-right-rail .sl-social-own-profile");
 assert.match(profile.textContent,/Test student/);assert.match(profile.textContent,/@study/);assert.match(profile.textContent,/3 posts/);assert.match(profile.textContent,/2 followers/);
 const find=(host,label)=>[...host.querySelectorAll("button")].find(b=>b.textContent===label);
 find(profile,"Edit name & username").click();await wait(5);assert.equal(opened[0].editSection,"identity");
 find(profile,"Apply for verification").click();await wait(25);assert.equal(requests,1);assert.match(profile.textContent,/Application pending/);assert.equal(find(profile,"Apply for verification").disabled,true);
 d.querySelector(".sl-social-profile-shortcut").click();await wait(25);const mobile=d.querySelector(".sl-social-mobile-profile");assert.ok(mobile.open);assert.match(mobile.textContent,/Application pending/);find(mobile,"5 following").click();await wait(5);assert.equal(opened.at(-1).listType,"following");assert.equal(d.querySelector(".sl-social-mobile-profile"),null);
 console.log("PASS: direct crop edge changes output dimensions, cancel preserves original, Social profile editing and mobile verification request state.");
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
