/* Delete exactly one Social post, its uploaded files, and all FK-cascaded
   children (likes/comments/reports/image records/notifications).
   The request is authorized by live Supabase Auth identity, never user-supplied
   author ID. Server-side service role remains in Edge Function secrets only. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";

const url=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
const storageBucket="studylab-social";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function cors(req:Request) {
  const origin=req.headers.get("origin")||"";
  const allowed=/^https:\/\/(?:deploy-preview-[0-9]+--)?studylablk\.netlify\.app$/.test(origin)
    || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]{2,5})?$/.test(origin);
  return {
    ...(allowed?{"Access-Control-Allow-Origin":origin}:{}),
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Vary":"Origin",
    "Cache-Control":"no-store",
    "Content-Type":"application/json; charset=utf-8"
  };
}
function reply(req:Request,body:object,status=200) {
  return new Response(JSON.stringify(body),{status,headers:cors(req)});
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST")return reply(req,{deleted:false,message:"POST required."},405);
  if(!url||!serviceKey||!publicKey)
    return reply(req,{deleted:false,message:"Server configuration unavailable."},503);
  const token=String(req.headers.get("authorization")||"").match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token || token===serviceKey)return reply(req,{deleted:false,message:"Sign in required."},401);
  let postId="";
  try{postId=String((await req.json())?.post_id||"");}
  catch(_){return reply(req,{deleted:false,message:"Invalid request."},400);}
  if(!uuid.test(postId))return reply(req,{deleted:false,message:"Invalid post."},400);
  const service=createClient(url,serviceKey,{
    auth:{autoRefreshToken:false,persistSession:false}
  });
  // getUser(token) calls the Auth server; a forged user ID in the JSON body
  // is never accepted as the authorization source.
  const {data:auth,error:authError}=await service.auth.getUser(token);
  const me=auth?.user;
  if(authError||!me?.id||me.is_anonymous)
    return reply(req,{deleted:false,message:"Session expired. Sign in again."},401);
  try{
    const {data:post,error:postError}=await service.from("studylab_social_posts")
      .select("id,author_id").eq("id",postId).maybeSingle();
    if(postError)throw postError;
    if(!post)return reply(req,{deleted:false,message:"Post no longer exists."},404);
    if(post.author_id!==me.id && me.app_metadata?.role!=="admin")
      return reply(req,{deleted:false,message:"Not authorized to delete this post."},403);

    const {data:images,error:imagesError}=await service
      .from("studylab_social_post_images")
      .select("bucket_path").eq("post_id",postId);
    if(imagesError)throw imagesError;
    const paths=[...new Set((images||[])
      .map(image=>image.bucket_path).filter(path=>typeof path==="string"&&path.length))];
    // Delete storage FIRST; if this fails the post is not removed, preventing
    // DB-only deletion with orphaned images. Service role can remove any
    // student's files, including posts removed by an admin.
    for(let i=0;i<paths.length;i+=100){
      const {error}=await service.storage.from(storageBucket).remove(paths.slice(i,i+100));
      if(error)throw error;
    }
    const {data:deleted,error:deleteError}=await service
      .from("studylab_social_posts").delete().eq("id",postId).select("id").maybeSingle();
    if(deleteError)throw deleteError;
    if(!deleted)return reply(req,{deleted:false,message:"Could not delete post."},409);
    // Existing database ON DELETE CASCADE FKs remove comments, likes,
    // reports, attached image metadata and post notifications atomically.
    return reply(req,{deleted:true,removed_images:paths.length,
      message:"Post and all related data deleted."});
  }catch(error){
    console.error("StudyLab Social post deletion failed",error);
    return reply(req,{deleted:false,message:"Post deletion failed. Please retry."},500);
  }
});
