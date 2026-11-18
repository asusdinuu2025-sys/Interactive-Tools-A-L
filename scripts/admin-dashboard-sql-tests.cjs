const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs");
const assert = require("assert/strict");
(async () => {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
create table auth.users(id uuid primary key,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table public.studylab_profiles(id uuid primary key,display_name text,username text,school text,bio text,created_at timestamptz default now());
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;
insert into auth.users(id,raw_app_meta_data) values('24e78cd0-4565-407a-96f7-9cfde083f6d2','{"role":"admin"}'),('7c97a8d7-f047-4c88-883d-4bed9b1a5f99','{"role":"admin"}'),('b6c80613-8217-48ac-851b-a39a3d9bef2b','{"role":"admin"}'),('11111111-1111-4111-8111-111111111111','{}');
insert into studylab_profiles(id,display_name,username) select id,'Student','student' from auth.users;
`);
  // Reproduce the actual live rollout order: existing three-admin gate,
  // read-only snapshot RPCs, then the dynamic admin-management migration.
  await db.exec(`
create table public.studylab_social_posts(id text primary key);
create table public.studylab_social_reports(id text primary key);
insert into public.studylab_social_posts values ('post-1');
insert into public.studylab_social_reports values ('report-1');
create function public.studylab_social_is_admin() returns boolean language sql stable
as $admin_gate$ select auth.uid() in (
 '24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid,
 '7c97a8d7-f047-4c88-883d-4bed9b1a5f99'::uuid,
 'b6c80613-8217-48ac-851b-a39a3d9bef2b'::uuid
) $admin_gate$;
`);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261116142631_admin_readonly_live_preview.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261116145158_admin_dashboard_live_management.sql",
      "utf8",
    ),
  );
  for (const migration of [
    "supabase/migrations/20261116155600_admin_content_delete_v2.sql",
    "supabase/migrations/20261116155627_admin_popup_messages_v2.sql",
    "supabase/migrations/20261116155631_admin_ban_ledger_v2.sql",
  ]) {
    await db.exec(fs.readFileSync(migration, "utf8"));
  }
  // New live action-label and history migrations are exercised on this
  // isolated embedded database before any production migration is applied.
  for (const migration of [
    "supabase/migrations/20261116195503_admin_action_labels_and_links.sql",
    "supabase/migrations/20261116195507_admin_reversible_activity.sql",
  ]) {
    await db.exec(fs.readFileSync(migration, "utf8"));
  }
  // Apply the PR #108 expiry upgrade only to this throwaway PGlite database.
  await db.exec(fs.readFileSync(
    "supabase/migrations/20261117175500_admin_popup_selectable_expiry.sql","utf8"));
  // PR109 schema on an isolated local database. pg_cron scheduling and
  // Supabase's Realtime publication are integration-checked on the server.
  const popupUpgrade=fs.readFileSync(
    "supabase/migrations/20261118094500_popup_live_delivery_weekly_cleanup.sql","utf8")
    .replace(/ALTER PUBLICATION supabase_realtime ADD TABLE public[.]studylab_popups;/,"")
    .replace(/SELECT cron[.]schedule\([\s\S]*?\);\s*(?=COMMIT;)/,"");
  await db.exec(popupUpgrade);
  const admin = "24e78cd0-4565-407a-96f7-9cfde083f6d2",
    student = "11111111-1111-4111-8111-111111111111";
  async function as(id, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role " + role);
  }
  await as(student);
  await assert.rejects(
    db.query("select studylab_admin_readonly_stats_v1()"),
    /Admin access required/,
  );
  await assert.rejects(
    db.query("select studylab_admin_readonly_users_v1()"),
    /Admin access required/,
  );
  await assert.rejects(
    db.query("select studylab_admin_users()"),
    /Admin access required/,
  );
  await assert.rejects(
    db.query("select * from studylab_private.admins"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("insert into studylab_verifications(user_id) values($1)", [
      student,
    ]),
    /permission denied/,
  );
  await as(admin);
  const realStats = (await db.query("select studylab_admin_readonly_stats_v1() as data")).rows[0].data;
  assert.equal(Number(realStats.profiles), 4);
  assert.equal(Number(realStats.admins), 3);
  assert.equal(Number(realStats.social_posts), 1);
  assert.equal(Number(realStats.reports), 1);
  const profiles = (await db.query("select studylab_admin_readonly_users_v1() as data")).rows[0].data;
  assert.equal(Number(profiles.total), 4);
  assert.equal(profiles.rows.length, 4);
  assert.equal(profiles.rows.filter(x => x.admin).length, 3);
  assert.ok(!JSON.stringify(profiles).includes("phone"));
  const adminAccounts = (await db.query("select studylab_admin_readonly_users_v1('',0,true) as data")).rows[0].data;
  assert.equal(Number(adminAccounts.total), 3);
  assert.equal(adminAccounts.rows.length, 3);
  assert.equal(
    (await db.query("select studylab_admin_users() as data")).rows[0].data
      .total,
    4,
  );
  const item = {
    id: "test-card",
    kind: "card",
    page: "maths.html",
    title: "Test",
    description: "",
    url: "tools/Maths/test.html",
    image: "",
    section: "",
    order: 10,
    hidden: false,
  };
  await db.query("select studylab_admin_content_save($1,$2,0,$3)", [
    item.id,
    JSON.stringify(item),
    "draft",
  ]);
  await as("", "anon");
  assert.equal(
    (await db.query("select studylab_social_is_admin() as ok")).rows[0].ok,
    false,
    "Unauthenticated social queries must remain allowed but not admin"
  );
  assert.equal(
    (await db.query("select * from studylab_site_content")).rows.length,
    0,
  );
  await assert.rejects(
    db.query("select studylab_admin_content_list()"),
    /permission denied/,
  );
  await as(admin);
  await db.query("select studylab_admin_content_save($1,$2,1,$3)", [
    item.id,
    JSON.stringify(item),
    "publish",
  ]);
  await assert.rejects(
    db.query("select studylab_admin_content_save($1,$2,1,$3)", [
      item.id,
      JSON.stringify(item),
      "publish",
    ]),
    /This item changed/,
  );
  await assert.rejects(
    db.query("select studylab_admin_content_save($1,$2,2,$3)", [
      item.id,
      JSON.stringify({ ...item, url: "javascript:alert(1)" }),
      "publish",
    ]),
    /HTTPS/,
  );
  await db.query("select studylab_admin_user_set($1,$2,true)", [
    student,
    "admin",
  ]);
  assert.equal(
    Number((await db.query("select studylab_admin_readonly_stats_v1() as data")).rows[0].data.admins), 4,
    "New admins must appear in live stats immediately"
  );
  assert.equal(
    Number((await db.query("select studylab_admin_readonly_users_v1('',0,true) as data")).rows[0].data.total), 4,
    "New admins must appear in read-only and editable lists"
  );
  await as(student);
  assert.equal(
    (await db.query("select studylab_social_is_admin() as ok")).rows[0].ok,
    true,
  );
  await as(admin);
  await db.query("select studylab_admin_user_set($1,$2,false)", [
    student,
    "admin",
  ]);
  assert.equal(
    Number((await db.query("select studylab_admin_readonly_stats_v1() as data")).rows[0].data.admins), 3,
    "Revocations must update the dynamic membership list"
  );
  await as(student);
  assert.equal(
    (await db.query("select studylab_social_is_admin() as ok")).rows[0].ok,
    false,
  );
  await as(admin);
  await assert.rejects(
    db.query("select studylab_admin_user_set($1,$2,false)", [admin, "admin"]),
    /another admin/,
  );
  await db.query("select studylab_admin_user_set($1,$2,true)", [
    student,
    "verified",
  ]);
  await as("", "anon");
  assert.equal(
    (
      await db.query("select * from studylab_verifications where user_id=$1", [
        student,
      ])
    ).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from studylab_site_content")).rows.length,
    1,
  );
  // New admin capabilities: remote deletes never leave a custom card/section
  // behind, while built-in cards use only a minimal public HTML tombstone.
  await as(admin);
  const section = {
    id:"custom-test-section",kind:"section",page:"index.html",
    title:"Extra test section",description:"",url:"",image:"",
    section:"",layout:"cards",order:100,hidden:false
  };
  const child = {...item,id:"custom-test-child",page:"index.html",
    section:section.id,title:"Child"};
  await db.query("select studylab_admin_content_save($1,$2,0,'publish')",
    [section.id,JSON.stringify(section)]);
  await db.query("select studylab_admin_content_save($1,$2,0,'publish')",
    [child.id,JSON.stringify(child)]);
  const gone = (await db.query(
    "select studylab_admin_content_delete($1,$2,$3,$4,$5) as result",
    [section.id,"index.html","section",1,false]
  )).rows[0].result;
  assert.equal(gone.deleted_children,1);
  assert.equal((await db.query(
    "select count(*)::integer as n from public.studylab_site_content where id in ($1,$2)",
    [section.id,child.id])).rows[0].n,0);
  const customDeleted=(await db.query(
    "select studylab_admin_content_delete($1,$2,$3,$4,$5) as result",
    ["test-card","maths.html","card",2,false]
  )).rows[0].result;
  assert.equal(customDeleted.deleted,true);
  await db.query("select studylab_admin_content_delete($1,$2,$3,$4,$5)",
    ["built-in-sample","index.html","card",0,true]);
  assert.equal((await db.query(
    "select payload->>'deleted' as gone from public.studylab_site_content where id='built-in-sample'"
  )).rows[0].gone,"true");
  assert.ok((await db.query("select studylab_admin_content_list() as list"))
    .rows[0].list.some(r=>r.id==="built-in-sample"&&r.deleted));
  await assert.rejects(
    db.query("select studylab_admin_content_delete($1,$2,$3,$4,$5)",
      ["home","index.html","section",0,true]),
    /Built-in sections cannot be deleted/
  );
  // Admin messages: public RLS expires at 24h and each auth identity gets
  // at most one successful atomic receipt.
  const popup=(await db.query(
    "select studylab_admin_popup_set($1,null,$2,$3,$4,$5,$6,$7,now()) as item",
    ["create","New lesson packs","Check the updated resources","important","top-right",8,""]
  )).rows[0].item;
  await as(student);
  assert.equal((await db.query(
    "select studylab_popup_claim($1) as shown",[popup.id])).rows[0].shown,true);
  assert.equal((await db.query(
    "select studylab_popup_claim($1) as shown",[popup.id])).rows[0].shown,false);
  await assert.rejects(db.query("select studylab_admin_popup_list()"),
    /Admin access required/);
  await assert.rejects(db.query("select studylab_admin_ban_preflight($1)",[admin]),
    /Admin access required/);
  await as(admin);
  assert.equal((await db.query("select studylab_admin_popup_list() as list"))
    .rows[0].list.length,1);
  await db.query("select studylab_admin_popup_set('delete',$1)",[popup.id]);
  // Private tables are intentionally inaccessible to the authenticated role.
  await db.exec("reset role");
  assert.equal((await db.query(
    "select count(*)::int as n from studylab_private.popup_receipts")).rows[0].n,0);
  await as(admin);
  // Ban policy is server-checked. This SQL never bans GoTrue directly; the
  // authenticated Edge Function is responsible for Auth ban_duration.
  await assert.rejects(db.query(
    "select studylab_admin_ban_preflight($1)",[admin]),/cannot ban your own/);
  await db.query("select studylab_admin_ban_commit($1,24,$2)",
    [student,"Repeated StudyLab rule violations"]);
  const listed=(await db.query("select studylab_admin_users() as list")).rows[0].list;
  assert.equal(listed.rows.find(x=>x.id===student).banned,true);
  await as(student);
  assert.equal((await db.query(
    "select studylab_user_ban_status() as value")).rows[0].value.banned,true);
  await as(admin);
  await db.query("select studylab_admin_ban_commit($1,0,'')",[student]);
  await as(student);
  assert.equal((await db.query(
    "select studylab_user_ban_status() as value")).rows[0].value.banned,false);

  // All new admin mutations are performed by one atomic wrapper so their
  // before/after state can be independently verified before undo.
  await as(student);
  await assert.rejects(
    db.query("select studylab_admin_action_v2('user','set',$1::jsonb)",
      [JSON.stringify({id:student,field:"verified",value:true})]),
    /Admin access required/
  );
  await assert.rejects(
    db.query("select studylab_admin_history_set('clear_all')"),
    /Admin access required/
  );
  await as(admin);
  const sampleLink = {
    id:"custom-link-test",kind:"card",page:"index.html",title:"Link card",
    description:"",url:"http://example.org/test",image:"",
    button_label:"Open link",section:"",layout:"cards",order:105,hidden:false
  };
  await db.query("select studylab_admin_action_v2('content','publish',$1::jsonb)",
    [JSON.stringify({item:sampleLink,revision:0})]);
  assert.equal((await db.query(
    "select payload->>'button_label' as label from studylab_site_content where id=$1",
    [sampleLink.id])).rows[0].label,"Open link");
  let logs = (await db.query("select studylab_admin_activity() as log")).rows[0].log;
  let targetLog = logs.find(x=>x.target==="Link card" && x.can_undo);
  assert.ok(targetLog && targetLog.id, "New publish must carry a guarded undo snapshot");
  await db.query("select studylab_admin_history_set('undo',$1)",[targetLog.id]);
  assert.equal((await db.query(
    "select count(*)::integer as n from studylab_site_content where id=$1",
    [sampleLink.id])).rows[0].n,0);
  await assert.rejects(
    db.query("select studylab_admin_history_set('undo',$1)",[targetLog.id]),
    /cannot be undone safely/
  );
  // The student was already verified earlier: removing and undoing the
  // badge tests a real state change, not a no-op grant.
  await db.query("select studylab_admin_action_v2('user','set',$1::jsonb)",
    [JSON.stringify({id:student,field:"verified",value:false})]);
  logs=(await db.query("select studylab_admin_activity() as log")).rows[0].log;
  targetLog=logs.find(x=>x.target===student && x.action==="Remove verified" && x.can_undo);
  assert.ok(targetLog, "Badge change must be reversible");
  await db.query("select studylab_admin_history_set('undo',$1)",[targetLog.id]);
  assert.equal((await db.query("select count(*)::integer as n from studylab_verifications where user_id=$1",
    [student])).rows[0].n,1);
  const popupInput={title:"Testing labels",message:"Body",variant:"info",
    placement:"top-right",display_seconds:8,link:"https://example.com",
    link_label:"Try",starts_at:new Date().toISOString()};
  const newPopup = (await db.query(
    "select studylab_admin_action_v2('popup','create',$1::jsonb) as val",
    [JSON.stringify(popupInput)])).rows[0].val;
  assert.equal(newPopup.link_label,"Try");
  logs=(await db.query("select studylab_admin_activity() as log")).rows[0].log;
  targetLog=logs.find(x=>x.action==="Publish pop-up" && x.target===newPopup.id && x.can_undo);
  assert.ok(targetLog, "New pop-up should carry an undo snapshot");
  await db.query("select studylab_admin_history_set('undo',$1)",[targetLog.id]);
  assert.equal((await db.query("select count(*)::integer as n from public.studylab_popups where id=$1",
    [newPopup.id])).rows[0].n,0);
  // Custom admin-selected expiry is enforced by BOTH read RLS and atomic
  // claim, and the existing undo/audit/history machinery still works.
  const activePeriods=["24h","7d","1m","3m","6m","9m","1y"];
  for(const period of activePeriods){
    const item={title:"Expiry "+period,message:"Hello",variant:"info",
      placement:"top-right",display_seconds:8,link:"",link_label:"View",
      starts_at:new Date().toISOString(),expiry_period:period};
    const created=(await db.query(
      "select studylab_admin_popup_action_v3('create',$1::jsonb) as val",
      [JSON.stringify(item)])).rows[0].val;
    assert.equal(created.expiry_period,period);
    assert(Date.parse(created.expires_at)>Date.parse(created.starts_at));
    if(period==="7d")assert.equal(
      Date.parse(created.expires_at)-Date.parse(created.starts_at),7*86400000);
    await as(student);
    assert.equal((await db.query(
      "select studylab_popup_claim($1) as allowed",[created.id])).rows[0].allowed,true);
    assert.equal((await db.query(
      "select studylab_popup_claim($1) as allowed",[created.id])).rows[0].allowed,false,
      "each student sees every message once regardless of its expiry length");
    await assert.rejects(db.query(
      "select studylab_admin_popup_action_v3('delete',$1::jsonb)",
      [JSON.stringify({id:created.id})]),/Admin access required/);
    await as(admin);
    if(period==="7d"){
      const updated=(await db.query(
        "select studylab_admin_popup_action_v3('update',$1::jsonb) as val",
        [JSON.stringify({...item,id:created.id,expiry_period:"3m"})])).rows[0].val;
      assert.equal(updated.expiry_period,"3m");
      await as(student);
      assert.equal((await db.query(
        "select studylab_popup_claim($1) as allowed",[created.id])).rows[0].allowed,false,
        "changing expiry never re-delivers claimed notices");
      await as(admin);
      const undoLog=(await db.query("select studylab_admin_activity() as log")).rows[0].log
        .find(x=>x.action==="Edit pop-up" && x.target===created.id && x.can_undo);
      assert.ok(undoLog, "Changing a popup expiry must be safely undo-able");
      await db.query("select studylab_admin_history_set('undo',$1)",[undoLog.id]);
      const restored=(await db.query(
        "select expiry_period from public.studylab_popups where id=$1",
        [created.id])).rows[0];
      assert.equal(restored.expiry_period,"7d","Undo restores the original expiry too");
    }
    const log=(await db.query("select studylab_admin_activity() as log")).rows[0].log
      .find(x=>x.action==="Publish pop-up" && x.target===created.id && x.can_undo);
    assert.ok(log,"v3 creates an undo-able audited popup");
    if(period==="7d"){
      // A popup remains stored for admin history, but after its expiry it is
      // invisible to student SELECT and cannot be claimed by even a new user.
      await db.exec("reset role");
      await db.query("update public.studylab_popups set starts_at=now()-interval '20 days' where id=$1",
        [created.id]);
      await as(student);
      assert.equal((await db.query("select count(*)::int as n from public.studylab_popups where id=$1",
        [created.id])).rows[0].n,0,"expired message must not be visible to students");
      await as(admin);
      assert.equal((await db.query("select studylab_popup_claim($1) as ok",[created.id])).rows[0].ok,false,
        "an expired message must not be newly claimed");
    }
    // Deleting after test avoids accumulating fixtures; admin RPC preserves
    // the same cascade that removes its per-user receipts.
    await db.query("select studylab_admin_popup_action_v3('delete',$1::jsonb)",
      [JSON.stringify({id:created.id})]);
  }
  // Both new display modes must pass the original admin-only setter and
  // enforce once-only receipt behavior. Manual delete must cascade receipts.
  for(const duration of [0,60]){
    const item={title:"Display "+duration,message:"Display test",variant:"info",
      placement:"top-right",display_seconds:duration,link:"",link_label:"View",
      starts_at:new Date().toISOString(),expiry_period:"24h"};
    await as(admin);
    const created=(await db.query(
      "select studylab_admin_popup_action_v3('create',$1::jsonb) as data",
      [JSON.stringify(item)])).rows[0].data;
    assert.equal(created.display_seconds,duration);
    await as(student);
    assert.equal((await db.query(
      "select studylab_popup_claim($1) as claimed",[created.id])).rows[0].claimed,true);
    // Administrator RPCs are authorized, but raw private receipt tables
    // deliberately deny direct access even to an authenticated admin.
    await db.exec("reset role");
    const receiptBefore=(await db.query(
      "select count(*)::integer as n from studylab_private.popup_receipts where popup_id=$1",
      [created.id])).rows[0].n;
    assert.equal(receiptBefore,1);
    await as(admin);
    await db.query("select studylab_admin_popup_action_v3('delete',$1::jsonb)",
      [JSON.stringify({id:created.id})]);
    await db.exec("reset role");
    const remaining=(await db.query(
      "select count(*)::integer as n from studylab_private.popup_receipts where popup_id=$1",
      [created.id])).rows[0].n;
    assert.equal(remaining,0,"Manual delete must physically cascade delivery receipts");
  }
  await as(admin);
  await assert.rejects(db.query(
    "select studylab_admin_popup_action_v3('create',$1::jsonb)",[JSON.stringify({
      title:"Too long",message:"No",variant:"info",placement:"top-right",
      display_seconds:61,link:"",link_label:"View",expiry_period:"24h"
    })]),/Invalid popup settings/);
  const due=(await db.query(
    "select studylab_admin_popup_action_v3('create',$1::jsonb) as data",
    [JSON.stringify({title:"Expired scheduled cleanup",message:"Clean it",
      variant:"info",placement:"top-right",display_seconds:8,
      link:"",link_label:"View",expiry_period:"24h",starts_at:new Date().toISOString()})]
  )).rows[0].data;
  await as(student);
  await db.query("select studylab_popup_claim($1)",[due.id]);
  await db.exec("reset role");
  await db.query("update public.studylab_popups set starts_at=now()-interval '3 days' where id=$1",
    [due.id]);
  const auditCount=(await db.query(
    "select count(*)::integer as n from studylab_private.activity")).rows[0].n;
  const purge=(await db.query(
    "select studylab_private.purge_expired_popups_weekly() as deleted")).rows[0].deleted;
  assert(purge>=1,"Weekly cleanup must delete expired popup rows");
  assert.equal((await db.query(
    "select count(*)::integer as n from public.studylab_popups where id=$1",[due.id])).rows[0].n,0);
  assert.equal((await db.query(
    "select count(*)::integer as n from studylab_private.popup_receipts where popup_id=$1",[due.id])).rows[0].n,0);
  assert.equal((await db.query(
    "select count(*)::integer as n from studylab_private.activity")).rows[0].n,auditCount,
    "Weekly cleanup must keep independent protected activity history");
  await as(admin);
  logs=(await db.query("select studylab_admin_activity() as log")).rows[0].log;
  await db.exec("reset role");
  const retainedBefore=(await db.query(
    "select count(*)::integer as n from studylab_private.activity")).rows[0].n;
  await as(admin);
  await db.query("select studylab_admin_history_set('clear',$1)",[logs[0].id]);
  await db.exec("reset role");
  assert.equal((await db.query(
    "select count(*)::integer as n from studylab_private.activity")).rows[0].n,
    retainedBefore, "Clearing history must not erase protected audit records");
  await as(admin);
  await db.query("select studylab_admin_history_set('clear_all')");
  assert.equal((await db.query("select studylab_admin_activity() as log")).rows[0].log.length,0);
  await db.exec("reset role");
  assert.equal((await db.query(
    "select count(*)::integer as n from studylab_private.activity")).rows[0].n,
    retainedBefore, "Clear all never changes the underlying audit history");

  await db.close();
  console.log(
    "PASS: SQL authorization, grants, private drafts, publication, guarded deletion, selectable popup expiry, 60s/persistent displays, receipt-cascading weekly purge, ban ledger, verified undo snapshots, soft history clearing, editable labels, stale writes, grant/revoke and verification.",
  );
})();
