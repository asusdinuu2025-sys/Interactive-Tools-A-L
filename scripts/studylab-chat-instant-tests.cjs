/* Sender-local outbox: exercise the actual chat implementation in a mocked browser. */
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {JSDOM}=require("jsdom");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const source=readFileSync("assets/js/chat.js","utf8");
(async()=>{
 const dom=new JSDOM("<!doctype html><html><body></body></html>",{url:"https://studylablk.netlify.app/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window,doc=w.document,uid="11111111-1111-4111-8111-111111111111";
 const writes=[],checks=[],resolvers=[],callbacks={};
 let mode="instant",time=Date.now();
 w.Date.now=()=>time;
 w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
 w.HTMLElement.prototype.scrollIntoView=function(){};
 const channel={on(event,opts,fn){callbacks[event+":"+(opts.table||opts.event)]=fn;return this;},subscribe(fn){fn("SUBSCRIBED");return this;},track:async()=>({}),presenceState:()=>({})};
 const client={rpc:async name=>({data:name==="studylab_guardian_chat_mode"?mode:false,error:null}),channel:()=>channel,from(table){
  if(table==="studylab_chat_messages")return {select(){return{order(){return this},limit:async()=>({data:[...writes].reverse(),error:null})}},insert:async row=>{writes.push({...row,created_at:new Date(time).toISOString()});return{error:null}}};
  if(table==="studylab_chat_reactions")return{select(){return{in:async()=>({data:[],error:null})}}};
  throw Error("Unexpected table "+table);
 }};
 w.StudyLabAccount={ready:Promise.resolve(),getUser:()=>({id:uid}),getProfile:async()=>({display_name:"Student"}),client};
 w.supabase={createClient:()=>client};
 w.StudyLabGuardianCheck=async(_client,surface,body)=>{assert.equal(surface,"chat");checks.push(body);return new Promise((resolve,reject)=>resolvers.push({resolve,reject}));};
 w.eval(source);
 await wait(100);
 const input=doc.querySelector("[data-chat-input]"),form=doc.querySelector("[data-chat-form]");
 const send=text=>{input.value=text;input.dispatchEvent(new w.Event("input",{bubbles:true}));form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));};
 const pending=()=>[...doc.querySelectorAll(".study-chat-local-pending")];
 const publicMessages=()=>[...doc.querySelectorAll(".study-chat-message")];
 send("First fictional study message");
 assert.equal(input.value,"","Composer clears without waiting for moderation");
 assert.equal(pending().length,1);assert.equal(writes.length,0);assert.equal(publicMessages().length,0);
 assert.equal(checks.length,1);
 time+=3000;send("Second fictional study message");
 assert.equal(input.value,"");assert.equal(pending().length,2);assert.equal(checks.length,1,"Queue is serial");
 input.value="Unsent third draft";input.dispatchEvent(new w.Event("input",{bubbles:true}));
 resolvers[0].resolve();await wait(30);
 assert.equal(writes.length,1);assert.equal(input.value,"Unsent third draft","Background completion must not erase new typing");
 assert.equal(publicMessages().length,1);assert.equal(pending().length,1);
 // First approval resets real write spacing; use a fake wall clock advance for the second dispatch.
 time+=3000;await wait(2600);
 assert.equal(checks.length,2);resolvers[1].reject(Error("Guardian: fictional test rejected"));await wait(30);
 assert.equal(writes.length,1);assert.equal(pending()[0].dataset.state,"failed");
 assert.equal(input.value,"Unsent third draft");
 assert.ok(pending()[0].textContent.includes("Guardian: fictional test rejected"));
 const revise=[...pending()[0].querySelectorAll("button")].find(b=>b.textContent==="Edit draft");
 revise.click();assert.equal(input.value,"Unsent third draft","Do not overwrite an active draft");
 input.value="";revise.click();assert.equal(input.value,"Second fictional study message");assert.equal(pending().length,0);
 // Refresh preference on reopening: strict mode must keep text in the composer.
 mode="strict";doc.querySelector(".study-chat-button").click();await wait(30);
 time+=3000;send("Strict fictional message");
 assert.equal(input.value,"Strict fictional message");assert.equal(pending().length,0);assert.equal(writes.length,1);
 resolvers[2].resolve();await wait(30);assert.equal(writes.length,2);assert.equal(input.value,"");
 dom.window.close();console.log("PASS: instant sender-only outbox, serial moderation, preserved drafts, rejected recovery and strict mode.");
})().catch(e=>{console.error(e);process.exitCode=1;});
