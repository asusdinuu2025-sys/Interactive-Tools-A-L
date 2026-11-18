/* PR109: Home Realtime popup delivery, deduplication and persistent display.
   Pure JSDOM: no production Supabase requests or scheduled jobs. */
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {readFileSync}=require('node:fs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const dom=new JSDOM('<!doctype html><html><body><div id="studylab-auth-gateway" hidden></div></body></html>',{
    url:'https://studylablk.netlify.app/index.html',
    pretendToBeVisual:true,runScripts:'outside-only'
  });
  const w=dom.window;
  let listed=[],claimCount=0,fetchCount=0,timerRequests=[],received=null,removed=false;
  const uid='11111111-1111-4111-8111-111111111111';
  const client={
    auth:{getUser:async()=>({data:{user:{id:uid}},error:null})},
    from(table){
      assert.equal(table,'studylab_popups');
      return {select(){return this;},order(){return this;},async limit(){
        fetchCount++;return {data:listed,error:null};
      }};
    },
    async rpc(name){
      assert.equal(name,'studylab_popup_claim');
      claimCount++;return {data:true,error:null};
    },
    channel(name){
      assert.match(name,/studylab-home-popup-notices/);
      return {
        on(event,filter,cb){
          assert.equal(event,'postgres_changes');
          assert.equal(filter.table,'studylab_popups');
          received=cb;return this;
        },
        subscribe(cb){cb('SUBSCRIBED');return this;}
      };
    },
    removeChannel(){removed=true;return Promise.resolve();}
  };
  w.StudyLabAccount={startup:Promise.resolve(true),ready:Promise.resolve(),
    getUser:()=>({id:uid}),client};
  w.StudyLabBanGuardReady=Promise.resolve();
  w.StudyLabBanned=false;
  w.StudyLabPopupFormat={
    render(node,contents){node.textContent=contents;},
    armTimer(_node,ms){timerRequests.push(ms);return ()=>{};}
  };
  w.eval(readFileSync('assets/js/studylab-popups.js','utf8'));
  await sleep(35);
  assert.equal(fetchCount>=1,true,'Home should initially request eligible popups');
  assert.equal(claimCount,0,'No popup has arrived yet');
  assert.equal(typeof received,'function','Home should subscribe to Realtime inserts');

  const first={id:'22222222-2222-4222-8222-222222222222',
    title:'Keep Open',message:'Until explicitly dismissed',
    starts_at:new Date().toISOString(),
    expires_at:new Date(Date.now()+86400000).toISOString(),
    display_seconds:0,variant:'info',placement:'top-right',link:'',link_label:'View'};
  listed=[first];received({eventType:'INSERT',new:first});
  await sleep(45);
  const shown=w.document.querySelector('.slpopup-toast');
  assert(shown,'New popups must appear to students already on Home');
  assert.equal(shown.dataset.persistent,'true','Persistent messages must mark their state');
  assert.equal(timerRequests.length,0,'Until × must never start a timer');
  await sleep(45);
  assert(shown.isConnected,'Persistent notice stays visible without auto-dismissal');
  shown.querySelector('.slpopup-close').click();
  await sleep(30);
  assert.equal(w.document.querySelector('.slpopup-toast'),null);
  const firstClaims=claimCount;
  received({eventType:'UPDATE',new:first});
  await sleep(30);
  assert.equal(claimCount,firstClaims,'Already-shown notice cannot claim again');

  const second={...first,id:'33333333-3333-4333-8333-333333333333',
    title:'One Minute',display_seconds:60};
  listed=[first,second];received({eventType:'INSERT',new:second});
  await sleep(40);
  const timed=w.document.querySelector('.slpopup-toast');
  assert(timed,'Second live message should show');
  assert.equal(timed.dataset.persistent,undefined);
  assert(timerRequests.includes(60000),'60s display should configure a 60s timer');
  timed.querySelector('.slpopup-close').click();
  w.dispatchEvent(new w.Event('pagehide'));
  await sleep(10);
  assert(removed,'Pagehide should release the Realtime channel');
  dom.window.close();
  console.log('PASS: Live Home popup events, one-time claim, until-dismissed, 60s display, and channel cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
