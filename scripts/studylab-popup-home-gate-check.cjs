/* Prevent one-time admin notices from being claimed while the
   homepage is still displaying the welcome / sign-in / sign-up overlay. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const src=fs.readFileSync("assets/js/studylab-popups.js","utf8");
async function visit(path, startupSucceeded, initiallyHidden) {
  const dom=new JSDOM("<!doctype html><html><body><div id='studylab-auth-gateway'></div></body></html>",{
    url:"https://studylablk.netlify.app"+path,
    runScripts:"outside-only",pretendToBeVisual:true
  });
  const w=dom.window;
  const gateway=w.document.querySelector("#studylab-auth-gateway");
  gateway.hidden=initiallyHidden;
  let signedIn=startupSucceeded, claims=0, reads=0;
  const accountId="11111111-1111-4111-8111-111111111111";
  const item={
    id:"22222222-2222-4222-8222-222222222222",
    title:"Welcome",message:"A quick notice",variant:"info",
    placement:"top-right",display_seconds:3,link:"",link_label:"View",
    starts_at:new Date().toISOString()
  };
  const client={
    auth:{getUser:async()=>({data:{user:signedIn?{id:accountId}:null},error:null})},
    from(name){
      assert.equal(name,"studylab_popups");
      return {select(){reads++;return this;},order(){return this;},limit:async()=>({
        data:[item],error:null
      })};
    },
    rpc:async(name)=>{
      assert.equal(name,"studylab_popup_claim");claims++;return{data:true,error:null};
    }
  };
  w.StudyLabAccount={
    startup:Promise.resolve(startupSucceeded),
    ready:Promise.resolve(),
    getUser:()=>signedIn?{id:accountId}:null,client
  };
  w.StudyLabBanGuardReady=Promise.resolve();
  w.StudyLabPopupFormat={render(node,s){node.textContent=s;},
    armTimer:()=>()=>{}};
  w.eval(src);
  await sleep(25);
  return {
    dom,w,gateway,
    claims:()=>claims,reads:()=>reads,
    enter(){
      signedIn=true;gateway.hidden=true;
      w.dispatchEvent(new w.Event("studylab-home-entered"));
    }
  };
}
(async()=>{
 const welcome=await visit("/",false,false);
 assert.equal(welcome.claims(),0,"Welcome screen must not claim an unread popup");
 assert.equal(welcome.reads(),0,"Welcome screen must not query popups");
 assert.equal(welcome.w.document.querySelector(".slpopup-toast"),null);
 welcome.enter();await sleep(30);
 assert.equal(welcome.claims(),1,"Claim only after entering StudyLab homepage");
 assert.ok(welcome.w.document.querySelector(".slpopup-toast"),"Display on Home");
 welcome.dom.window.close();

 const returning=await visit("/index.html",true,true);
 assert.equal(returning.claims(),1,"Returning signed-in visitors may see their notice on Home");
 returning.dom.window.close();

 const wrongPage=await visit("/study-room.html",true,true);
 assert.equal(wrongPage.claims(),0,"Study Room must not claim the Home notification");
 wrongPage.dom.window.close();
 console.log("PASS: one-time popup waits for real homepage entry; no auth overlay or subpage delivery.");
})().catch(e=>{console.error(e);process.exitCode=1});
