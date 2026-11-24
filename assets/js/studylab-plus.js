/* Plus launch preview. No payment collection or browser-side entitlement grants. */
(function(root){
"use strict";
const core=["Live Study Room and standard timer","Social and Chat","Past papers and simulations","Existing profile pictures and themes","Tasks, notes and bookmarks","Guardian safety screening"];
const planned=["Ad-free experience","Plus membership badge","Premium profile covers and frames","Custom backgrounds and appearance","Compact and micro floating timer","Extra Pet designs","Advanced study reports"];
function normalize(s){return {enabled:s?.enabled===true,active:s?.active===true&&s?.enabled===true,granted:s?.granted===true,expires_at:s?.expires_at||null,billing_ready:false};}
function eligible(u){return Boolean(u?.id&&!u.is_anonymous);}
function demoAllowed(host){return /^deploy-preview-[0-9]+--studylablk\.netlify\.app$/.test(host)||["localhost","127.0.0.1"].includes(host);}
const covers=["default","aurora","ocean","sunset"],frames=["default","violet","cyan","gold"];
function appearance(s){return {active:s?.active===true,cover:s?.active===true&&covers.includes(s.cover)?s.cover:"default",frame:s?.active===true&&frames.includes(s.frame)?s.frame:"default"};}
function sponsored(item){return item?.kind==="sponsored"||item?.design?.preset==="sponsored";}
function filterSponsored(items,active){return active===true?items.filter(x=>!sponsored(x)):items;}
if(typeof module!=="undefined"&&module.exports){module.exports={normalize,core,planned,eligible,demoAllowed,appearance,sponsored,filterSponsored};return;}
const d=root.document;
const E=(tag,text,cls)=>{const n=d.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const preview=demoAllowed(root.location.hostname);
let dialog=null,session=null,demoUser=null,demoAppearance=appearance(null);const refreshGeneration=new WeakMap();
async function status(){try{const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))return normalize(null);const r=await a.client.rpc("studylab_plus_status");if(r.error||a.getUser()?.id!==u.id)return normalize(null);return normalize(r.data);}catch(_){return normalize(null);}}
function close(){dialog?.close();}
function currentDemo(){const u=root.StudyLabAccount?.getUser?.();return preview&&eligible(u)&&demoUser===u.id;}
function changed(){d.dispatchEvent(new Event("studylab:plus-changed"));}
function setDemo(on){const u=root.StudyLabAccount?.getUser?.();if(!preview||!eligible(u))return;if(on&&demoUser!==u.id)demoAppearance=appearance(null);demoUser=on?u.id:null;changed();}
async function adFree(){if(currentDemo())return true;return (await status()).active;}
async function profileState(id){
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u)||!id)return appearance(null);
 if(currentDemo()&&id===u.id)return {...demoAppearance,active:true,demo:true};
 try{const r=await a.client.rpc("studylab_plus_profile_state",{p_user:id});return r.error||a.getUser()?.id!==u.id?appearance(null):appearance(r.data);}catch(_){return appearance(null);}
}
async function saveAppearance(cover,frame){
 if(!covers.includes(cover)||!frames.includes(frame))throw Error("Choose a valid appearance.");
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))throw Error("Sign in first.");
 if(currentDemo()){demoAppearance=appearance({active:true,cover,frame});changed();return;}
 const state=await status();if(!state.active||a.getUser()?.id!==u.id)throw Error("Active Plus required.");
 if(preview)throw Error("Preview is read-only for real membership. Switch to demo mode.");
 const r=await a.client.rpc("studylab_plus_save_appearance",{p_cover:cover,p_frame:frame});if(r.error||a.getUser()?.id!==u.id)throw Error(r.error?.message||"Session changed.");changed();
}
function paintProfile(panel,avatar,name,state){
 panel.dataset.plusCover=state.active?state.cover:"default";avatar.dataset.plusFrame=state.active?state.frame:"default";
 panel.querySelector(".sl-plus-member-badge")?.remove();
 if(state.active){const mark=E("span",state.demo?"✦ Plus demo":"✦ Plus","sl-plus-member-badge");name.insertAdjacentElement("afterend",mark);}
}
function profileEditor(panel,id){
 panel.querySelector(".sl-plus-customize")?.remove();
 const a=root.StudyLabAccount,u=a?.getUser?.();if(!eligible(u)||u.id!==id)return;
 const b=E("button","Customize Plus profile","sl-plus-profile-entry sl-plus-customize");b.type="button";
 b.onclick=async()=>{const s=await profileState(id);if(!s.active){void open("Premium profile covers and frames");return;}
  const editor=E("dialog",null,"sl-plus-dialog"),title=E("h2","Profile appearance"),note=E("p",s.demo?"Demo only. No account changes are saved.":"Choose your profile cover and avatar frame.");
  const select=(label,options,value)=>{const wrap=E("label",label,"sl-plus-choice"),input=E("select");for(const v of options){const opt=E("option",v[0].toUpperCase()+v.slice(1));opt.value=v;input.append(opt);}input.value=value;wrap.append(input);editor.append(wrap);return input;};
  editor.append(title,note);const cover=select("Cover",covers,s.cover),frame=select("Avatar frame",frames,s.frame),save=E("button","Save appearance","sl-plus-profile-entry"),cancel=E("button","Close","sl-plus-profile-entry"),msg=E("p");msg.setAttribute("role","status");save.type=cancel.type="button";
  save.onclick=async()=>{save.disabled=true;try{if(a.getUser()?.id!==id)throw Error("Session changed.");await saveAppearance(cover.value,frame.value);editor.close();}catch(e){msg.textContent=e.message;save.disabled=false;}};
  cancel.onclick=()=>editor.close();editor.append(save,cancel,msg);editor.addEventListener("close",()=>{editor.remove();if(b.isConnected)b.focus();});d.body.append(editor);try{editor.showModal();}catch(_){editor.remove();}
 };
 panel.querySelector(".sl-pv-actions")?.append(b);
}
async function refreshProfile(panel,avatar,name,id,own,valid){
 const generation=(refreshGeneration.get(panel)||0)+1;refreshGeneration.set(panel,generation);
 const stillValid=()=>valid()&&refreshGeneration.get(panel)===generation;
 if(own&&preview&&stillValid())profileEditor(panel,id);
 const state=await profileState(id);if(!stillValid())return;paintProfile(panel,avatar,name,state);
 if(own&&!preview&&(await status()).enabled&&stillValid())profileEditor(panel,id);
}
function clearProfile(panel,avatar){refreshGeneration.set(panel,(refreshGeneration.get(panel)||0)+1);panel.querySelector(".sl-plus-member-badge")?.remove();panel.querySelector(".sl-plus-customize")?.remove();delete panel.dataset.plusCover;delete avatar.dataset.plusFrame;}
async function sync(button){if(!button)return;button.hidden=true;const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))return;const uid=u.id;if(preview){if(button.isConnected&&!button.parentElement?.closest("[hidden]")){button.hidden=false;button.textContent=currentDemo()?"Manage Plus demo":"Get StudyLab Plus";}return;}const state=await status();if(a.getUser()?.id!==uid||!eligible(a.getUser())||!button.isConnected||button.parentElement?.closest("[hidden]"))return;button.hidden=!(preview||state.enabled);button.textContent=currentDemo()?"Manage Plus demo":state.active?"Manage Plus":"Get StudyLab Plus";}
async function open(feature){
 if(dialog?.open)return;
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))return;
 const state=preview?normalize(null):await status();if(a.getUser()?.id!==u.id||!eligible(a.getUser())||(!preview&&!state.enabled))return;
 if(dialog?.open)return;
 const previous=d.activeElement;session=u.id;
 const node=E("dialog",null,"sl-plus-dialog");dialog=node;node.setAttribute("aria-label","StudyLab Plus plans");
 const head=E("header",null,"sl-plus-head"),x=E("button","×","sl-plus-close");x.type="button";x.setAttribute("aria-label","Close membership plans");x.onclick=close;
 head.append(E("span","STUDYLAB MEMBERSHIP","sl-plus-eyebrow"),x);
 const title=E("h2",currentDemo()?"Your Plus demo":state.active?"Your StudyLab Plus":"Make StudyLab yours");
 const sub=E("p",feature?"Planned Plus feature: "+String(feature):"Keep learning free. Unlock extra ways to personalize your workspace.");
 const banner=E("p",state.active?(state.expires_at?"Complimentary membership · Expires "+new Date(state.expires_at).toLocaleDateString():"Complimentary membership · No expiry"):"Development preview · Purchases and premium features are not yet enabled.","sl-plus-notice");
 const grid=E("div",null,"sl-plus-grid");
 for(const plus of [false,true]){
  const card=E("section",null,"sl-plus-plan"+(plus?" is-plus":""));card.append(E("h3",plus?"✦ StudyLab Plus":"StudyLab Free"),E("strong",plus?"Price to be confirmed":"Rs. 0","sl-plus-price"),E("p",plus?"Monthly renewal planned · Cancel before next billing date":"All existing learning tools remain free"));
  const action=E("button",plus?(currentDemo()?"Plus demo active":state.active?"Membership active":"Checkout not available yet"):(currentDemo()?"Free plan (demo)":state.active?"Free plan":"Your current plan"),"sl-plus-action");action.type="button";action.disabled=true;card.append(action);
  const list=E("ul");for(const f of (plus?["Everything in Free",...planned]:core))list.append(E("li",f));card.append(list);
  if(plus)card.append(E("small","Badge, covers and frames, and sponsored announcement filtering are in development. Other benefits are planned. No purchases are available."));
  grid.append(card);
 }
 node.append(head,title,sub,banner,grid);
 if(preview){
  const demo=E("section",null,"sl-plus-plan is-plus"),demoTitle=E("h3","Preview the member experience"),demoNote=E("p","Visual demonstration only. No membership, payment, or feature permissions will change."),toggle=E("button","Show Plus member example","sl-plus-profile-entry"),sample=E("div");
  toggle.type="button";toggle.setAttribute("aria-expanded","false");sample.hidden=true;
  sample.append(E("h3","Example student · ✦ Plus"),E("p","Illustrative profile badge · Premium background · Extra pet designs"),E("p","Manage Plus · Monthly subscription · Cancel renewal"),E("p","These are examples, not active features. No card details are collected."));
  toggle.onclick=()=>{sample.hidden=!sample.hidden;toggle.setAttribute("aria-expanded",String(!sample.hidden));toggle.textContent=sample.hidden?"Show Plus member example":"Hide Plus member example";};
  const mode=E("button",currentDemo()?"Switch to Free demo":"Try Plus demo","sl-plus-profile-entry");mode.type="button";mode.onclick=()=>{if(root.StudyLabAccount?.getUser?.()?.id!==session){close();return;}setDemo(!currentDemo());close();};
  demo.append(demoTitle,demoNote,mode,toggle,sample);node.append(demo);
 }
 node.append(E("p","Blue verification remains separately awarded by administrators. Plus membership does not confer administrator rights.","sl-plus-foot"));
 node.addEventListener("cancel",e=>{e.preventDefault();close();});node.addEventListener("close",()=>{node.remove();if(dialog===node){dialog=null;session=null;}previous?.focus?.({preventScroll:true});});
 d.body.append(node);try{node.showModal();x.focus();}catch(_){node.remove();dialog=null;session=null;}
}
root.StudyLabPlus=Object.freeze({status,sync,open,adFree,filterSponsored,refreshProfile,clearProfile});
})(typeof window!=="undefined"?window:globalThis);
