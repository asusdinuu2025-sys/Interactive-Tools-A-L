import { createClient } from "npm:@supabase/supabase-js@2.99.2";
const url=Deno.env.get("SUPABASE_URL")??"";
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  const allowed=/^https:\/\/(?:studylablk|deploy-preview-[0-9]+--studylablk)\.netlify\.app$/.test(origin);
  const headers={"Access-Control-Allow-Origin":allowed?origin:"https://studylablk.netlify.app","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Content-Type":"application/json","Cache-Control":"no-store"};
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!allowed)return reply({status:"unavailable"},403);
  if(req.method==="OPTIONS")return reply({});
  if(req.method!=="POST")return reply({status:"unavailable"},405);
  const token=/^Bearer\s+(.+)$/i.exec(req.headers.get("authorization")||"")?.[1];
  if(!token||!url||!key)return reply({status:"unavailable"},401);
  try{
    const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await service.auth.getUser(token);
    if(error||!data.user)return reply({status:"unavailable"},401);
    const raw=await req.text();if(raw.length>100000)return reply({status:"unavailable"},413);
    const input=JSON.parse(raw), surface=input?.surface, body=input?.text;
    const limits:Record<string,number>={chat:500,posts:15000,comments:500};
    if(!Object.hasOwn(limits,surface)||typeof body!=="string"||body.length>limits[surface])return reply({status:"unavailable"},400);
    const actor=data.user.id;
    const begin=await service.rpc("studylab_guardian_begin",{p_actor:actor,p_surface:surface});
    if(begin.error)return reply({status:"unavailable"},503);
    if(begin.data==="off")return reply({status:"off"});
    if(begin.data==="rate")return reply({status:"rate"});
    if(begin.data!=="check")return reply({status:"unavailable"},503);
    let pass=true;
    if(body.trim()){
      const apiKey=Deno.env.get("STUDYLAB_GUARDIAN_OPENAI_KEY");
      if(!apiKey)return reply({status:"unavailable"},503);
      const response=await fetch("https://api.openai.com/v1/moderations",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:"omni-moderation-latest",input:body}),signal:AbortSignal.timeout(8000)});
      if(!response.ok)return reply({status:"unavailable"},503);
      const output=await response.json(), result=output.results?.[0];
      if(typeof result?.flagged!=="boolean"||!result.categories||typeof result.categories!=="object")return reply({status:"unavailable"},503);
      // A support-seeking self-harm disclosure alone is not grounds to silence a student.
      const blocked=Object.entries(result.categories).some(([category,value])=>value===true&&!["self-harm","self-harm/intent"].includes(category));
      pass=!result.flagged||!blocked;
    }
    const complete=await service.rpc("studylab_guardian_complete",{p_actor:actor,p_surface:surface,p_body:body,p_allowed:pass});
    if(complete.error)return reply({status:"unavailable"},503);
    return reply({status:pass?"allowed":"blocked"});
  }catch{return reply({status:"unavailable"},503);}
});
