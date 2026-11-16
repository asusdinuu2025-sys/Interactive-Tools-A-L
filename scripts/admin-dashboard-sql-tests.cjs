const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs");
const assert = require("assert/strict");
(async () => {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;create schema auth;create schema storage;
create table auth.users(id uuid primary key,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table public.studylab_profiles(id uuid primary key,display_name text,username text,school text,bio text,created_at timestamptz default now());
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;
insert into auth.users(id,raw_app_meta_data) values('24e78cd0-4565-407a-96f7-9cfde083f6d2','{"role":"admin"}'),('7c97a8d7-f047-4c88-883d-4bed9b1a5f99','{"role":"admin"}'),('b6c80613-8217-48ac-851b-a39a3d9bef2b','{"role":"admin"}'),('11111111-1111-4111-8111-111111111111','{}');
insert into studylab_profiles(id,display_name,username) select id,'Student','student' from auth.users;
`);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261116070202_admin_dashboard.sql",
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
