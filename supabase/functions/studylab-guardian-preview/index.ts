import { createClient } from "npm:@supabase/supabase-js@2.99.2";
const url=Deno.env.get("SUPABASE_URL")??"";
const key=Deno.env.get("SUPABASE_ANON_KEY")??"";
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  const allowed=/^https:\/\/(?:studylablk|deploy-preview-[0-9]+--studylablk|feature-studylab-guardian--studylablk)\.netlify\.app$/.test(origin);
  const headers={"Access-Control-Allow-Origin":allowed?origin:"https://studylablk.netlify.app","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Content-Type":"application/json","Cache-Control":"no-store"};
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!allowed)return reply({error:"Forbidden origin"},403);
  if(req.method==="OPTIONS")return reply({});
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  const auth=req.headers.get("authorization")||"";
  const token=/^Bearer\s+(.+)$/i.exec(auth)?.[1];
  if(!token||!url||!key)return reply({error:"Authentication required"},401);
  try{
    const member=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}});
    const {data,error}=await member.auth.getUser(token);
    if(error||!data.user||data.user.is_anonymous)return reply({error:"Authentication required"},401);
    if(data.user.app_metadata?.role!=="admin")return reply({error:"Admin required"},403);
    const bytes=await req.text();if(bytes.length>12000)return reply({error:"Request too large"},413);
    const input=JSON.parse(bytes);
    if(input.action!=="ai-test"||typeof input.text!=="string"||input.text.length>2000||!input.text.trim())return reply({error:"Provide synthetic test text"},400);
    const apiKey=Deno.env.get("STUDYLAB_GUARDIAN_OPENAI_KEY");
    if(!apiKey)return reply({status:"not-configured"});
    // Admin-only synthetic testing. Never fetch arbitrary URLs or student uploads.
    const response=await fetch("https://api.openai.com/v1/moderations",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:"omni-moderation-latest",input:input.text}),signal:AbortSignal.timeout(8000)});
    if(!response.ok)return reply({status:"provider-unavailable"});
    const output=await response.json(), result=output.results?.[0];
    if(typeof result?.flagged!=="boolean")return reply({status:"provider-unavailable"});
    return reply({status:"classified",flagged:result.flagged,categories:Object.keys(result.categories||{}).filter(k=>result.categories[k]===true)});
  }catch{return reply({error:"Guardian request failed"},500);}
});
