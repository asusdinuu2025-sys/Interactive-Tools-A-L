"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { JSDOM } = require("jsdom");
const { compact, progression, thresholds } = require("../assets/js/studylab-xp.js");

const migration = path.resolve(__dirname, "../supabase/migrations/20261128145000_studylab_xp.sql");
const ids = {
  ada: "10000000-0000-4000-8000-000000000001",
  bee: "10000000-0000-4000-8000-000000000002",
  guest: "10000000-0000-4000-8000-000000000003",
  newStudent: "10000000-0000-4000-8000-000000000004",
  other: "10000000-0000-4000-8000-000000000005"
};
const session = "30000000-0000-4000-8000-000000000001";
const second = "30000000-0000-4000-8000-000000000002";

async function checkDatabase() {
  const db = new PGlite();
  const one = async (sql, values) => (await db.query(sql, values)).rows[0]?.value;
  const signed = async (uid, actor = "authenticated") => {
    await db.exec("RESET ROLE");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
    await db.exec("SET ROLE " + actor);
  };
  const totals = async (...users) => one("select public.studylab_xp_totals($1::uuid[]) value", [users]);
  const rank = async (metric, period, limit = 50) => one(
    "select public.studylab_xp_leaderboard($1,$2,$3) value", [metric, period, limit]
  );
  try {
    await db.exec("create role anon; create role authenticated; create schema auth;" +
      "create table auth.users(id uuid primary key, is_anonymous boolean not null default false);" +
      "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;" +
      "grant usage on schema auth to anon,authenticated;" +
      "create table public.studylab_profiles(id uuid primary key, display_name text, gender text," +
      " profile_completed_at timestamptz default now(), deleted_at timestamptz);" +
      "create table public.study_room_members(user_id uuid primary key, session_id uuid, session_target_seconds integer);" +
      "create table public.study_room_credit_segments(id bigint generated always as identity primary key," +
      " user_id uuid not null, session_id uuid not null, local_day date not null, subject text default 'Maths'," +
      " credited_from timestamptz not null, credited_until timestamptz not null, seconds integer not null," +
      " pending boolean not null default false, created_at timestamptz default now());" +
      "create function public.studylab_social_is_admin() returns boolean language sql stable as $$ select false $$;");
    await db.exec(fs.readFileSync(path.resolve(__dirname, "../supabase/plus-preview/plus_foundation.sql"), "utf8"));
    for (const [name, uid] of Object.entries(ids)) {
      await db.query("insert into auth.users values ($1,$2)", [uid, name === "guest"]);
      if (name !== "newStudent") {
        await db.query("insert into public.studylab_profiles(id,display_name,gender) values ($1,$2,'female')", [uid, name]);
      }
    }
    await db.exec(fs.readFileSync(migration, "utf8"));
    await db.query("insert into public.studylab_profiles(id,display_name) values ($1,'New Student')", [ids.newStudent]);

    await signed(ids.ada);
    assert.deepEqual(await totals(ids.ada, ids.bee, ids.newStudent, ids.guest), {
      [ids.ada]: "100", [ids.bee]: "100", [ids.newStudent]: "100"
    });
    const ties = await rank("total", "today", 2);
    assert.equal(ties.entries.length, 2);
    assert.equal(ties.entries[0].rank, "1");
    assert.equal(ties.entries[1].rank, "1");
    assert.equal(ties.own.rank, "1");
    await assert.rejects(db.query("select * from studylab_xp.awards"), /permission denied/i);
    await assert.rejects(db.query("insert into public.studylab_plus_billing_payments (state) values ('confirmed')"), /permission denied/i);
    await assert.rejects(db.query("insert into public.study_room_credit_segments (seconds) values (360)"), /permission denied/i);
    await signed(ids.guest);
    await assert.rejects(db.query("select public.studylab_xp_tasks()"), /Registered profile required/i);
    await signed("", "anon");
    await assert.rejects(db.query("select public.studylab_xp_totals(array[]::uuid[])"), /permission denied/i);

    await db.exec("RESET ROLE");
    await db.query("update auth.users set is_anonymous=false where id=$1", [ids.guest]);
    await db.query("update public.studylab_profiles set deleted_at=now() where id=$1", [ids.guest]);
    await signed(ids.ada);
    assert.deepEqual(await totals(ids.guest), {});
    await db.exec("RESET ROLE");
    assert.equal(await one("select total::text value from studylab_xp.balances where user_id=$1", [ids.guest]), "100");

    const today = await one("select timezone('Asia/Colombo',now())::date::text value");
    const midnight = Date.parse(today + "T00:00:00+05:30");
    const dayLabel = time => new Date(time + 19800000).toISOString().slice(0, 10);
    const credit = (uid, sessionId, start, seconds, pending = false) => {
      const end = start + seconds * 1000;
      return db.query("insert into public.study_room_credit_segments(user_id,session_id,local_day,credited_from,credited_until,seconds,pending) values($1,$2,$3,$4,$5,$6,$7)",
        [uid, sessionId, dayLabel(start), new Date(start), new Date(end), seconds, pending]);
    };
    await db.query("update studylab_xp.launch set launched_at=$1", [new Date(midnight - 7200000)]);
    await credit(ids.ada, session, midnight - 18000000, 1200); // Before the XP cutover.
    await credit(ids.ada, session, midnight - 180000, 180);
    await credit(ids.ada, second, midnight, 179, true);
    await signed(ids.ada);
    assert.equal((await totals(ids.ada))[ids.ada], "100");
    await db.exec("RESET ROLE");
    await db.query("update public.study_room_credit_segments set pending=false where pending");
    await credit(ids.ada, second, midnight + 179000, 1);
    await signed(ids.ada);
    assert.equal((await totals(ids.ada))[ids.ada], "101");
    assert.equal((await rank("study","today")).own.xp, "1");

    await db.exec("RESET ROLE");
    await db.query("insert into public.study_room_members values ($1,$2,5400)", [ids.bee, session]);
    await credit(ids.bee, session, midnight, 900);
    await credit(ids.bee, session, midnight + 900000, 4500, true);
    await signed(ids.bee);
    assert.equal((await totals(ids.bee))[ids.bee], "102");
    await db.exec("RESET ROLE");
    await db.query("update public.study_room_credit_segments set pending=false where pending");
    await db.query("update public.study_room_credit_segments set pending=false where user_id=$1", [ids.bee]);
    await signed(ids.bee);
    assert.equal((await totals(ids.bee))[ids.bee], "125"); // 90 min + goal.
    await db.exec("RESET ROLE");
    await db.query("update public.study_room_members set session_id=$2, session_target_seconds=1800 where user_id=$1", [ids.bee, second]);
    await credit(ids.bee, second, midnight + 5400000, 1800);
    await credit(ids.other, session, midnight, 21600);
    await credit(ids.other, second, midnight + 21600000, 21600);
    await signed(ids.bee);
    assert.equal((await totals(ids.bee))[ids.bee], "130"); // Second goal on same day.
    assert.equal((await totals(ids.other))[ids.other], "220"); // 12 hours, no XP cap.
    await signed(ids.ada);
    const create = id => one("select public.studylab_xp_task_save($1,$2,'',null,'normal',true) value", [id, "Revise vectors " + id]);
    const complete = (id, done = true) => one("select public.studylab_xp_task_complete($1,$2) value", [id, done]);
    const imported = await one("select public.studylab_xp_task_import($1::jsonb) value", [JSON.stringify([
      {id:"old",title:"Earlier task",done:true,doneAt:"2026-01-02"}
    ])]);
    assert.equal(imported.tasks[0].done, true);
    assert.equal(imported.waiting, 0);
    assert.equal((await complete("old", false)).awarded, 0);
    assert.equal((await complete("old")).awarded, 0);
    for (const id of ["a","b","c","d"]) await create(id);
    assert.equal((await complete("a")).awarded, 4);
    assert.equal((await complete("a")).awarded, 0);
    await complete("a", false);
    assert.equal((await complete("a")).reason, "previous_completion");
    assert.equal((await complete("b")).awarded, 4);
    assert.equal((await complete("c")).awarded, 4);
    assert.equal((await complete("d")).reason, "daily_limit");
    await one("select public.studylab_xp_task_delete('b') value");
    const retryImport = await one("select public.studylab_xp_task_import($1::jsonb) value",
      [JSON.stringify([{id:"b",title:"Deleted task",done:false}])]);
    assert(!retryImport.tasks.some(task => task.id === "b"));
    assert.equal((await totals(ids.ada))[ids.ada], "113");
    await signed(ids.bee);
    assert.deepEqual(await one("select public.studylab_xp_tasks() value"), []);
    await assert.rejects(complete("a"), /Task is no longer available/i);

    await db.exec("RESET ROLE");
    for (const [index, months, minor, environment] of [
      [1,1,19900,"live"], [2,3,49900,"live"], [3,3,49900,"live"],
      [4,12,179900,"live"], [5,12,179900,"sandbox"]
    ]) {
      const order = "40000000-0000-4000-8000-" + String(index).padStart(12,"0");
      await db.query("insert into public.studylab_plus_billing_orders(id,user_id,environment,plan_months,amount_minor) values ($1,$2,$3,$4,$5)",
        [order, ids.ada, environment, months, minor]);
      const receipt = [environment,"receipt-"+index,order,minor,"confirmed"];
      for (let retry = 0; retry < 2; retry++) {
        await db.query("insert into public.studylab_plus_billing_payments(environment,provider_payment_id,order_id,amount_minor,currency,state) values($1,$2,$3,$4,'LKR',$5) on conflict(environment,provider_payment_id) do update set state=excluded.state",receipt);
      }
    }
    await signed(ids.ada);
    assert.equal((await totals(ids.ada))[ids.ada],"3109"); // 113 + 199 + 499 + 499 + 1799.
    assert.equal((await rank("total","today")).own.rank,"1");
    assert.equal((await rank("study","today")).own.xp,"13");
    assert.equal((await rank("study","week")).own.xp,"13");
    await db.exec("RESET ROLE");
    await db.exec("update public.studylab_plus_billing_payments set state='refunded' where provider_payment_id='receipt-4'");
    await db.exec("update public.studylab_plus_billing_payments set state='refunded' where provider_payment_id='receipt-4'");
    await signed(ids.ada);
    assert.equal((await totals(ids.ada))[ids.ada],"1310");
    await db.exec("RESET ROLE");
    await db.query("update studylab_xp.balances set total=44198928900233 where user_id=$1",[ids.ada]);
    await db.query("delete from public.study_room_credit_segments where user_id=$1",[ids.ada]);
    await signed(ids.ada);
    assert.equal((await rank("total","today")).own.xp,"44198928900233");
    await db.exec("RESET ROLE");
    await db.query("delete from auth.users where id=$1",[ids.ada]);
    assert.equal(await one("select count(*)::integer value from studylab_xp.awards where user_id=$1",[ids.ada]),0);
    assert.equal(await one("select count(*)::integer value from studylab_xp.tasks where user_id=$1",[ids.ada]),0);
  } finally {
    await db.close();
  }
}

async function checkUI() {
  const dom = new JSDOM(
    '<main><section id="leaderboardSection"><div class="room-tabs">Today</div><div id="leaderboardList">Study time</div></section>' +
    '<section id="peopleGrid"><article class="room-person-card" data-user-id="' + ids.bee +
    '"><div class="room-person-card-name-row"><span>දිගු ශිෂ්‍ය නම</span><span class="room-person-card-rank">#4</span></div>' +
    '<div class="room-person-card-subject">Combined Mathematics</div></article></section>' +
    '<div id="profileXp" hidden></div><section id="progress"><div class="sl-head">Progress</div></section></main>',
    {url:"https://studylablk.netlify.app/study-room.html",runScripts:"outside-only",pretendToBeVisual:true}
  );
  const w=dom.window, d=w.document;
  const waitFor = async callback => {
    for(let i=0; i<50; i++){
      if(callback()) return;
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    throw Error("Expected XP UI state did not appear");
  };
  function clickLabel(label) {
    const control = [...d.querySelectorAll("button")].find(item => item.textContent===label);
    assert(control,"Missing " + label);
    control.click();
  }
  let own = "100";
  const rpcCalls=[];
  try {
    w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
    w.HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");this.dispatchEvent(new w.Event("close"));};
    w.StudyLabAccount={
      getUser:()=>({id:ids.ada,is_anonymous:false}),
      ready:Promise.resolve(),
      client:{
        rpc:async(name,args)=>{
          rpcCalls.push({name,args});
          if(name==="studylab_xp_totals")return {data:{
            [ids.ada]:own, [ids.bee]:"44198928900233"
          }};
          if(name==="studylab_xp_leaderboard")return {data:{
            entries:[{user_id:ids.bee,name:"දිගු ශිෂ්‍ය නම",xp:"44198928900233",rank:"1"}],
            own:{xp:own,rank:"2"}
          }};
          if(name==="studylab_plus_status")return {data:{enabled:true,active:false}};
          return {data:null};
        },
        auth:{onAuthStateChange(){}}
      }
    };
    w.eval(fs.readFileSync(path.resolve(__dirname,"../assets/js/studylab-xp.js"),"utf8"));
    w.StudyLabXP.mountProgress(d.getElementById("progress"));
    await waitFor(()=>d.querySelector(".sl-xp-live-chip")?.textContent==="44.1t XP");
    const chip=d.querySelector(".sl-xp-live-chip");
    chip.click();
    const popup=d.querySelector(".sl-xp-popup");
    assert(popup && !popup.hidden);
    assert.equal(popup.querySelector(".sl-xp-full").textContent.replace(/\u00a0/g," "), "44,198,928,900,233 XP");
    assert.equal(popup.querySelectorAll("wbr").length,4);
    assert.equal(d.querySelector(".room-person-card-rank").textContent,"#4");
    d.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
    assert.equal(chip.getAttribute("aria-expanded"),"false");
    assert(popup.hidden);
    const profile=d.getElementById("profileXp");
    await w.StudyLabXP.showProfile(profile,ids.bee,()=>true);
    assert(!profile.hidden);
    assert.match(profile.textContent,/Level 20.*44,198,928,900,233/);
    clickLabel("Total XP");
    await waitFor(()=>Boolean(d.querySelector(".sl-xp-rank")));
    assert.equal(d.getElementById("leaderboardList").hidden,true);
    assert.match(d.querySelector(".sl-xp-rankings").textContent,/Includes Plus bonuses/);
    assert.match(d.querySelector(".sl-xp-rank").textContent,/44,198,928,900,233/);
    clickLabel("Study XP");
    clickLabel("This Week");
    await waitFor(()=>rpcCalls.some(r=>r.name==="studylab_xp_leaderboard" && r.args.p_metric==="study" && r.args.p_period==="week"));
    clickLabel("Study Time");
    assert.equal(d.getElementById("leaderboardList").hidden,false);
    await waitFor(()=>d.querySelector("#progress .sl-xp-level")?.textContent==="Level 1");
    own="7800";
    w.StudyLabXP.refreshOwn();
    await waitFor(()=>d.querySelector("#progress .sl-xp-celebration")?.textContent==="You reached Level 20!");
    assert.match(d.querySelector("#progress .sl-xp-caption").textContent,/Max level reached/);
    assert.equal(d.querySelectorAll(".sl-xp-celebration").length,1);

    w.eval(fs.readFileSync(path.resolve(__dirname,"../assets/js/studylab-plus.js"),"utf8"));
    await w.StudyLabPlus.open();
    const payment=d.querySelector(".sl-plus-plans .is-plus");
    assert(payment,"Missing Plus plans");
    for(const [months,price] of [[1,"199"],[3,"499"],[12,"1,799"]]){
      payment.querySelector('[data-months="' + months + '"]').click();
      assert.match(payment.querySelector(".sl-plus-price").textContent,new RegExp(price));
      assert.equal(payment.querySelector(".sl-plus-xp-note").textContent,
        "This purchase adds " + price + " XP to your total once your payment is confirmed.");
    }
  } finally {
    w.close();
  }
}

async function main() {
  assert.equal(thresholds.length,20);
  thresholds.forEach((xp,i)=>assert.equal(progression(String(xp)).level,i+1));
  assert.equal(progression("7799").level,19);
  assert.equal(progression("7800").target,null);
  assert.equal(progression("9223372036854775807").level,20);
  assert.equal(compact("999999"),"999.9k");
  assert.equal(compact("1000000"),"1m");
  assert.equal(compact("1500"),"1.5k");
  assert.equal(compact("44198928900233"),"44.1t");
  await checkDatabase();
  await checkUI();
  console.log("PASS: XP ledger, timer carry, daily goals, task privacy and limits, repeat payments and refunds, exact rankings and live XP UI.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
