/* Plus launch preview. No payment collection or browser-side entitlement grants. */
(function(root){
"use strict";
const core=["Live Study Room and standard timer","Social and Chat","Past papers and simulations","Existing profile pictures and themes","Tasks, notes and bookmarks","Guardian safety screening"];
const planned=["Ad-free experience","Plus membership badge","Premium profile covers and frames","Custom backgrounds and appearance","Compact and micro floating timer","Extra Pet designs","Advanced study reports"];
function normalize(s){return {enabled:s?.enabled===true,active:s?.active===true&&s?.enabled===true,granted:s?.granted===true,expires_at:s?.expires_at||null,billing_ready:false};}
function eligible(u){return Boolean(u?.id&&!u.is_anonymous);}
function demoAllowed(host){return /^deploy-preview-[0-9]+--studylablk\.netlify\.app$/.test(host)||["localhost","127.0.0.1"].includes(host);}
const covers=["default","aurora","ocean","sunset","galaxy","nebula","starlight","mountains","forest","sakura","midnight","prism"],frames=["default","violet","cyan","gold","rose","mint","silver","rainbow"];
function validFrame(value){return typeof value==="string"&&(frames.includes(value)||/^#[0-9a-f]{6}$/i.test(value));}
function appearance(s){return {active:s?.active===true,cover:s?.active===true&&covers.includes(s.cover)?s.cover:"default",frame:s?.active===true&&validFrame(s.frame)?s.frame:"default"};}
function sponsored(item){return item?.kind==="sponsored"||item?.design?.preset==="sponsored";}
function filterSponsored(items,active){return active===true?items.filter(x=>!sponsored(x)):items;}
if(typeof module!=="undefined"&&module.exports){module.exports={normalize,core,planned,eligible,demoAllowed,appearance,sponsored,filterSponsored,validFrame,covers,frames};return;}
const d=root.document;
const E=(tag,text,cls)=>{const n=d.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const preview=demoAllowed(root.location.hostname);
let dialog=null,session=null,demoUser=null,demoAppearance=appearance(null);const refreshGeneration=new WeakMap();
async function status(){try{const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))return normalize(null);const r=await a.client.rpc("studylab_plus_status");if(r.error||a.getUser()?.id!==u.id)return normalize(null);return normalize(r.data);}catch(_){return normalize(null);}}
function close(){dialog?.close();}
function currentDemo(){const u=root.StudyLabAccount?.getUser?.();if(!preview||!eligible(u))return false;if(demoUser===u.id)return true;try{const saved=JSON.parse(root.sessionStorage.getItem("sl-plus-demo")||"null");if(saved?.user===u.id){demoUser=u.id;demoAppearance=appearance(saved.appearance);return true;}}catch(_){}return false;}
function persistDemo(){try{if(demoUser)root.sessionStorage.setItem("sl-plus-demo",JSON.stringify({user:demoUser,appearance:demoAppearance}));else root.sessionStorage.removeItem("sl-plus-demo");}catch(_){}}
function changed(){d.dispatchEvent(new Event("studylab:plus-changed"));}
function setDemo(on){const u=root.StudyLabAccount?.getUser?.();if(!preview||!eligible(u))return;if(on&&demoUser!==u.id)demoAppearance=appearance(null);demoUser=on?u.id:null;persistDemo();changed();}
async function adFree(){if(currentDemo())return true;return (await status()).active;}
async function profileState(id){
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u)||!id)return appearance(null);
 if(currentDemo()&&id===u.id)return {...demoAppearance,active:true,demo:true};
 try{const r=await a.client.rpc("studylab_plus_profile_state",{p_user:id});return r.error||a.getUser()?.id!==u.id?appearance(null):appearance(r.data);}catch(_){return appearance(null);}
}
async function saveAppearance(cover,frame){
 if(!covers.includes(cover)||!validFrame(frame))throw Error("Choose a valid appearance.");
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))throw Error("Sign in first.");
 if(currentDemo()){demoAppearance=appearance({active:true,cover,frame});persistDemo();changed();return;}
 const state=await status();if(!state.active||a.getUser()?.id!==u.id)throw Error("Active Plus required.");
 if(preview)throw Error("Preview is read-only for real membership. Switch to demo mode.");
 const r=await a.client.rpc("studylab_plus_save_appearance",{p_cover:cover,p_frame:frame});if(r.error||a.getUser()?.id!==u.id)throw Error(r.error?.message||"Session changed.");changed();
}
function paintAppearance(panel,avatar,state){
 panel.dataset.plusCover=state.active?state.cover:"default";
 avatar.dataset.plusFrame=state.active?state.frame:"default";
 avatar.style.removeProperty("--sl-plus-ring");
 if(state.active&&/^#[0-9a-f]{6}$/i.test(state.frame)){avatar.dataset.plusFrame="custom";avatar.style.setProperty("--sl-plus-ring",state.frame);}
 panel.querySelector(":scope > .sl-plus-floats")?.remove();
 if(state.active&&state.cover!=="default"){
  const layer=E("div",null,"sl-plus-floats");layer.setAttribute("aria-hidden","true");
  const icons={galaxy:"✧ ✦ ◇ ○ ✧ ✦",nebula:"✦ ○ ✧ ◇ ✦ ○",starlight:"✧ ⋆ ✦ ⋆ ✧ ⋆",mountains:"✧ △ ○ ✧ △ ○",forest:"◇ ❋ ◇ ❋ ◇ ❋",sakura:"❀ ✿ ❀ ✿ ❀ ✿",ocean:"○ ◌ ○ ◌ ○ ◌",sunset:"✧ ○ ✧ ○ ✧ ○",aurora:"✧ ◇ ✧ ◇ ✧ ◇",midnight:"⋆ ✧ ⋆ ✧ ⋆ ✧",prism:"◇ △ ◇ △ ◇ △"};
  for(const [i,shape] of (icons[state.cover]||"✧ ○ ✧ ○ ✧ ○").split(" ").entries()){const n=E("span",shape);n.dataset.particle=String(i);layer.append(n);}panel.prepend(layer);
 }
}
function paintProfile(panel,avatar,name,state){
 paintAppearance(panel,avatar,state);
 panel.querySelector(".sl-plus-member-badge")?.remove();
 if(state.active){const mark=E("span",state.demo?"✦ Plus demo":"✦ Plus","sl-plus-member-badge");name.insertAdjacentElement("afterend",mark);}
}
function profileEditor(panel,id){
 panel.querySelector(".sl-plus-customize")?.remove();
 const a=root.StudyLabAccount,u=a?.getUser?.();if(!eligible(u)||u.id!==id)return;
 const b=E("button","Customize Plus profile","sl-plus-profile-entry sl-plus-customize");b.type="button";
 b.onclick=async()=>{const s=await profileState(id);if(!s.active){void open("Premium profile covers and frames");return;}
  const editor=E("dialog",null,"sl-plus-dialog sl-plus-editor"),title=E("h2","Customize your profile"),note=E("p",s.demo?"Preview only. These changes are saved in this tab, not your real account.":"Select a cover and ring. Your appearance follows your account.");
  let cover=s.cover,frame=s.frame;
  const sample=E("div",null,"sl-plus-appearance-sample"),sampleAvatar=E("div","✦","sl-plus-sample-avatar"),sampleName=E("strong","Your profile · Plus");sample.append(sampleAvatar,sampleName);
  const gallery=E("div",null,"sl-plus-cover-gallery"),rings=E("div",null,"sl-plus-ring-gallery"),picker=E("input"),pickerLabel=E("label","Custom ring colour","sl-plus-color-label");picker.type="color";picker.value=/^#[0-9a-f]{6}$/i.test(frame)?frame:"#b29bff";pickerLabel.append(picker);
  function update(){paintAppearance(sample,sampleAvatar,{active:true,cover,frame});for(const el of gallery.children)el.setAttribute("aria-pressed",String(el.dataset.choice===cover));for(const el of rings.children)el.setAttribute("aria-pressed",String(el.dataset.choice===frame));}
  for(const key of covers){const tile=E("button",null,"sl-plus-cover-tile");tile.type="button";tile.dataset.choice=key;tile.dataset.plusCover=key;tile.append(E("span",key[0].toUpperCase()+key.slice(1)));tile.onclick=()=>{cover=key;update();};gallery.append(tile);}
  for(const key of frames){const tile=E("button",key[0].toUpperCase()+key.slice(1),"sl-plus-ring-choice");tile.type="button";tile.dataset.choice=key;tile.dataset.plusFrame=key;tile.onclick=()=>{frame=key;update();};rings.append(tile);}
  picker.oninput=()=>{frame=picker.value;update();};
  const actions=E("div",null,"sl-plus-editor-actions"),save=E("button","Save appearance","sl-plus-profile-entry"),cancel=E("button","Close","sl-plus-profile-entry"),msg=E("p");msg.setAttribute("role","status");save.type=cancel.type="button";
  save.onclick=async()=>{save.disabled=true;try{if(a.getUser()?.id!==id)throw Error("Session changed.");await saveAppearance(cover,frame);editor.close();}catch(e){msg.textContent=e.message;save.disabled=false;}};
  cancel.onclick=()=>editor.close();actions.append(save,cancel);editor.append(title,note,sample,E("h3","Profile covers"),gallery,E("h3","Avatar ring"),rings,pickerLabel,actions,msg);update();editor.addEventListener("close",()=>{editor.remove();if(b.isConnected)b.focus();});d.body.append(editor);try{editor.showModal();}catch(_){editor.remove();}
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
function clearProfile(panel,avatar){refreshGeneration.set(panel,(refreshGeneration.get(panel)||0)+1);panel.querySelector(".sl-plus-member-badge")?.remove();panel.querySelector(".sl-plus-customize")?.remove();delete panel.dataset.plusCover;delete avatar.dataset.plusFrame;avatar.style.removeProperty("--sl-plus-ring");panel.querySelector(":scope > .sl-plus-floats")?.remove();}
async function sync(button){if(!button)return;button.hidden=true;const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))return;const uid=u.id;if(preview){if(button.isConnected&&!button.parentElement?.closest("[hidden]")){button.hidden=false;button.textContent=currentDemo()?"Manage Plus demo":"Get StudyLab Plus";}return;}const state=await status();if(a.getUser()?.id!==uid||!eligible(a.getUser())||!button.isConnected||button.parentElement?.closest("[hidden]"))return;button.hidden=!(preview||state.enabled);button.textContent=currentDemo()?"Manage Plus demo":state.active?"Manage Plus":"Get StudyLab Plus";}
async function open(feature){
 if(dialog?.open)return;
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))return;
 const state=preview?normalize(null):await status();if(a.getUser()?.id!==u.id||!eligible(a.getUser())||(!preview&&!state.enabled))return;
 if(dialog?.open)return;
 const previous=d.activeElement;session=u.id;
 const node=E("dialog",null,"sl-plus-dialog sl-plus-plans");dialog=node;node.setAttribute("aria-label","StudyLab Plus plans");
 const head=E("header",null,"sl-plus-head"),x=E("button","×","sl-plus-close");x.type="button";x.setAttribute("aria-label","Close membership plans");x.onclick=close;
 head.append(E("span","STUDYLAB MEMBERSHIP","sl-plus-eyebrow"),x);
 const title=E("h2",currentDemo()?"Your Plus demo":state.active?"Your StudyLab Plus":"Make StudyLab yours");
 const sub=E("p",feature?"Unlock "+String(feature):"All your learning tools stay free. Plus adds more ways to personalize.");
 const banner=E("p",state.active?(state.expires_at?"Complimentary · Expires "+new Date(state.expires_at).toLocaleDateString():"Complimentary · No expiry"):preview?"Test mode · No real payments or membership changes":"Purchases not available yet.","sl-plus-notice");
 const grid=E("div",null,"sl-plus-grid");
 for(const plus of [false,true]){
  const card=E("section",null,"sl-plus-plan"+(plus?" is-plus":""));card.append(E("h3",plus?"✦ StudyLab Plus":"StudyLab Free"),E("strong",plus?"Price pending":"Rs. 0","sl-plus-price"),E("p",plus?"Monthly · Cancel renewal anytime":"All essential learning tools"));
  const action=E("button",plus?(currentDemo()?"Plus demo active":state.active?"Membership active":"Checkout not available yet"):(currentDemo()?"Free plan (demo)":state.active?"Free plan":"Your current plan"),"sl-plus-action");action.type="button";action.disabled=true;if(preview&&plus){action.disabled=false;action.textContent=currentDemo()?"Switch to Free demo":"Try Plus demo";action.onclick=()=>{if(root.StudyLabAccount?.getUser?.()?.id!==session){close();return;}setDemo(!currentDemo());close();};}card.append(action);
  const list=E("ul");for(const f of (plus?["Everything in Free",...planned]:core))list.append(E("li",f));card.append(list);
  
  grid.append(card);
 }
 node.append(head,title,sub,banner,grid);

 node.append(E("p","Plus badge is separate from blue verification. Some benefits are still in development.","sl-plus-foot"));
 node.addEventListener("cancel",e=>{e.preventDefault();close();});node.addEventListener("close",()=>{node.remove();if(dialog===node){dialog=null;session=null;}previous?.focus?.({preventScroll:true});});
 d.body.append(node);try{node.showModal();x.focus();}catch(_){node.remove();dialog=null;session=null;}
}

const badgeQueue=new Set(),badgeCache=new Map();let badgeTimer=null,badgeBlockedUntil=0,badgeViewer=null;
const validId=id=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function renderNameBadge(node,id){
 const own=root.StudyLabAccount?.getUser?.()?.id===id,demo=own&&currentDemo(),cached=badgeCache.get(id);
 const show=demo||Boolean(cached?.active&&cached.until>Date.now());
 let mark=node.querySelector(":scope > .sl-plus-inline-badge");
 if(!show){mark?.remove();return;}
 if(!mark){mark=E("span",null,"sl-plus-inline-badge");node.append(mark);}
 mark.textContent=demo?"✦ Plus demo":"✦ Plus";mark.title=demo?"Preview only":"StudyLab Plus";
}
function decorateName(node,id){
 if(!node)return;
 if(node.closest(".sl-pv-dialog"))return; // Profile view has a dedicated badge and appearance.
 node.dataset.slPlusUser=validId(id)?id:"";
 renderNameBadge(node,id);
 if(!validId(id)||badgeBlockedUntil>Date.now()||badgeCache.get(id)?.until>Date.now())return;
 badgeQueue.add(id);
 if(!badgeTimer)badgeTimer=setTimeout(flushBadges,100);
}
async function flushBadges(){
 badgeTimer=null;const a=root.StudyLabAccount;await a?.ready;const viewer=a?.getUser?.();const ids=[...badgeQueue].slice(0,100);ids.forEach(id=>badgeQueue.delete(id));if(!eligible(viewer)||!ids.length)return;
 if(badgeViewer!==viewer.id){badgeCache.clear();badgeViewer=viewer.id;}
 try{const result=await a.client.rpc("studylab_plus_badges",{p_users:ids});if(a.getUser()?.id!==viewer.id)return;if(result.error)throw result.error;
 const members=new Set(Array.isArray(result.data)?result.data:[]);for(const id of ids)badgeCache.set(id,{active:members.has(id),until:Date.now()+60000});
 }catch(_){badgeBlockedUntil=Date.now()+60000;badgeCache.clear();badgeQueue.clear();}
 d.querySelectorAll("[data-sl-plus-user]").forEach(node=>renderNameBadge(node,node.dataset.slPlusUser));
 if(badgeQueue.size&&!badgeTimer)badgeTimer=setTimeout(flushBadges,100);
}
function refreshNames(){d.querySelectorAll("[data-sl-plus-user]").forEach(node=>decorateName(node,node.dataset.slPlusUser));}
d.addEventListener("studylab:plus-changed",refreshNames);
d.addEventListener("visibilitychange",()=>{if(!d.hidden)refreshNames();});
setInterval(()=>{if(!d.hidden&&d.querySelector("[data-sl-plus-user]"))refreshNames();},60000);
const account=root.StudyLabAccount;
account?.client?.auth?.onAuthStateChange?.((event,session)=>{
 const uid=session?.user?.id||null;if(event==="SIGNED_OUT"||(badgeViewer&&badgeViewer!==uid)){badgeCache.clear();badgeQueue.clear();badgeViewer=uid;demoUser=null;demoAppearance=appearance(null);persistDemo();setTimeout(()=>{close();changed();},0);}
});

root.StudyLabPlus=Object.freeze({status,sync,open,adFree,filterSponsored,refreshProfile,clearProfile,decorateName});
})(typeof window!=="undefined"?window:globalThis);
