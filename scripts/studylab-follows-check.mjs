/* StudyLab follow relationships: deterministic mock + cross-page wiring checks. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync("assets/js/studylab-follow.js","utf8");
const social=readFileSync("assets/js/studylab-social.js","utf8");
const followUi=readFileSync("assets/js/studylab-social-follow-ui.js","utf8");
const viewer=readFileSync("assets/js/studylab-profile-view.js","utf8");
const room=readFileSync("assets/js/study-room-realtime.js","utf8");
const sql=readFileSync("supabase/migrations/20261114163000_simple_student_follows_and_alerts.sql","utf8");
const css=readFileSync("assets/css/studylab-follow.css","utf8");
const home=readFileSync("index.html","utf8");
const study=readFileSync("study-room.html","utf8");
const drawer=readFileSync("assets/js/feed-drawer.js","utf8");

for(const path of ["index.html","study-room.html"]){
 const html=readFileSync(path,"utf8");
 assert.ok(html.includes("studylab-follow.js?v=20261114-follow-v1"),"Follow script missing from "+path);
 assert.ok(html.includes("studylab-follow.css?v=20261114-follow-v1"),"Follow CSS missing from "+path);
 assert.ok(html.indexOf("studylab-follow.js")<html.indexOf("studylab-profile-view.js"),
   "Follow module must load before public profile viewer");
}
assert.ok(home.includes("studylab-social-follow-ui.js?v=20261114-follow-v1"));
assert.ok(home.indexOf("feed-drawer.js")<home.indexOf("studylab-social-follow-ui.js"));
assert.ok(home.indexOf("studylab-social-follow-ui.js")<home.indexOf("studylab-social.js"));
assert.ok(!study.includes("studylab-social-follow-ui.js"),"Search and alerts belong on Social only");
assert.ok(social.includes("StudyLabFollow?.makeButton(post.author_id"),"Follow pill missing from Social posts");
assert.ok(social.includes("StudyLabProfileView?.open({userId:post.author_id})"),
  "Author must open full profile viewer, not old popover");
assert.ok(!social.includes('const popover = make("div","sl-feed-profile-popover")'),
  "Old post-owner mini popover must be replaced");
assert.ok(room.includes("StudyLabFollow?.makeButton(id,{compact:true})"),
  "Study Room follow pill missing");
assert.ok(room.includes("id !== userId"),"Don't show Follow on your own Study Room card");
assert.ok(viewer.includes('followAction.hidden=own') && viewer.includes('dialog.querySelector(".sl-pv-actions").hidden=!own'),
  "Owner Edit/Delete and visitor Follow buttons must be mutually exclusive");
assert.ok(viewer.includes("follow.list(type,id)") && viewer.includes("follow.stats(id)"),
  "Profile follower counts and lists must be backed by Supabase");
assert.ok(viewer.includes("account.getProfile(true)"),
  "Current account must continue to use the original private profile getter");
assert.ok(css.includes(".sl-pv-actions[hidden]") && css.includes(".sl-pv-follow-action[hidden]"),
  "Visitor cards must not expose hidden owner action controls");
assert.ok(drawer.includes('if (document.querySelector("#slProfileViewer:not([hidden])'),
  "Social focus trap must yield to top-level profile viewer");
assert.ok(followUi.includes("studylab_follow_alerts") && followUi.includes("studylab_public_student_lookup")===false,
  "Search should use the shared public identity service, alerts own table");
assert.ok(followUi.includes("follow.search(query)") && followUi.includes("follow.lookup(ids)"));
assert.ok(followUi.includes("14*24*60*60*1000"),"Follow alerts should expire visibly after 14 days");
assert.ok(sql.includes("alter table public.studylab_follows enable row level security"));
assert.ok(sql.includes("alter table public.studylab_follow_alerts enable row level security"));
assert.ok(sql.includes("grant update (is_read)"),"Follow alerts update must be restricted to is_read");
assert.ok(sql.includes("follower_id = (select auth.uid())"),"Follow insert/delete must be own-only");
assert.ok(sql.includes("recipient_id = (select auth.uid())"),"Follow alert reads must be recipient-only");
assert.ok(sql.includes("p.display_name, p.username, p.gender, u.created_at"),"Public identity should include only safe columns");
assert.ok(!/select\s+p\.\*/i.test(sql),"Must never expose private profile fields via directory");
assert.ok(!/grant\s+select\s+on\s+public\.studylab_profiles/i.test(sql),"Existing profile privacy must be untouched");

const own="10000000-0000-4000-8000-000000000001";
const other="20000000-0000-4000-8000-000000000002";
const pairs=new Set();
const events=[];
let lastRpc=null;
class Query {
 constructor(table){this.table=table;this.operation="get";this.fields={};this.opts={};}
 select(fields,opts={}){this.opts=opts;return this;}
 eq(key,value){this.fields[key]=value;return this;}
 in(key,values){this.fields[key]=values;return this;}
 order(){return this;}
 limit(){return this;}
 insert(value){
   assert.equal(this.table,"studylab_follows");
   assert.equal(value.follower_id,own);
   pairs.add(value.following_id);
   return Promise.resolve({error:null});
 }
 delete(){this.operation="delete";return this;}
 then(resolve,reject){
   if(this.table!=="studylab_follows")throw new Error("Unexpected table");
   if(this.operation==="delete"){
     assert.equal(this.fields.follower_id,own);
     pairs.delete(this.fields.following_id);
     return Promise.resolve({error:null}).then(resolve,reject);
   }
   let ids=[...pairs];
   if(this.fields.follower_id===own&&this.fields.following_id){
     const filter=this.fields.following_id;
     ids=ids.filter(id=>Array.isArray(filter)?filter.includes(id):id===filter);
   }
   if(this.fields.follower_id&&this.fields.follower_id!==own)ids=[];
   if(this.fields.following_id&&this.fields.follower_id===undefined)ids=[];
   return Promise.resolve({data:ids.map(following_id=>({following_id})),count:ids.length,error:null})
     .then(resolve,reject);
 }
}
const fakeClient={
 from(table){return new Query(table);},
 rpc(name,args){
   assert.equal(name,"studylab_public_student_lookup");
   lastRpc=args;
   return Promise.resolve({data:[{user_id:other,display_name:"Test Student",username:"test_student",gender:"male",joined_at:"2026-01-01T00:00:00Z"}],error:null});
 }
};
const window={
 StudyLabAccount:{
  client:fakeClient,
  ready:Promise.resolve(),
  getUser:()=>({id:own}),
 },
 dispatchEvent:evt=>events.push(evt.detail)
};
class FakeCustomEvent {
 constructor(type,options){this.type=type;this.detail=options.detail;}
}
vm.runInNewContext(source,{window,CustomEvent:FakeCustomEvent,console,Promise,Map,Set},{
 timeout:1500
});
const follow=window.StudyLabFollow;
assert.ok(follow,"Follow client service did not load");
assert.equal(await follow.isFollowing(other),false);
assert.equal(await follow.setFollowing(other,true),true);
assert.equal(pairs.has(other),true);
assert.equal(await follow.isFollowing(other),true);
assert.deepEqual(events.at(-1),{targetId:other,following:true});
assert.equal(await follow.toggle(other),false);
assert.equal(pairs.size,0);
assert.equal(await follow.isFollowing(other),false);
await assert.rejects(()=>follow.setFollowing(own,true),/Choose another student/);
const found=await follow.search("@test");
assert.equal(found[0].username,"test_student");
assert.equal(lastRpc.p_query,"test");
assert.equal(lastRpc.p_limit,20);
await follow.getProfile(other);
assert.equal(lastRpc.p_user_ids[0],other);
assert.equal(lastRpc.p_limit,40);
console.log("StudyLab follows: privacy, RLS, card integration, mock follow/unfollow and directory tests passed.");
