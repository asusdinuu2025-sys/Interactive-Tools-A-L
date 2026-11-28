const assert=require("node:assert/strict");
const fs=require("node:fs");
const {PGlite}=require("@electric-sql/pglite");
const {JSDOM}=require("jsdom");

const admin="10000000-0000-4000-8000-000000000001",member="10000000-0000-4000-8000-000000000002",free="10000000-0000-4000-8000-000000000003",guest="10000000-0000-4000-8000-000000000004";
const details={shape:"orb",eyes:"focused",glow:"neon",mouth:"smile",eyeColor:"#aabbcc",timerAccent:"default",workspace:"default",rankDailyColor:"#a78bfa",rankWeeklyColor:"#22d3ee",rankPattern:"books"};
async function sqlTest(){
 const db=new PGlite();
 try{
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,is_anonymous boolean default false); create table public.studylab_profiles(id uuid primary key,deleted_at timestamptz);");
 await db.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
 await db.exec("create function public.studylab_social_is_admin() returns boolean language sql stable as $$select auth.uid()='10000000-0000-4000-8000-000000000001'::uuid$$;");
 for(const id of [admin,member,free,guest]){await db.query("insert into auth.users(id,is_anonymous) values($1,$2)",[id,id===guest]);await db.query("insert into studylab_profiles(id) values($1)",[id]);}
 await db.exec(fs.readFileSync("supabase/plus-preview/plus_foundation.sql","utf8"));
 await db.exec(fs.readFileSync("supabase/migrations/20261128210000_studylab_plus_public_ranks.sql","utf8"));
 async function as(id,role="authenticated"){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec("set role "+role);}
 const data=async(q,args=[]) => (await db.query(q,args)).rows[0].data;
 const save=(d=details)=>data("select studylab_plus_save_appearance('galaxy','#abcdef','aurora','mint','nebula','micro',$1::jsonb,'science','books','halo','mono') as data",[JSON.stringify(d)]);
 await as(free);
 assert.equal((await data("select studylab_plus_status() as data")).active,false);
 await assert.rejects(save(),/Active Plus required/);
 await assert.rejects(db.query("select studylab_plus_admin_enable(true)"),/Admin access required/);
 await assert.rejects(db.query("select * from studylab_plus_grants"),/permission denied/);
 await as(admin);await data("select studylab_plus_admin_enable(true) as data");
 await data("select studylab_plus_admin_grant($1,30) as data",[member]);
 await assert.rejects(db.query("select studylab_plus_admin_grant($1,30)",[guest]),/Registered profile required/);
 await as(member);
 assert.equal((await data("select studylab_plus_status() as data")).active,true);
 const legacy = {
   shape: "capsule", eyes: "diamond", glow: "neon", mouth: "smile",
   eyeColor: "#aabbcc", timerAccent: "default", workspace: "default"
 };
 const legacyFirstSave = await save(legacy);
 assert.deepEqual(legacyFirstSave.details, {
   ...legacy, shape: "teardrop", eyes: "default",
   rankDailyColor: "default", rankWeeklyColor: "default", rankPattern: "default"
 });
 const saved=await save();assert.equal(saved.cover,"galaxy");assert.deepEqual(saved.details,details);
 const legacyUpdate = await save({ ...legacy, eyes: "star", mouth: "dot" });
 assert.deepEqual(legacyUpdate.details, { ...details, shape: "teardrop", eyes: "default", mouth: "dot" });
 await assert.rejects(save({...details,eyeColor:"url(unsafe)"}),/check constraint/);
 await assert.rejects(save({...details,extra:"unexpected"}),/check constraint/);
 await as(free);
 const publicStyle=await data("select studylab_plus_profile_state($1) as data",[member]);
 assert.deepEqual(publicStyle,{active:true,cover:"galaxy",frame:"#abcdef",effect:"aurora",bubble:"mint",pattern:"science",cardPattern:"books",cardGlow:"halo",chatFont:"mono",rankDailyColor:"#a78bfa",rankWeeklyColor:"#22d3ee",rankPattern:"books"});
 await assert.rejects(save(),/Active Plus required/);
 await as(guest);assert.deepEqual(await data("select studylab_plus_profile_state($1) as data",[member]),publicStyle);
 await as(admin);await data("select studylab_plus_admin_grant($1,0) as data",[member]);
 await as(member);assert.deepEqual(await data("select studylab_plus_profile_state($1) as data",[member]),{active:false});await assert.rejects(save(),/Active Plus required/);
 await as(admin);await data("select studylab_plus_admin_grant($1,30) as data",[member]);await db.exec("reset role");await db.query("update studylab_plus_grants set expires_at=now()-interval '1 second' where user_id=$1",[member]);
 await as(free);assert.deepEqual(await data("select studylab_plus_profile_state($1) as data",[member]),{active:false});
 // The billing ledger is read-only to users and never grants membership.
 await assert.rejects(db.query("select studylab_plus_admin_billing_summary('live')"),/Admin access required/);
 await assert.rejects(db.query("select * from studylab_plus_billing_orders"),/permission denied/);
 await db.exec("reset role");
 const order="10000000-0000-4000-8000-000000000010";
 await db.query("insert into studylab_plus_billing_orders(id,user_id,environment,plan_months,amount_minor) values($1,$2,'sandbox',3,49900)",[order,member]);
 await db.query("insert into studylab_plus_billing_subscriptions(order_id,environment,provider_subscription_id,state,paid_until,next_billing_at) values($1,'sandbox','test-sub','active',now()+interval '3 months',now()+interval '3 months')",[order]);
 await db.query("insert into studylab_plus_billing_payments(environment,provider_payment_id,order_id,amount_minor,currency,state) values('sandbox','test-pay',$1,49900,'LKR','confirmed')",[order]);
 await assert.rejects(db.query("insert into studylab_plus_billing_payments(environment,provider_payment_id,order_id,amount_minor,currency,state) values('sandbox','test-pay',$1,49900,'LKR','confirmed')",[order]),/duplicate key/);
 await as(admin);const sandbox=await data("select studylab_plus_admin_billing_summary('sandbox') as data"),live=await data("select studylab_plus_admin_billing_summary('live') as data");
 assert.equal(sandbox.billing_ready,false);assert.equal(sandbox.confirmed_receipts_minor,49900);assert.equal(sandbox.plans[1].paid_members,1);assert.equal(sandbox.recent_payments[0].user_id,member);assert.equal(live.confirmed_receipts_minor,0);assert.equal(live.recent_payments.length,0);
 await as(member);assert.equal((await data("select studylab_plus_status() as data")).active,false);
 console.log("PASS: isolated migration, default off, permissions, validation, public/private styles, revoke and expiry; sandbox records never grant live access.");
 }finally{await db.close();}
}
async function domTest(){
 const dom=new JSDOM("<!doctype html><html><body></body></html>",{url:"https://deploy-preview-119--studylablk.netlify.app/",runScripts:"outside-only"});
 const w=dom.window,d=w.document;
 const wait=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error("UI state not reached");};
 try{
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");this.dispatchEvent(new w.Event("close"));};
 let writes=0;
 w.StudyLabAccount={ready:Promise.resolve(),getUser:()=>({id:member,is_anonymous:false}),getProfile:async()=>({display_name:"Test student",username:"teststudent"}),client:{rpc:async(name)=>{if(name==="studylab_plus_save_appearance")writes++;return {error:{message:"not installed"}};},auth:{onAuthStateChange(){}}}};
 w.eval(fs.readFileSync("assets/js/studylab-plus.js","utf8"));
 const api=w.StudyLabPlus;
 await api.openStudio("cover");
 const studio=d.querySelector(".sl-plus-studio");
 assert.ok(studio?.open);assert.equal(studio.querySelector(".sl-plus-appearance-sample strong").textContent.includes("Test student"),true);assert.equal(studio.querySelector("[data-category=timer]"),null);assert.equal(studio.querySelector(".sl-plus-studio-layout").firstElementChild.className,"sl-plus-studio-controls");assert.equal((await api.ownAppearance()).active,false);
 studio.querySelector('[data-option-key="cover"][data-choice="galaxy"]').click();studio.querySelector('[data-option-key="pattern"][data-choice="science"]').click();assert.equal(studio.querySelector(".sl-plus-appearance-sample").dataset.plusMotifs,"science");studio.querySelector("[data-category=frame]").click();studio.querySelector('[data-option-key="frame"][data-choice="custom"]').click();assert.equal(studio.querySelector(".sl-plus-custom-palette").hidden,false);studio.querySelector(".sl-plus-custom-palette button").click();assert.equal(studio.querySelector(".sl-plus-sample-avatar").dataset.plusFrame,"custom");
 studio.querySelector("[data-category=effect]").click();studio.querySelector('[data-option-key="cardPattern"][data-choice="books"]').click();assert.equal(studio.querySelector(".sl-plus-live-sample").dataset.plusMotifs,"books");assert.equal(studio.querySelectorAll(".sl-plus-live-sample > .sl-plus-floats svg").length,6);studio.querySelector("[data-category=rank]").click();studio.querySelector('[data-option-key="details.rankDailyColor"][data-choice="#22d3ee"]').click();studio.querySelector('[data-option-key="details.rankWeeklyColor"][data-choice="#f472b6"]').click();studio.querySelector('[data-option-key="details.rankPattern"][data-choice="science"]').click();assert.equal(studio.querySelector('[data-plus-rank-period="daily"]').dataset.plusRankColor,"custom");assert.equal(studio.querySelectorAll('.sl-plus-ranking-preview > .room-rank .sl-plus-floats svg').length,12);studio.querySelector("[data-category=bubble]").click();studio.querySelector('[data-option-key="chatFont"][data-choice="italic"]').click();assert.equal(studio.querySelector(".sl-plus-chat-sample").dataset.plusChatFont,"italic");studio.querySelector("[data-category=workspace]").click();studio.querySelector('[data-option-key="details.workspace"][data-choice="aurora"]').click();assert.equal(studio.querySelector(".sl-plus-workspace-sample").dataset.plusWorkspace,"aurora");assert.equal(studio.querySelector(".sl-plus-appearance-sample").dataset.plusCover,"galaxy");
 assert.equal((await api.ownAppearance()).cover,"default");
 studio.querySelector(".sl-plus-apply").click();
 await wait(()=>d.querySelector(".sl-plus-plans")?.open);
 const plan=d.querySelector(".sl-plus-plans");
 plan.querySelector('[data-months="12"]').click();
 assert.match(plan.querySelector(".is-plus .sl-plus-price").textContent,/1,799/);
 plan.querySelector(".is-plus .sl-plus-action").click();
 await wait(()=>!d.querySelector(".sl-plus-plans"));
 assert.equal((await api.ownAppearance()).active,true);
 studio.querySelector(".sl-plus-apply").click();
 await wait(()=>!d.querySelector(".sl-plus-studio"));
 assert.equal((await api.ownAppearance()).cover,"galaxy");assert.equal((await api.ownAppearance()).pattern,"science");assert.equal((await api.ownAppearance()).cardPattern,"books");assert.equal((await api.ownAppearance()).chatFont,"italic");assert.equal((await api.ownAppearance()).details.workspace,"aurora");assert.equal((await api.ownAppearance()).details.rankDailyColor,"#22d3ee");assert.equal((await api.ownAppearance()).details.rankWeeklyColor,"#f472b6");assert.equal((await api.ownAppearance()).details.rankPattern,"science");await wait(()=>d.body.dataset.plusWorkspace==="aurora");const card=d.createElement("article");card.className="room-person-card";card.innerHTML='<div class="room-person-card-name">Student</div>';d.body.append(card);api.decorateName(card.querySelector(".room-person-card-name"),member);assert.equal(card.querySelectorAll(".sl-plus-floats svg").length,6);card.querySelector(".sl-plus-floats").remove();api.decorateName(card.querySelector(".room-person-card-name"),member);assert.equal(card.querySelectorAll(".sl-plus-floats svg").length,6);
 assert.equal(writes,0);
 await api.openStudio("pet");const pet=d.querySelector(".sl-plus-studio");pet.querySelector('[data-option-key="details.shape"][data-choice="orb"]').click();
 assert.equal(pet.querySelector(".sl-plus-pet-sample").dataset.plusShape,"orb");pet.querySelector('[data-option-key="details.eyes"][data-choice="focused"]').click();assert.equal(pet.querySelector(".sl-plus-pet-sample").dataset.plusEyes,"focused");
 pet.querySelector(".sl-plus-apply").click();await wait(()=>!d.querySelector(".sl-plus-studio"));
 assert.equal((await api.ownAppearance()).details.shape,"orb");
 await api.open();d.querySelector(".is-plus .sl-plus-action").click();assert.equal((await api.ownAppearance()).active,false);
 await api.openStudio("cover");d.querySelector(".sl-plus-apply").click();await wait(()=>d.querySelector(".sl-plus-plans")?.open);assert.ok(d.querySelector(".sl-plus-studio")?.open);d.querySelector(".sl-plus-plans .sl-plus-close").click();d.querySelector(".sl-plus-studio .sl-plus-close").click();const menu=d.createElement("div");menu.innerHTML='<button data-account-action="profile">Edit</button>';d.body.append(menu);await api.attachMenu(menu,()=>{},()=>{});assert.match(menu.querySelector(".sl-plus-menu-entry").textContent,/Try StudyLab Plus/);
 console.log("PASS: Free draft preview, gated Apply, demo activation, retained draft, pet preview/save, reset and zero database writes.");
 }finally{w.close();}
}
(async()=>{await sqlTest();await domTest();})().catch(e=>{console.error(e);process.exitCode=1;});
