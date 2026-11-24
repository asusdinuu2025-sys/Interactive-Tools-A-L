const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
(async()=>{
 const source=readFileSync("assets/js/studylab-guardian-check.js","utf8");
 let seen=false,calls=0;
 const window={confirm:()=>true};
 const storage={getItem:()=>seen?"yes":null,setItem:()=>{seen=true}};
 new Function("window","sessionStorage",source)(window,storage);
 const mock=(mode,status,error)=>({rpc:async()=>({data:mode}),functions:{invoke:async()=>{calls++;return {data:{status},error}}}});
 const check=window.StudyLabGuardianCheck;
 await check(mock(false,"blocked"),"chat","Synthetic");
 assert.equal(calls,0);
 await check(mock(true,"allowed"),"posts","Synthetic");
 assert.equal(calls,1);assert.equal(seen,true);
 for(const status of ["blocked","rate","unavailable"])await assert.rejects(()=>check(mock(true,status),"comments","Synthetic"));
 await assert.rejects(()=>check(mock(true,"allowed",{}),"chat","Synthetic"));
 console.log("PASS: Guardian preflight, disabled mode, privacy notice, rejection and fail-closed behavior.");
})().catch(e=>{console.error(e);process.exitCode=1});
