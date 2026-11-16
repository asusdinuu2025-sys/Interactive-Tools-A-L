/* Isolated PGlite regression for StudyLab Chat private attachments. */
const {PGlite}=require("@electric-sql/pglite");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
(async()=>{
 const db=new PGlite();
 await db.exec("\ncreate role anon;create role authenticated;create schema auth;create schema storage;create schema studylab_private;\ncreate function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;\ncreate function public.studylab_chat_can_moderate() returns boolean language sql stable as $$ select false $$;\ncreate function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;\ncreate table public.studylab_chat_messages (id uuid primary key,user_id uuid,message text not null);\ncreate table storage.buckets (id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);\ncreate table storage.objects (id uuid default gen_random_uuid(),name text,bucket_id text);\nalter table storage.objects enable row level security;\ngrant usage on schema auth,storage to authenticated;\ngrant execute on function auth.uid() to authenticated;\ngrant execute on function public.studylab_chat_can_moderate() to authenticated;\ngrant execute on function storage.foldername(text) to authenticated;\ngrant select,insert,delete on storage.objects to authenticated;");
 await db.exec(readFileSync("supabase/migrations/20261116204000_chat_image_attachments.sql","utf8"));
 const uid="11111111-1111-4111-8111-111111111111";
 const mid="22222222-2222-4222-8222-222222222222";
 const root=uid+"/"+mid+"/";
 const insert=async (id,owner,paths)=>db.query(
   "insert into studylab_chat_messages(id,user_id,message,image_paths) values($1,$2,'Chat',$3::text[])",
   [id,owner,paths]);
 await insert(mid,uid,[root+"0.webp",root+"1.webp",root+"2.webp"]);
 const row=(await db.query("select image_paths from studylab_chat_messages where id=$1",[mid])).rows[0];
 assert.equal(row.image_paths.length,3);
 await assert.rejects(insert("33333333-3333-4333-8333-333333333333",uid,[root+"3.webp"]),/check constraint/);
 await assert.rejects(insert("44444444-4444-4444-8444-444444444444",uid,[root+"0.webp"]),/check constraint/);
 await assert.rejects(insert("55555555-5555-4555-8555-555555555555",uid,["22222222-2222-4222-8222-222222222222/55555555-5555-4555-8555-555555555555/0.webp"]),/check constraint/);
 const bucket=(await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='studylab-chat-images'")).rows[0];
 assert.equal(bucket.public,false);
 assert.equal(Number(bucket.file_size_limit),1048576);
 assert.deepEqual(bucket.allowed_mime_types,["image/webp"]);
 const policies=(await db.query("select policyname,cmd from pg_policies where schemaname='storage' and tablename='objects'")).rows;
 assert.equal(policies.length,3);
 assert.ok(policies.some(p=>p.cmd==="INSERT"));
 assert.ok(policies.some(p=>p.cmd==="SELECT"));
 assert.ok(policies.some(p=>p.cmd==="DELETE"));
 await db.exec("set role authenticated;");
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 await db.query("insert into storage.objects(bucket_id,name) values('studylab-chat-images',$1)",[root+"0.webp"]);
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('studylab-chat-images','not-owner/0.webp')"),/row-level security/);
 await db.close();
 console.log("PASS: Chat private bucket, 3 owned WebP paths and Storage RLS.");
})().catch(e=>{console.error(e);process.exitCode=1});
