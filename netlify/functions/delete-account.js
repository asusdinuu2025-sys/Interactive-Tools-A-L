/* StudyLab account deletion, server only.
   Requires SUPABASE_SERVICE_ROLE_KEY in Netlify environment. Never put it in
   client code. This handler can only delete the user represented by a currently
   valid Supabase access token and after an explicit confirmation phrase.
   Uploaded media is removed with the Storage API, never via direct SQL. */
"use strict";
const SUPABASE_URL = process.env.SUPABASE_URL ||
  "https://zpvatyxdbshjuqgtexzw.supabase.co";
const PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB";
const PRIVATE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function reply(statusCode,message,deleted=false) {
  return {
    statusCode,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff"
    },
    body:JSON.stringify({deleted,message})
  };
}
async function request(endpoint,method,key,body,token) {
  const response=await fetch(SUPABASE_URL+endpoint,{
    method,
    headers:{
      "apikey":key,
      "Authorization":"Bearer "+(token||key),
      ...(body!==undefined?{"Content-Type":"application/json"}:{})
    },
    ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  let content;
  try{content=await response.json();}catch(_){content=null;}
  return {ok:response.ok,status:response.status,content};
}
async function removeSocialFiles(userId) {
  // StudyLab uploads use <user UUID>/<post UUID>/<file name>. The Storage
  // list API returns virtual directories with a NULL id; a flat folder list
  // therefore misses all nested post images. Traverse directories first and
  // remove actual object paths in batches using server-side Storage API.
  const objects = new Set();
  const visited = new Set();
  async function gather(directory,depth) {
    if(depth>6 || visited.size>5000 || objects.size>20000){
      throw new Error("storage_cleanup_safety_limit");
    }
    if(visited.has(directory))return;
    visited.add(directory);
    for(let offset=0;offset<5000;offset+=100){
      const result=await request("/storage/v1/object/list/studylab-social",
        "POST",PRIVATE_KEY,{
          prefix:directory,limit:100,offset,sortBy:{column:"name",order:"asc"}
        });
      if(!result.ok || !Array.isArray(result.content)){
        throw new Error("storage_list_failed");
      }
      const batch=result.content;
      for(const item of batch){
        if(!item || typeof item.name!=="string" || !item.name || item.name==="." || item.name==="..")continue;
        const child=directory+"/"+item.name;
        if(item.id || item.metadata)objects.add(child);
        else await gather(child,depth+1);
      }
      if(batch.length<100)break;
    }
  }
  await gather(userId,0);
  const paths=[...objects];
  for(let offset=0;offset<paths.length;offset+=100){
    const result=await request("/storage/v1/object/studylab-social",
      "DELETE",PRIVATE_KEY,{prefixes:paths.slice(offset,offset+100)});
    if(!result.ok)throw new Error("storage_delete_failed");
  }
}
async function checkProfileCanBePreserved(userId){
  // Do not hard-delete a user until the archive migration is present. On old
  // schemas the profile row would disappear via auth.users cascade instead.
  const result=await request("/rest/v1/studylab_profiles?select=id,deleted_at&id=eq."+
    encodeURIComponent(userId)+"&limit=1","GET",PRIVATE_KEY);
  return result.ok && Array.isArray(result.content) && result.content.length===1 &&
    Object.prototype.hasOwnProperty.call(result.content[0],"deleted_at");
}
async function removeChatMessages(userId){
  // Chat messages allow NULL on user_id when account is removed; remove their
  // identifiable messages instead of leaving anonymized records behind.
  const response=await fetch(SUPABASE_URL+
    "/rest/v1/studylab_chat_messages?user_id=eq."+encodeURIComponent(userId),{
      method:"DELETE",
      headers:{
        apikey:PRIVATE_KEY,
        Authorization:"Bearer "+PRIVATE_KEY,
        Prefer:"return=minimal"
      }
    });
  if(!response.ok)throw new Error("chat_cleanup_failed");
}
exports.handler=async function(event) {
  if(event?.httpMethod!=="POST")return reply(405,"Method not allowed.");
  if(!PRIVATE_KEY)return reply(503,
    "Account deletion is not configured yet. Your account remains unchanged.");
  const bearer=String(event.headers?.authorization||event.headers?.Authorization||"")
    .match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if(!bearer)return reply(401,"Please sign in again before deleting your account.");
  let confirmation="";
  try{confirmation=JSON.parse(event.body||"{}").confirmation;}catch(_){return reply(400,"Invalid confirmation.");}
  if(confirmation!=="DELETE")return reply(400,"Type DELETE to confirm this action.");

  // Authentication comes from Supabase itself, not user-supplied IDs or email.
  let signedIn;
  try{signedIn=await request("/auth/v1/user","GET",PUBLIC_KEY,undefined,bearer);}
  catch(_){return reply(503,"Could not verify your session. Please try again.");}
  const user=signedIn.content;
  if(!signedIn.ok||!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(String(user?.id||""))){
    return reply(401,"Your session is no longer valid. Please sign in again.");
  }
  if(user?.is_anonymous)return reply(403,"Guest sessions cannot use registered-account deletion.");
  try{
    if(!(await checkProfileCanBePreserved(user.id))){
      return reply(409,"Profile preservation is not configured. No account data was deleted.");
    }
    await removeSocialFiles(user.id);
    await removeChatMessages(user.id);
    // Auth deletion cascades study_room_credit_segments and members. The
    // personal_daily/personal_sessions views derive from those credits.
    // Auth deletion cascades all other account-linked records, while the
    // archived profile's Auth FK is intentionally removed. Its private fields
    // are anonymized by the BEFORE DELETE trigger on auth.users.
    const result=await request("/auth/v1/admin/users/"+encodeURIComponent(user.id),
      "DELETE",PRIVATE_KEY);
    if(!result.ok)throw new Error("auth_delete_failed_"+result.status);
    const retained=await request("/rest/v1/studylab_profiles?select=id,deleted_at&id=eq."+
      encodeURIComponent(user.id)+"&limit=1","GET",PRIVATE_KEY);
    if(!retained.ok || !retained.content?.[0]?.deleted_at){
      console.error("Account deleted but archived profile verification failed",user.id);
      return reply(500,"Account removal completed, but profile archival could not be verified. Contact StudyLab support.");
    }
    return reply(200,"StudyLab account deleted; anonymized profile record retained.",true);
  }catch(error){
    console.error("StudyLab account deletion failed:",error?.message||"unknown");
    return reply(500,
      "We could not finish account deletion. Please contact StudyLab support; do not assume the account was deleted.");
  }
};
