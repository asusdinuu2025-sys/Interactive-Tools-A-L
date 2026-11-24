/* Own profile summary, reusing existing profile editor, avatar and follower APIs. */
(function(){
"use strict";
const d=document,E=(tag,txt,cls)=>{const n=d.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const B=(label,fn)=>{const b=E("button",label,"sl-social-modal-button");b.type="button";b.onclick=fn;return b;};
let serial=0;
async function showProfile(options={}){const ok=await window.StudyLabProfileView?.open(options);if(!ok)window.StudyLabAuthGateway?.open("profile");}
async function render(host){
 const token=++serial,account=window.StudyLabAccount;host.replaceChildren(E("p","Loading your profile…"));
 try{
  await account?.ready;
  const user=account?.getUser?.();if(token!==serial||!host.isConnected)return;
  host.replaceChildren(E("h3","Your profile"));
  if(!user||user.is_anonymous){host.append(E("p","Sign in to view and edit your profile."),B("Sign in",()=>window.StudyLabAuthGateway?.open("signin")));return;}
  const [profile,counts]=await Promise.all([account.getProfile(true),window.StudyLabFollow?.stats(user.id).catch(()=>null)]);
  if(token!==serial||!host.isConnected||account.getUser()?.id!==user.id)return;
  const avatar=E("div",null,"sl-pv-avatar sl-social-own-avatar");avatar.classList.toggle("sl-pv-avatar-female",profile?.gender==="female");avatar.innerHTML='<svg viewBox="0 0 24 24" width="35" height="35" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';
  const name=E("strong",profile?.display_name||"Student","sl-social-own-name"),username=E("small",profile?.username?"@"+profile.username:"Username not set"),bio=E("p",profile?.bio||"No bio yet.","sl-social-own-bio");
  host.append(avatar,name,username,bio);window.StudyLabAvatar?.decorate(avatar,user.id);window.StudyLabNameMark?.decorate(name,user.id);
  const stats=E("div",null,"sl-social-own-counts");
  for(const k of ["followers","following"]){const b=B((counts?.[k]??"—")+" "+k,()=>showProfile({listType:k}));stats.append(b);}
  host.append(stats,B("Edit name & username",()=>showProfile({editSection:"identity"})),B("Edit photo & bio",()=>showProfile()));
  const status=E("p","Checking badge status…","sl-social-own-status"),apply=B("Apply for verification",async()=>{
   apply.disabled=true;
   try{const r=await account.client.rpc("studylab_request_verification");if(r.error)throw r.error;status.textContent=r.data==="verified"?"Already verified":r.data==="pending"?"Application pending":r.data==="approved"?"Previously approved": "Application recently reviewed. Try again later.";await render(host);}
   catch(e){status.textContent=e.message||"Verification unavailable.";apply.disabled=false;}
  });apply.disabled=true;host.append(apply,status);
  const [badge,request]=await Promise.all([account.client.from("studylab_verifications").select("user_id").eq("user_id",user.id).maybeSingle(),account.client.from("studylab_verification_requests").select("status,reviewed_at").eq("user_id",user.id).maybeSingle()]);
  if(token!==serial||!host.isConnected)return;
  if(badge.data){apply.hidden=true;status.textContent="Verified StudyLab account";}
  else if(request.error||badge.error){status.textContent="Verification currently unavailable.";}
  else if(request.data?.status==="pending"){status.textContent="Application pending · Awaiting admin review";}
  else{status.textContent=request.data?.status==="rejected"?"Previously declined · Reapply after 7 days.":"StudyLab account badge · Admin approval required.";apply.disabled=!!(request.data?.reviewed_at&&Date.now()-Date.parse(request.data.reviewed_at)<604800000);}
 }catch(_){if(token===serial&&host.isConnected)host.replaceChildren(E("p","Profile temporarily unavailable."),B("Open profile",()=>showProfile()));}
}
function mount(){const rail=d.querySelector(".sl-feed-right-rail");if(!rail||rail.querySelector(".sl-social-own-profile"))return;const host=E("section",null,"sl-feed-members-card sl-social-own-profile");rail.prepend(host);const head=d.querySelector(".sl-feed-panel [data-feed-close]")?.parentElement;if(head){const b=B("My profile",()=>showProfile());b.classList.add("sl-social-profile-shortcut");head.prepend(b);}window.addEventListener("studylab:social-visibility",e=>{if(e.detail?.open)render(host);});for(const event of ["studylab-profile-updated","studylab:follow-changed","studylab:avatar-updated"])window.addEventListener(event,()=>{if(d.body.classList.contains("sl-community-open"))render(host);});if(d.body.classList.contains("sl-community-open"))render(host);}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();