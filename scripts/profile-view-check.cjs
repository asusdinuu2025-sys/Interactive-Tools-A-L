/* Read-only regression checks for View Profile and secure account deletion.
   Network operations are mocked. No actual Supabase data is touched. */
"use strict";
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");

const profile=readFileSync("assets/js/profile.js","utf8");
const viewer=readFileSync("assets/js/studylab-profile-view.js","utf8");
const css=readFileSync("assets/css/studylab-profile-view.css","utf8");
const server=readFileSync("netlify/functions/delete-account.js","utf8");
for(const file of ["index.html","study-room.html"]){
 const html=readFileSync(file,"utf8");
 assert.ok(html.includes("studylab-profile-view.js?v=20261114-glass-profile-v1"));
 assert.ok(html.includes("studylab-profile-view.css?v=20261114-glass-profile-v1"));
 assert.ok(html.indexOf("studylab-profile-view.js")<html.indexOf("assets/js/profile.js"),
   "profile viewer helper must be available before profile menu");
}
assert.ok(profile.includes('data-account-action="view"'),"View Profile not in existing account menu");
assert.ok(profile.includes("viewer.open({openEdit: () => openModal()})"),
  "Edit Profile must reuse existing editor");
assert.ok(viewer.includes("StudyLabNameMark?.decorate"),"existing four-account marks must carry over");
assert.ok(viewer.includes('"Followers","Following"'),"follower placeholders missing");
assert.ok(viewer.includes('item.addEventListener("click",()=>openList(item.dataset.listType))'),"follower lists should now open on click");
assert.ok(viewer.includes("profile.joined_at") && viewer.includes("user.created_at"),"joined date must use real user data");
assert.ok(viewer.includes('confirmInput.value==="DELETE"'),"account deletion needs typed confirmation");
assert.ok(viewer.includes("viewedUserId!==accountUser.id"),
  "visitor profile cards must never allow deleting the currently authenticated account");
assert.ok(viewer.includes('data.session.user?.id!==accountUser.id'),
  "delete request must use active user session only");
assert.ok(viewer.includes("account.getProfile(true)"),"profile should load from existing account");
assert.ok(!viewer.includes("localStorage.setItem"),"no new profile storage allowed");
assert.ok(css.includes('html[data-theme="light"]'),"light theme missing");
assert.ok(css.includes('prefers-reduced-motion:reduce'),"reduced motion missing");
assert.ok(!server.includes("deleteUser("),"no browser SDK admin exposure; delete server-side only");
assert.ok(server.includes("SUPABASE_SERVICE_ROLE_KEY"),"server must depend on private environment secret");
assert.ok(!/sb_secret_[A-Za-z0-9]+|eyJhbGciOiJIUzI1Ni/.test(server),"no hard-coded admin credentials");

function reply(status,body){
 return {ok:status>=200&&status<300,status,json:async()=>body};
}
(async()=>{
 const saved=global.fetch;
 const oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 try{
   process.env.SUPABASE_SERVICE_ROLE_KEY="test-service-role-only";
   delete require.cache[require.resolve(resolve("netlify/functions/delete-account.js"))];
   const handler=require(resolve("netlify/functions/delete-account.js")).handler;
   const validUser="11111111-1111-4111-8111-111111111111";
   const anotherUser="22222222-2222-4222-8222-222222222222";
   let calls=[];
   global.fetch=async(url,options)=>{
     calls.push({url:String(url),method:options.method,headers:options.headers,body:options.body});
     if(url.endsWith("/auth/v1/user")) return reply(200,{id:validUser,is_anonymous:false});
     if(url.endsWith("/storage/v1/object/list/studylab-social"))
       return reply(200,[]);
     if(url.includes("studylab_chat_messages"))return reply(204,null);
     if(url.endsWith("/auth/v1/admin/users/"+validUser))return reply(200,{});
     return reply(404,{});
   };
   const request=(method,authorization,confirmation,extras={})=>({
     httpMethod:method,headers:authorization?{authorization:"Bearer "+authorization}:{},
     body:JSON.stringify({confirmation,...extras})
   });
   assert.equal((await handler(request("GET","token","DELETE"))).statusCode,405);
   assert.equal((await handler(request("POST","","DELETE"))).statusCode,401);
   assert.equal((await handler(request("POST","token","nope"))).statusCode,400);
   assert.equal(calls.length,0,"refused requests must not reach Supabase");
   const success=await handler(request("POST","valid-session","DELETE",{user_id:anotherUser}));
   assert.equal(success.statusCode,200);
   assert.equal(JSON.parse(success.body).deleted,true);
   assert.ok(calls.some(x=>x.url.endsWith("/auth/v1/admin/users/"+validUser)),
     "delete should target the verified signed-in user");
   assert.ok(!calls.some(x=>x.url.endsWith("/auth/v1/admin/users/"+anotherUser)),
     "user-supplied IDs must NEVER authorize another account deletion");
   assert.ok(calls.some(x=>x.url.includes("studylab_chat_messages?user_id=eq."+validUser)),
     "user chat messages must be removed before auth deletion");
   calls=[];
   global.fetch=async(url,options)=>{
     calls.push({url:String(url),method:options.method});
     if(url.endsWith("/auth/v1/user"))return reply(401,{});
     throw new Error("No other request should run for invalid token.");
   };
   const bad=await handler(request("POST","invalid-session","DELETE"));
   assert.equal(bad.statusCode,401);
   assert.ok(!calls.some(x=>x.url.includes("/auth/v1/admin/users/")));
   console.log("StudyLab View Profile and account deletion safety tests passed.");
 }finally{
   global.fetch=saved;
   if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;
   else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
