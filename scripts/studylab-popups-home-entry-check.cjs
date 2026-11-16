/* Home-only popup delivery regression. Does not contact the real Supabase project. */
const assert = require("node:assert/strict");
const {JSDOM} = require("jsdom");
const {readFileSync} = require("fs");
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function makePage(path, gate = true) {
  const dom = new JSDOM('<!doctype html><html><body><main id="home"></main>'+
    (gate?'<div id="studylab-auth-gateway"></div>':'')+'</body></html>',{
    url:"https://studylablk.netlify.app/"+path,
    pretendToBeVisual:true,runScripts:"outside-only"
  });
  const w=dom.window;
  let resolveStartup;
  const startup=new Promise(resolve=>{resolveStartup=resolve;});
  const counters={list:0,claimed:0};
  const item={id:"11111111-1111-4111-8111-111111111111",title:"Test",
    message:"Read at home",variant:"info",placement:"top-right",
    display_seconds:8,link:"",starts_at:new Date().toISOString()};
  const client={
    auth:{getUser:async()=>({data:{user:{id:"22222222-2222-4222-8222-222222222222"}},error:null})},
    from(name) {
      assert.equal(name,"studylab_popups");
      return {select(){return this;},order(){return this;},async limit() {
        counters.list++;return {data:[item],error:null};
      }};
    },
    async rpc(name) {
      assert.equal(name,"studylab_popup_claim");
      counters.claimed++;
      return {data:true,error:null};
    }
  };
  w.StudyLabAccount={startup,ready:Promise.resolve(),client};
  w.StudyLabBanGuardReady=Promise.resolve();
  w.StudyLabBanned=false;
  w.eval(readFileSync("assets/js/studylab-popups.js","utf8"));
  return {dom,w,counters,resolveStartup};
}
(async()=>{
  const page=await makePage("index.html");
  await pause(18);
  assert.equal(page.counters.claimed,0,"Do not claim before auth startup completes");
  page.resolveStartup(false);
  await pause(28);
  assert.equal(page.counters.list,0,"Do not fetch while welcome/signup is visible");
  const gate=page.w.document.getElementById("studylab-auth-gateway");
  gate.hidden=true;
  await pause(65);
  assert.equal(page.counters.list,1);
  assert.equal(page.counters.claimed,1,"Claim once only after entering Home");
  assert.ok(page.w.document.querySelector(".slpopup-toast"),"Message appears on Home");
  page.w.document.querySelector(".slpopup-close").click();
  page.dom.window.close();

  const subpage=await makePage("study-room.html",false);
  subpage.resolveStartup(true);
  await pause(30);
  assert.equal(subpage.counters.list,0,"Never show homepage popups on another route");
  assert.equal(subpage.counters.claimed,0);
  subpage.dom.window.close();

  const signed=await makePage("index.html");
  signed.resolveStartup(true);
  const signedGate=signed.w.document.getElementById("studylab-auth-gateway");
  signedGate.hidden=true;
  await pause(65);
  assert.equal(signed.counters.claimed,1,"An authenticated Home visit can receive a message");
  signed.w.document.querySelector(".slpopup-close").click();
  signed.dom.window.close();

  console.log("PASS: Popups wait for Home entry, never claim during welcome/signup or on subpages.");
})().catch(error=>{console.error(error);process.exitCode=1;});