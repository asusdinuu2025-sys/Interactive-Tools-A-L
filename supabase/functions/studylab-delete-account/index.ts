/* StudyLab account removal, using Supabase's Edge service-role secret.
   Requires a fresh authenticated user JWT and exact DELETE confirmation.
   Keeps only the anonymized studylab_profiles row via the database trigger.
   Everything else remains subject to Auth/posted-content FK cascades. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";

const url=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const bucket="studylab-social";

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  const allowed=/^https:\/\/(?:deploy-preview-[0-9]+--)?studylablk\.netlify\.app$/.test(origin)
    || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]{2,5})?$/.test(origin);
  return {
    ...(allowed?{"Access-Control-Allow-Origin":origin}:{}),
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
    "Vary":"Origin",
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store"
  };
}
function reply(req:Request,body:object,status=200){
  return new Response(JSON.stringify(body),{status,headers:cors(req)});
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST")return reply(req,{deleted:false,message:"Method not allowed."},405);
  if(!url||!serviceKey)return reply(req,{deleted:false,message:"Account deletion unavailable."},503);
  const token=String(req.headers.get("authorization")||"").match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token || token===serviceKey)
    return reply(req,{deleted:false,message:"Sign in again before deleting your account."},401);
  let confirmed="";
  try{confirmed=String((await req.json())?.confirmation||"");}
  catch(_){return reply(req,{deleted:false,message:"Invalid confirmation."},400);}
  if(confirmed!=="DELETE")return reply(req,{deleted:false,message:"Type DELETE to confirm."},400);

  const service=createClient(url,serviceKey,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:auth,error:authError}=await service.auth.getUser(token);
  const me=auth?.user;
  if(authError||!me?.id || me.is_anonymous)
    return reply(req,{deleted:false,message:"Your account session is no longer valid."},401);
  const uid=me.id;
  try{
    // Stop BEFORE any removal unless the archived-profile schema is live.
    // The old FK would otherwise also delete the studylab_profiles row.
    const {data:profile,error:profileError}=await service
      .from("studylab_profiles").select("id,deleted_at").eq("id",uid).maybeSingle();
    if(profileError||!profile||profile.deleted_at)
      return reply(req,{deleted:false,
        message:"Profile preservation is not configured. No account data was deleted."},409);

    // Remove all objects under /user-id/post-id/file.ext, including files that
    // were uploaded but lost their post metadata. Empty prefix folders are
    // virtual and cannot be removed by direct SQL.
    const paths=new Set<string>();
    let scanned=0;
    async function walk(prefix:string,depth:number):Promise<void>{
      if(depth>6 || scanned>25000)throw new Error("storage_cleanup_safety_limit");
      for(let offset=0;offset<5000;offset+=100){
        const {data:items,error}=await service.storage.from(bucket)
          .list(prefix,{limit:100,offset,sortBy:{column:"name",order:"asc"}});
        if(error)throw error;
        const batch=items||[];
        scanned+=batch.length;
        for(const item of batch){
          if(!item?.name || item.name==="."||item.name==="..")continue;
          const path=prefix+"/"+item.name;
          if(item.id || item.metadata)paths.add(path);
          else await walk(path,depth+1);
        }
        if(batch.length<100)break;
        if(offset+100>=5000)throw new Error("storage_directory_too_large");
      }
    }
    await walk(uid,0);
    const files=[...paths];
    for(let i=0;i<files.length;i+=100){
      const {error}=await service.storage.from(bucket).remove(files.slice(i,i+100));
      if(error)throw error;
    }

    // An avatar is a separate public image object, not Social post media.
    // Clear it before deleting Auth, so the public URL ceases to work.
    const {error:avatarError}=await service.storage.from("studylab-avatars")
      .remove([uid+"/avatar.webp"]);
    if(avatarError)throw avatarError;

    // Chat uses ON DELETE SET NULL, so delete authored messages explicitly.
    // All other account relations are ON DELETE CASCADE: posts/comments,
    // likes, followers, reports, notifications, room credits/membership,
    // quotas and feedback. Personal history is a VIEW of room credits.
    const {error:chatError}=await service.from("studylab_chat_messages")
      .delete().eq("user_id",uid);
    if(chatError)throw chatError;

    const {error:deleteError}=await service.auth.admin.deleteUser(uid);
    if(deleteError)throw deleteError;
    const {data:archived,error:archivedError}=await service
      .from("studylab_profiles").select("id,deleted_at").eq("id",uid).maybeSingle();
    if(archivedError||!archived?.deleted_at){
      console.error("StudyLab Auth deleted, but profile archive was not verified",uid);
      return reply(req,{deleted:false,
        message:"Account removed, but profile archival could not be verified. Contact StudyLab support."},500);
    }
    return reply(req,{deleted:true,
      message:"Account and all related data deleted; anonymized profile row retained."});
  }catch(error){
    console.error("StudyLab account deletion failed",error);
    return reply(req,{deleted:false,
      message:"Could not complete account deletion. No success was recorded."},500);
  }
});
