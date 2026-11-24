const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {PGlite}=require("@electric-sql/pglite");
(async()=>{
const db=new PGlite();
try{
await db.exec("create schema auth; create schema studylab_private; create role anon; create role authenticated; create table auth.users(id uuid primary key,raw_app_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $q$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $q$; create table studylab_private.guardian_settings(singleton boolean primary key,settings jsonb); insert into studylab_private.guardian_settings values(true,'{\"enabled\":true,\"chat\":true,\"posts\":true,\"comments\":true}'); create table public.studylab_chat_messages(message text); create table public.studylab_social_posts(body text); create table public.studylab_social_comments(body text);");
await db.exec(readFileSync("supabase/guardian-preview/guardian_custom_words.sql","utf8"));
await db.exec("insert into auth.users values('11111111-1111-4111-8111-111111111111','{\"role\":\"admin\"}'); select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);");
await assert.rejects(()=>db.query("select public.studylab_guardian_words()"),/Administrator access required/);
await db.exec("select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)");
const read=async()=> (await db.query("select public.studylab_guardian_words() as v")).rows[0].v;
assert.deepEqual(await read(),{enabled:false,words:[],version:0});
await db.query("select public.studylab_guardian_words(true,array['ExampleTerm','exampleterm','another phrase','පාඩම්'],0)");
assert.deepEqual((await read()).words,["exampleterm","another phrase","පාඩම්"]);
await assert.rejects(()=>db.query("select public.studylab_guardian_words(false,array[]::text[],0)"),/changed in another session/);
for(const table of ["studylab_chat_messages","studylab_social_posts","studylab_social_comments"]){
await assert.rejects(()=>db.query("insert into public."+table+" values ('EXAMPLETERM!')"),/community word filter/);
await db.query("insert into public."+table+" values ('preexampleterm')");
await assert.rejects(()=>db.query("insert into public."+table+" values ('another, phrase')"),/community word filter/);
await assert.rejects(()=>db.query("insert into public."+table+" values ('අද පාඩම්')"),/community word filter/);
}
await assert.rejects(()=>db.query("update public.studylab_chat_messages set message='exampleterm'"),/community word filter/);
await db.exec("update studylab_private.guardian_settings set settings=jsonb_set(settings,'{chat}','false')");
await db.query("insert into public.studylab_chat_messages values ('exampleterm')");
await db.exec("update studylab_private.guardian_settings set settings=jsonb_set(settings,'{enabled}','false')");
await db.query("insert into public.studylab_social_posts values ('exampleterm')");
await db.exec("update studylab_private.guardian_settings set settings=jsonb_set(settings,'{enabled}','true')");
await db.query("select public.studylab_guardian_words(false,array['exampleterm'],1)");
await db.query("insert into public.studylab_social_comments values ('exampleterm')");
assert.equal((await db.query("select has_table_privilege('authenticated','studylab_private.guardian_word_settings','select') as v")).rows[0].v,false);
assert.equal((await db.query("select has_function_privilege('anon','public.studylab_guardian_words(boolean,text[],integer)','execute') as v")).rows[0].v,false);
console.log("PASS: custom word SQL authorization, version conflicts, all three surfaces, edits, boundaries and off switches.");
}finally{await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
