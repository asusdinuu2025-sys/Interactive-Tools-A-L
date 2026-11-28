"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");
const plusId="10000000-0000-4000-8000-000000000002";
const freeId="10000000-0000-4000-8000-000000000003";
const guestId="10000000-0000-4000-8000-000000000004";
const cosmetics={active:true,cover:"galaxy",frame:"#abcdef",effect:"aurora",bubble:"mint",pattern:"science",cardPattern:"books",cardGlow:"halo",chatFont:"italic",rankDailyColor:"#a78bfa",rankWeeklyColor:"#22d3ee",rankPattern:"science"};
async function check(viewer,anonymous){
 const dom=new JSDOM("<!doctype html><html><head></head><body></body></html>",{url:"https://studylablk.netlify.app/study-room.html",runScripts:"outside-only"});
 const w=dom.window,d=w.document;let reads=0;
 const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error("Shared cosmetic state was never rendered");};
 try{
  w.StudyLabAccount={ready:Promise.resolve(),getUser:()=>({id:viewer,is_anonymous:anonymous}),client:{
   rpc:async name=>{if(name==="studylab_plus_public_styles"){reads++;return {data:{[plusId]:cosmetics}};}return {error:{message:"No state mutation supported"}};},
   auth:{onAuthStateChange(){}}
  }};
  w.eval(fs.readFileSync("assets/js/studylab-plus.js","utf8"));
  const api=w.StudyLabPlus;
  assert.ok(d.querySelector('link[data-sl-plus-ranks]'));
  const card=d.createElement("article");card.className="room-person-card";
  card.innerHTML='<div class="room-avatar"></div><div class="room-person-card-name">Student</div>';
  d.body.append(card);api.decorateName(card.querySelector(".room-person-card-name"),plusId);
  await wait(()=>card.dataset.plusEffect==="aurora"&&card.querySelector(".room-avatar").dataset.plusFrame==="custom");
  assert.equal(card.querySelector(".room-avatar").dataset.plusActive,"true");
  assert.equal(card.querySelector(".room-avatar").style.getPropertyValue("--sl-plus-ring"),"#abcdef");
  assert.equal(card.dataset.plusCardGlow,"halo");assert.equal(card.dataset.plusMotifs,"books");
  assert.ok(card.querySelector(".sl-plus-inline-badge"));
  for(const [period,color] of [["daily","#a78bfa"],["weekly","#22d3ee"]]){
   const rank=d.createElement("article");rank.className="room-rank";rank.dataset.plusRankPeriod=period;
   rank.innerHTML='<div class="room-avatar"></div><div class="room-rank-info"><strong>Student</strong></div>';
   d.body.append(rank);api.decorateName(rank.querySelector("strong"),plusId);
   assert.equal(rank.dataset.plusRankColor,"custom");
   assert.equal(rank.style.getPropertyValue("--sl-plus-rank-color"),color);
   assert.equal(rank.dataset.plusMotifs,"science");
   assert.equal(rank.querySelectorAll(".sl-plus-floats svg").length,6);
   assert.equal(rank.querySelector(".room-avatar").dataset.plusActive,"true");
  }
  const msg=d.createElement("article");msg.className="study-chat-message";
  msg.innerHTML='<span class="study-chat-message-avatar"></span><span class="study-chat-message-name">Student</span><p class="study-chat-message-text">Hello</p>';
  d.body.append(msg);api.decorateName(msg.querySelector(".study-chat-message-name"),plusId);
  assert.equal(msg.dataset.plusBubble,"mint");assert.equal(msg.dataset.plusChatFont,"italic");
  assert.equal(msg.querySelector(".study-chat-message-avatar").dataset.plusFrame,"custom");
  const freeRank=d.createElement("article");freeRank.className="room-rank";freeRank.dataset.plusRankPeriod="daily";
  freeRank.innerHTML='<div class="room-avatar"></div><div class="room-rank-info"><strong>Free</strong></div>';
  d.body.append(freeRank);api.decorateName(freeRank.querySelector("strong"),freeId);
  await wait(()=>reads>=2);
  assert.equal(freeRank.dataset.plusRankColor,"default");
  assert.equal(freeRank.querySelector(".room-avatar").dataset.plusActive,"false");
  assert.equal(freeRank.querySelector(".sl-plus-inline-badge"),null);
 }finally{w.close();}
}
(async()=>{await check(freeId,false);await check(guestId,true);console.log("PASS: other students and authenticated guests see Plus chat, cards, rings and daily/weekly ranking cosmetics; Free appearance preserved.");})().catch(e=>{console.error(e);process.exitCode=1;});
