import { createClient } from "npm:@supabase/supabase-js@2.99.2";
const url=Deno.env.get("SUPABASE_URL")||"", serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const secret=Deno.env.get("STUDYLAB_GUARDIAN_POST_WORKER_TOKEN")||"", apiKey=Deno.env.get("STUDYLAB_GUARDIAN_OPENAI_KEY")||"";
const eq=async(a:string,b:string)=>{
 const enc=new TextEncoder();
 const [x,y]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(a)),crypto.subtle.digest("SHA-256",enc.encode(b))]);
 const aa=new Uint8Array(x),bb=new Uint8Array(y);let d=0;for(let i=0;i<aa.length;i++)d|=aa[i]^bb[i];return d===0;
};
Deno.serve(async(req)=>{
 if(req.method!=="POST"||!secret||secret.length<32||!await eq(req.headers.get("x-guardian-worker")||"",secret))return new Response(null,{status:401});
 if(!url||!serviceKey||!apiKey)return new Response(null,{status:503});
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const health=async(ok:boolean)=>{const r=await db.rpc("studylab_guardian_post_health",{p_ok:ok});if(r.error)throw Error("health unavailable");};
 try{
  const result=await db.rpc("studylab_guardian_post_claim");
  if(result.error||!Array.isArray(result.data))throw Error("queue unavailable");
  const jobs=result.data as {id:string,lease:string,text:string}[];
  const inputs=jobs.length?jobs.map(j=>j.text):["Synthetic StudyLab moderation health check."];
  const response=await fetch("https://api.openai.com/v1/moderations",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:"omni-moderation-latest",input:inputs}),signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error("provider unavailable");
  const out=await response.json();
  if(!Array.isArray(out.results)||out.results.length!==inputs.length)throw Error("invalid result");
  for(let i=0;i<inputs.length;i++){
   const x=out.results[i];if(typeof x?.flagged!=="boolean"||!x.categories||typeof x.categories!=="object")throw Error("invalid result");
   if(i<jobs.length){
    const denied=x.flagged&&Object.entries(x.categories).some(([k,v])=>v===true&&!["self-harm","self-harm/intent"].includes(k));
    const r=await db.rpc("studylab_guardian_post_finish",{p_id:jobs[i].id,p_lease:jobs[i].lease,p_allowed:!denied});
    if(r.error)throw Error("completion unavailable");
   }
  }
  await health(true);
  return new Response(JSON.stringify({processed:jobs.length}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 }catch{
  try{await health(false);}catch(_){}
  return new Response(null,{status:503});
 }
});
