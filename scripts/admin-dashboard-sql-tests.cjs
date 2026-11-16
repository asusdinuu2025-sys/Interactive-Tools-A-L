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
  await db.close();
  console.log(
    "PASS: SQL authorization, grants, private drafts, publication, stale writes, unsafe links, grant/revoke, self-removal and badge visibility.",
  );
})();
