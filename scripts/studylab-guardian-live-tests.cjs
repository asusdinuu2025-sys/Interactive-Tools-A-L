const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
(async()=>{
 const source=readFileSync("assets/js/studylab-guardian-check.js","utf8");
 let seen=false,calls=0;
 const {JSDOM}=require("jsdom");const dom=new JSDOM("<!doctype html><body></body>",{url:"https://example.test/"});const window=dom.window;window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 const storage={getItem:()=>seen?"yes":null,setItem:()=>{seen=true}};
 new Function("window","sessionStorage",source)(window,storage);
 const mock=(mode,status,error)=>({rpc:async()=>({data:mode}),functions:{invoke:async()=>{calls++;return {data:{status},error}}}});
 const check=window.StudyLabGuardianCheck;
 await check(mock(false,"blocked"),"chat","Synthetic");
 assert.equal(calls,0);
 const first=check(mock(true,"allowed"),"posts","Synthetic");await new Promise(r=>setTimeout(r,0));assert.equal(calls,0);const dialog=window.document.querySelector(".sl-guardian-notice");assert.ok(dialog);assert.match(dialog.textContent,/OpenAI/);dialog.querySelector(".is-primary").click();await first;
 assert.equal(calls,1);assert.equal(seen,true);
 for(const status of ["blocked","rate","unavailable"])await assert.rejects(()=>check(mock(true,status),"comments","Synthetic"));
 await assert.rejects(()=>check(mock(true,"allowed",{}),"chat","Synthetic"));
 dom.window.close();console.log("PASS: Guardian preflight, disabled mode, privacy notice, rejection and fail-closed behavior.");
})().catch(e=>{console.error(e);process.exitCode=1});
