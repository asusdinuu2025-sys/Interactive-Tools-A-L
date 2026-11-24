/* Browser-free StudyLab Chat integration smoke test.
   Mock Supabase; never queries the live database. */
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {JSDOM}=require("jsdom");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const me="11111111-1111-4111-8111-111111111111";
 const other="22222222-2222-4222-8222-222222222222";
 const original={
   id:"33333333-3333-4333-8333-333333333333",
   message:"Hello, have you studied?",
   user_id:other,nickname:"Student B",session_id:"session-b",
   created_at:"2026-11-16T10:00:00Z",image_paths:[],reply_to:null
 };
 const dom=new JSDOM("<!doctype html><html data-theme='dark'><body><header class='site-header'></header></body></html>",{
   url:"https://studylablk.netlify.app/",runScripts:"outside-only",pretendToBeVisual:true
 });
 const w=dom.window;
 w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
 w.HTMLElement.prototype.scrollIntoView=function(){};
 const tracks=[],writes=[],uploads=[],deleted=[];
 let syncCallback;
 let remoteStates={};
 let storedMessages=[original];
 const channels=[];
 const retired=[];
 function makeChannel(){
   const channel={
     on(event,options,fn){if(event==="presence"&&options?.event==="sync")syncCallback=fn;return this;},
     subscribe(fn){this.statusCallback=fn;fn("SUBSCRIBED");return this;},
     track(item){tracks.push(item);return Promise.resolve({});},
     presenceState(){return remoteStates;}
   };
   channels.push(channel);
   return channel;
 }
 const storage={
   upload:async(path,blob)=>{uploads.push({path,blob});return{error:null};},
   remove:async(paths)=>{deleted.push(...paths);return{error:null};},
   createSignedUrl:async()=>({data:{signedUrl:"https://example.test/private.png"},error:null})
 };
 const client={
   rpc:async()=>({data:false,error:null}),
   channel:makeChannel,
   removeChannel:async(channel)=>{retired.push(channel);return "ok";},
   storage:{from:()=>storage},
   from(table){
     if(table==="studylab_chat_messages")return{
       select(){return {order(){return this;},limit:async()=>({
         data:[...storedMessages].sort((a,b)=>b.created_at.localeCompare(a.created_at)),
         error:null
       })};},
       insert:async(row)=>{writes.push(row);storedMessages.push({
         ...row,created_at:new Date().toISOString()
       });return{error:null};}
     };
     if(table==="studylab_chat_reactions")return{
       select(){return {in:async()=>({data:[],error:null})};},
       insert:async()=>({error:null}),delete(){return{eq(){return this;},then(res){res({error:null});}};}
     };
     throw Error("Unexpected table "+table);
   }
 };
 w.StudyLabAccount={
   ready:Promise.resolve(),
   getUser:()=>({id:me}),
   getProfile:async()=>({display_name:"Student A"}),
   client
 };
 w.StudyLabFollow={lookup:async()=>[]};
 w.supabase={createClient:()=>client};
 w.URL.createObjectURL=()=> "blob:study-preview";
 w.URL.revokeObjectURL=()=>{};
 w.createImageBitmap=async()=>({width:640,height:480,close(){}});
 w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
 w.HTMLCanvasElement.prototype.toBlob=function(callback){
   callback(new w.Blob(["compressed"],{type:"image/webp"}));
 };
 w.eval(readFileSync("assets/js/studylab-guardian-check.js","utf8"));
 w.eval(readFileSync("assets/js/chat.js","utf8"));
 await wait(70);
 const panel=w.document.querySelector(".study-chat-panel");
 const toggle=w.document.querySelector(".study-chat-button");
 assert.ok(panel&&toggle,"Chat panel initializes");
 const bubble=w.document.querySelector(".study-chat-message");
 assert.ok(bubble,"Existing messages remain visible");
 const react=bubble.querySelector(".study-chat-react-toggle");
 react.click();
 assert.ok(bubble.classList.contains("is-reactions-open"));
 bubble.querySelector(".study-chat-reactions .study-chat-reaction").click();
 assert.equal(bubble.classList.contains("is-reactions-open"),false,
   "Choosing a reaction must close the picker");
 toggle.click();
 const input=w.document.querySelector("[data-chat-input]");
 input.value="I am typing";
 input.dispatchEvent(new w.Event("input",{bubbles:true}));
 await wait(35);
 assert.ok(tracks.some(x=>x.typing===true),"Typing state must be sent through Presence");
 remoteStates={remote:[{id:other,typing:true,nickname:"Student B",updatedAt:Date.now()}]};
 syncCallback();
 assert.equal(w.document.querySelector("[data-chat-typing]").hidden,false);
 const editorLine=w.document.querySelector(".study-chat-editorline");
 const toggleAttach=editorLine?.querySelector(":scope > [data-chat-attachments-toggle]");
 const choices=editorLine?.querySelector("[data-chat-attachment-menu]");
 assert.ok(toggleAttach,"Exactly one paperclip is exposed directly in the composer");
 assert.ok(choices,"Image and file actions belong inside the dropdown");
 assert.equal(choices.hidden,true,"Attachment dropdown starts closed");
 assert.equal(editorLine.querySelector(":scope > [data-chat-attach]"),null,
   "Image action must not occupy its own composer button");
 assert.equal(editorLine.querySelector(":scope > [data-chat-file-attach]"),null,
   "File action must not occupy its own composer button");
 toggleAttach.click();
 await wait(25);
 assert.equal(choices.hidden,false,"Paperclip opens attachment menu");
 assert.equal(choices.querySelectorAll("button").length,2);
 assert.equal(toggleAttach.getAttribute("aria-expanded"),"true");
 toggleAttach.click();
 await wait(205);
 assert.equal(choices.hidden,true,"Attachment menu closes smoothly");
 const fileInput=w.document.querySelector("[data-chat-image-input]");
 Object.defineProperty(fileInput,"files",{
   configurable:true,
   value:[new w.File(["picture"],"work.png",{type:"image/png"})]
 });
 fileInput.dispatchEvent(new w.Event("change",{bubbles:true}));
 await wait(65);
 assert.equal(w.document.querySelectorAll(".study-chat-pending-tile").length,1);
 input.value="";
 input.dispatchEvent(new w.Event("input",{bubbles:true}));
 assert.equal(w.document.querySelector("[data-chat-send]").disabled,false,
   "Image-only messages should be sendable");
 w.document.querySelector("[data-chat-form]").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 await wait(65);
 assert.equal(writes.length,1,"One image-only message should be persisted");
 assert.equal(writes[0].message,"📷 Photo");
 assert.equal(writes[0].image_paths.length,1);
 assert.ok(writes[0].image_paths[0].startsWith(me+"/"));
 assert.equal(uploads.length,1);
 assert.equal(uploads[0].blob.type,"image/webp");
 assert.ok(uploads[0].blob.size<=1048576);
 assert.equal(w.document.querySelectorAll(".study-chat-pending-tile").length,0);
 // Document uploads are independently validated and stored in a private bucket.
 const originalNow=w.Date.now;
 w.Date.now=()=>originalNow()+5000; // Beyond the rate-limit window.
 const docButton=w.document.querySelector("[data-chat-file-attach]");
 assert.ok(docButton,"Paperclip must appear beside image button");
 assert.equal(docButton.disabled,false,"Document uploads enabled after schema probe");
 const docsInput=w.document.querySelector("[data-chat-file-input]");
 Object.defineProperty(docsInput,"files",{
   configurable:true,
   value:[new w.File(["%PDF-1.6 Study notes"],"Mechanics.pdf",{type:"application/pdf"})]
 });
 docsInput.dispatchEvent(new w.Event("change",{bubbles:true}));
 await wait(70);
 assert.equal(w.document.querySelectorAll(".study-chat-pending-document").length,1);
 assert.equal(w.document.querySelector("[data-chat-send]").disabled,false);
 w.document.querySelector("[data-chat-form]").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
 await wait(85);
 assert.equal(writes.length,2,"Document-only message should persist");
 assert.equal(writes[1].message,"📎 File");
 assert.equal(writes[1].file_attachments.length,1);
 assert.ok(writes[1].file_attachments[0].path.endsWith("/0.pdf"));
 assert.equal(writes[1].file_attachments[0].name,"Mechanics.pdf");
 assert.equal(uploads.length,2);
 assert.equal(w.document.querySelectorAll(".study-chat-pending-document").length,0);
 assert.ok(w.document.querySelector(".study-chat-document-copy strong"));
 toggle.click();
 assert.ok(tracks.some(x=>x.typing===false));
 // Simulate a dropped WebSocket and two failure callbacks for the same channel.
 // Missed INSERT and DELETE are repaired by a REST catch-up after reconnect.
 const firstChannel=channels[0];
 firstChannel.statusCallback("CHANNEL_ERROR",{message:"simulated temporary outage"});
 firstChannel.statusCallback("TIMED_OUT");
 assert.match(w.document.querySelector("[data-chat-status]").textContent,/Reconnecting/);
 const missed={
   id:"44444444-4444-4444-8444-444444444444",
   message:"Message during outage",user_id:other,nickname:"Student B",
   session_id:"session-b",created_at:new Date(Date.now()+1500).toISOString(),
   image_paths:[],reply_to:null
 };
 storedMessages=storedMessages.filter(row=>row.id!==original.id);
 storedMessages.push(missed);
 await wait(2150); // Backoff is 1500-1850 ms, with a safety margin.
 assert.equal(channels.length,2,"At most one replacement channel after repeated errors");
 assert.equal(retired.length,1,"Old channel must be removed before replacing it");
 assert.match(w.document.querySelector("[data-chat-status]").textContent,/Live • newest 100 messages/);
 assert.equal(w.document.querySelector('[data-message-id="'+original.id+'"]'),null,
   "A delete missed while offline must be reconciled");
 assert.ok(w.document.querySelector('[data-message-id="'+missed.id+'"]'),
   "An insert missed while offline must be reconciled");
 assert.ok(w.document.querySelector('[data-message-id="'+writes[0].id+'"]'),
   "Locally sent messages already in the database must be retained");
 firstChannel.statusCallback("CLOSED");
 assert.match(w.document.querySelector("[data-chat-status]").textContent,/Live • newest 100 messages/,
   "Late callbacks from a retired channel must not re-disable live status");
 dom.window.close();

 // Before the additive migration is applied, text Chat must remain usable.
 // Only the paperclip should be disabled: never break existing messages.
 const oldDom=new JSDOM("<!doctype html><html><body></body></html>",{
   url:"https://studylablk.netlify.app/index.html",
   runScripts:"outside-only",pretendToBeVisual:true
 });
 const old=oldDom.window;
 old.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
 const legacyWrites=[];
 const legacyChannel={
   on(){return this;},subscribe(fn){fn("SUBSCRIBED");return this;},
   track:async()=>({}),presenceState:()=>({})
 };
 const legacyClient={
   rpc:async()=>({data:false,error:null}),
   channel:()=>legacyChannel,
   from(table){
     if(table==="studylab_chat_messages")return{
       select(columns){
         return {
           order(){return this;},
           limit:async()=>columns==="file_attachments"
             ?{data:null,error:{code:"42703",message:"column missing"}}
             :{data:[],error:null}
         };
       },
       insert:async(row)=>{legacyWrites.push(row);return{error:null};}
     };
     if(table==="studylab_chat_reactions")return{
       select(){return{in:async()=>({data:[],error:null})};}
     };
     throw Error("Unexpected table "+table);
   }
 };
 old.StudyLabAccount={
   ready:Promise.resolve(),getUser:()=>({id:me}),
   getProfile:async()=>({display_name:"Student A"}),client:legacyClient
 };
 old.supabase={createClient:()=>legacyClient};
 old.eval(readFileSync("assets/js/studylab-guardian-check.js","utf8"));
 old.eval(readFileSync("assets/js/chat.js","utf8"));
 await wait(90);
 assert.equal(old.document.querySelector("[data-chat-file-attach]").disabled,true,
   "Paperclip stays disabled until the document migration exists");
 const legacyInput=old.document.querySelector("[data-chat-input]");
 legacyInput.value="Text still works";
 legacyInput.dispatchEvent(new old.Event("input",{bubbles:true}));
 old.document.querySelector("[data-chat-form]").dispatchEvent(
   new old.Event("submit",{bubbles:true,cancelable:true}));
 await wait(80);
 assert.equal(legacyWrites.length,1,"Text send must succeed without file metadata column");
 assert.equal(Object.hasOwn(legacyWrites[0],"file_attachments"),false);
 oldDom.window.close();

 console.log("PASS: Chat reactions, images, PDF uploads, recovery and safe pre-migration fallback.");
})().catch(e=>{console.error(e);process.exitCode=1});
