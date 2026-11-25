const assert=require("node:assert/strict");
const fs=require("node:fs");
const {PGlite}=require("@electric-sql/pglite");
const {JSDOM}=require("jsdom");

const admin="10000000-0000-4000-8000-000000000001",member="10000000-0000-4000-8000-000000000002",free="10000000-0000-4000-8000-000000000003",guest="10000000-0000-4000-8000-000000000004";
const details={shape:"orb",eyes:"star",glow:"neon",mouth:"smile",eyeColor:"#aabbcc",timerAccent:"default"};
async function sqlTest(){
 const db=new PGlite();
 try{
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,is_anonymous boolean default false); create table public.studylab_profiles(id uuid primary key,deleted_at timestamptz);");
 await db.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
 await db.exec("create function public.studylab_social_is_admin() returns boolean language sql stable as $$select auth.uid()='10000000-0000-4000-8000-000000000001'::uuid$$;");
 for(const id of [admin,member,free,guest]){await db.query("insert into auth.users(id,is_anonymous) values($1,$2)",[id,id===guest]);await db.query("insert into studylab_profiles(id) values($1)",[id]);}
 await db.exec(fs.readFileSync("supabase/plus-preview/plus_foundation.sql","utf8"));
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
 const saved=await save();assert.equal(saved.cover,"galaxy");assert.deepEqual(saved.details,details);
 await assert.rejects(save({...details,eyeColor:"url(unsafe)"}),/check constraint/);
 await assert.rejects(save({...details,extra:"unexpected"}),/check constraint/);
 await as(free);
 const publicStyle=await data("select studylab_plus_profile_state($1) as data",[member]);
 assert.deepEqual(publicStyle,{active:true,cover:"galaxy",frame:"#abcdef",effect:"aurora",bubble:"mint",pattern:"science",cardPattern:"books",cardGlow:"halo",chatFont:"mono"});
 await assert.rejects(save(),/Active Plus required/);
 await as(guest);assert.deepEqual(await data("select studylab_plus_profile_state($1) as data",[member]),{active:false});
 await as(admin);await data("select studylab_plus_admin_grant($1,0) as data",[member]);
 await as(member);assert.deepEqual(await data("select studylab_plus_profile_state($1) as data",[member]),{active:false});await assert.rejects(save(),/Active Plus required/);
 await as(admin);await data("select studylab_plus_admin_grant($1,30) as data",[member]);await db.exec("reset role");await db.query("update studylab_plus_grants set expires_at=now()-interval '1 second' where user_id=$1",[member]);
 await as(free);assert.deepEqual(await data("select studylab_plus_profile_state($1) as data",[member]),{active:false});
 console.log("PASS: isolated migration, default off, permissions, validation, public/private styles, revoke and expiry.");
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
 studio.querySelector("[data-category=effect]").click();studio.querySelector('[data-option-key="cardPattern"][data-choice="books"]').click();assert.equal(studio.querySelector(".sl-plus-live-sample").dataset.plusMotifs,"books");assert.equal(studio.querySelectorAll(".sl-plus-live-sample > .sl-plus-floats svg").length,6);studio.querySelector("[data-category=bubble]").click();studio.querySelector('[data-option-key="chatFont"][data-choice="italic"]').click();assert.equal(studio.querySelector(".sl-plus-chat-sample").dataset.plusChatFont,"italic");assert.equal(studio.querySelector(".sl-plus-appearance-sample").dataset.plusCover,"galaxy");
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
 assert.equal((await api.ownAppearance()).cover,"galaxy");assert.equal((await api.ownAppearance()).pattern,"science");assert.equal((await api.ownAppearance()).cardPattern,"books");assert.equal((await api.ownAppearance()).chatFont,"italic");const card=d.createElement("article");card.className="room-person-card";card.innerHTML='<div class="room-person-card-name">Student</div>';d.body.append(card);api.decorateName(card.querySelector(".room-person-card-name"),member);assert.equal(card.querySelectorAll(".sl-plus-floats svg").length,6);card.querySelector(".sl-plus-floats").remove();api.decorateName(card.querySelector(".room-person-card-name"),member);assert.equal(card.querySelectorAll(".sl-plus-floats svg").length,6);
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
