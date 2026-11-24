/* Plus launch preview. No payment collection or browser-side entitlement grants. */
(function(root){
"use strict";
const core=["Live Study Room and standard timer","Social and Chat","Past papers and simulations","Existing profile pictures and themes","Tasks, notes and bookmarks","Guardian safety screening"];
const planned=["Plus membership badge","Custom studying cards and chat bubbles","Premium profile covers and frames","Custom backgrounds and appearance","Compact and micro floating timer","Extra Pet designs","Advanced study reports"];
function normalize(s){return {enabled:s?.enabled===true,active:s?.active===true&&s?.enabled===true,granted:s?.granted===true,expires_at:s?.expires_at||null,billing_ready:false};}
function eligible(u){return Boolean(u?.id&&!u.is_anonymous);}
function demoAllowed(host){return /^deploy-preview-[0-9]+--studylablk\.netlify\.app$/.test(host)||["localhost","127.0.0.1"].includes(host);}
const covers=["default","aurora","ocean","sunset","galaxy","nebula","starlight","mountains","forest","sakura","midnight","prism"],frames=["default","violet","cyan","gold","rose","mint","silver","rainbow"];
function validFrame(value){return typeof value==="string"&&(frames.includes(value)||/^#[0-9a-f]{6}$/i.test(value));}
const effects=["default","aurora","galaxy","pulse","sakura","ocean"],bubbles=["default","violet","cyan","rose","mint","gold"],pets=["default","nebula","mint","rose","gold"],timerModes=["standard","compact","micro"];
const plans=Object.freeze([{months:1,price:199,label:"Monthly"},{months:3,price:499,label:"3 months"},{months:12,price:1799,label:"Yearly"}]);
const petShapes=["default","capsule","square","orb"],petEyes=["default","round","pixel","star","arc"],petGlows=["default","none","soft","neon","galaxy","spark"],petMouths=["default","smile","dot","none"];
const colorValue=(v)=>typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():"default";
function details(v){return {shape:petShapes.includes(v?.shape)?v.shape:"default",eyes:petEyes.includes(v?.eyes)?v.eyes:"default",glow:petGlows.includes(v?.glow)?v.glow:"default",mouth:petMouths.includes(v?.mouth)?v.mouth:"default",eyeColor:colorValue(v?.eyeColor),timerAccent:colorValue(v?.timerAccent)};}
function appearance(s){const active=s?.active===true;return {active,cover:active&&covers.includes(s.cover)?s.cover:"default",frame:active&&validFrame(s.frame)?s.frame:"default",effect:active&&effects.includes(s.effect)?s.effect:"default",bubble:active&&bubbles.includes(s.bubble)?s.bubble:"default",pet:active&&pets.includes(s.pet)?s.pet:"default",timer:active&&timerModes.includes(s.timer)?s.timer:"standard",details:details(active?s.details:null)};}
function hasPremiumDraft(s){const a=appearance({...s,active:true}),base=appearance({active:true});return JSON.stringify(a)!==JSON.stringify(base);}
function sponsored(item){return item?.kind==="sponsored"||item?.design?.preset==="sponsored";}
function filterSponsored(items){return items;}
if(typeof module!=="undefined"&&module.exports){module.exports={normalize,core,planned,eligible,demoAllowed,appearance,sponsored,filterSponsored,validFrame,covers,frames,effects,bubbles,pets,timerModes,plans,details,petShapes,petEyes,petGlows,petMouths,hasPremiumDraft};return;}
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
async function adFree(){return false;}
async function profileState(id){
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u)||!id)return appearance(null);
 if(preview&&id===u.id)return currentDemo()?{...demoAppearance,active:true,demo:true}:appearance(null);
 try{const r=await a.client.rpc("studylab_plus_profile_state",{p_user:id});return r.error||a.getUser()?.id!==u.id?appearance(null):appearance(r.data);}catch(_){return appearance(null);}
}
async function saveAppearance(cover,frame,extras={}){
 if(!covers.includes(cover)||!validFrame(frame))throw Error("Choose a valid appearance.");
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!eligible(u))throw Error("Sign in first.");
 const prior=await profileState(u.id);if(a.getUser()?.id!==u.id)throw Error("Session changed.");const next=appearance({...prior,...extras,active:true,cover,frame});if(currentDemo()){demoAppearance=next;persistDemo();changed();return;}
 const state=await status();if(!state.active||a.getUser()?.id!==u.id)throw Error("Active Plus required.");
 if(preview)throw Error("Preview is read-only for real membership. Switch to demo mode.");
 const r=await a.client.rpc("studylab_plus_save_appearance",{p_cover:next.cover,p_frame:next.frame,p_effect:next.effect,p_bubble:next.bubble,p_pet:next.pet,p_timer:next.timer,p_details:next.details});if(r.error||a.getUser()?.id!==u.id)throw Error(r.error?.message||"Session changed.");badgeCache.delete(u.id);changed();
}
async function ownAppearance(){const a=root.StudyLabAccount;await a?.ready;return profileState(a?.getUser?.()?.id);}
async function savePreference(key,value){const s=await ownAppearance();if(!s.active){await open("Premium customization");return false;}const allowed={pet:pets,timer:timerModes,effect:effects,bubble:bubbles};if(!allowed[key]?.includes(value))return false;await saveAppearance(s.cover,s.frame,{[key]:value});return true;}
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
function paintPet(node,state){
 const prefs=details(state.active?state.details:null);
 node.dataset.plusPet=state.active?state.pet:"default";
 node.dataset.plusShape=prefs.shape;node.dataset.plusEyes=prefs.eyes;node.dataset.plusGlow=prefs.glow;node.dataset.plusMouth=prefs.mouth;
 node.style.removeProperty("--sl-plus-eye-color");if(prefs.eyeColor!=="default")node.style.setProperty("--sl-plus-eye-color",prefs.eyeColor);
 node.dataset.plusEyeColor=prefs.eyeColor==="default"?"default":"custom";
}
let studio=null;
async function openStudio(initial="cover"){
 if(studio?.open){studio.focus();return;}
 const account=root.StudyLabAccount;await account?.ready;const user=account?.getUser?.();if(!eligible(user))return;
 if(!preview&&!(await status()).enabled)return;
 const saved=await profileState(user.id);if(account.getUser()?.id!==user.id||studio?.open)return;
 let draft=appearance({...saved,active:true}),category=initial;
 const editor=E("dialog",null,"sl-plus-dialog sl-plus-studio");studio=editor;editor.setAttribute("aria-label","StudyLab Plus Studio");
 const previous=d.activeElement,header=E("header",null,"sl-plus-head"),heading=E("div"),closeButton=E("button","×","sl-plus-close");
 heading.append(E("span","STUDYLAB · CUSTOMIZATION","sl-plus-eyebrow"),E("h2","Plus Studio"));closeButton.type="button";closeButton.setAttribute("aria-label","Close without applying");closeButton.onclick=()=>editor.close();header.append(heading,closeButton);
 const note=E("p",saved.demo?"Demo mode · Changes apply only to this tab.":saved.active?"Preview your design, then apply it to your account.":"Explore every design for free. Plus is required only when applying premium changes.","sl-plus-notice");
 const layout=E("div",null,"sl-plus-studio-layout"),previewPane=E("section",null,"sl-plus-studio-preview"),controls=E("section",null,"sl-plus-studio-controls"),tabs=E("nav",null,"sl-plus-studio-tabs"),options=E("div",null,"sl-plus-studio-options");
 const sample=E("div",null,"sl-plus-appearance-sample"),sampleAvatar=E("div","✦","sl-plus-sample-avatar"),sampleName=E("strong","Your profile"),sampleBadge=E("small","✦ Plus","sl-plus-inline-badge");
 const currentProfile=d.querySelector(".sl-pv-dialog:not([hidden]) .sl-pv-name");const currentPhoto=d.querySelector(".sl-pv-dialog:not([hidden]) .sl-pv-avatar img.sl-avatar-photo:not([hidden])");if(currentProfile&&currentProfile.closest(".sl-pv-view:not([hidden])")){const nameText=[...currentProfile.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join("").trim();if(nameText)sampleName.textContent=nameText;if(currentPhoto){const img=currentPhoto.cloneNode(false);img.removeAttribute("id");img.className="sl-plus-sample-photo";img.alt="";sampleAvatar.replaceChildren(img);}}sample.append(sampleAvatar,sampleName,sampleBadge,E("small","Your profile appearance"));
 const live=E("article",null,"room-person-card sl-plus-live-sample");live.append(E("small","● Studying now"),E("strong","Your studying card"),E("small","Combined Mathematics"),E("strong","00:42:18"));
 const chat=E("article",null,"study-chat-message sl-plus-chat-sample");chat.append(E("strong","You · ✦ Plus"),E("p","Ready for another study session."));
 const petBox=E("div",null,"sl-plus-pet-preview"),pet=E("div",null,"sl-pet-character sl-plus-pet-sample"),face=E("div",null,"sl-pet-visual");for(const side of ["left","right"]){const eye=E("div",null,"sl-pet-eye "+side);eye.append(E("i"));face.append(eye);}face.append(E("div",null,"sl-pet-mouth"));pet.append(face);petBox.append(pet,E("small","Your study companion"));
 const timer=E("div",null,"sl-plus-clock-sample"),digits=E("strong","00:42:18"),timerTitle=E("small","StudyLab timer");timer.append(timerTitle,digits,E("small","Start   ·   Pause   ·   End"));
 previewPane.append(E("small","LIVE PREVIEW · NOT SAVED","sl-plus-eyebrow"),sample,live,chat,petBox,timer);
 const groupNames={cover:"Profile cover",frame:"Avatar ring",effect:"Study card",bubble:"Chat bubble",pet:"Pet studio",timer:"Timer"};
 const label=v=>v==="default"?"Original":v[0].toUpperCase()+v.slice(1);
 const actionBar=E("footer",null,"sl-plus-studio-actions"),reset=E("button","Reset design","sl-plus-profile-entry"),apply=E("button","Apply changes","sl-plus-profile-entry sl-plus-apply"),message=E("p",null,"sl-plus-studio-message");message.setAttribute("role","status");reset.type=apply.type="button";actionBar.append(reset,apply);
 function refresh(){
  paintAppearance(sample,sampleAvatar,draft);live.dataset.plusEffect=draft.effect;chat.dataset.plusBubble=draft.bubble;paintPet(pet,draft);
  timer.dataset.plusTimer=draft.timer;timer.style.removeProperty("--sl-plus-timer-accent");if(draft.details.timerAccent!=="default")timer.style.setProperty("--sl-plus-timer-accent",draft.details.timerAccent);
  sample.hidden=!["cover","frame"].includes(category);live.hidden=category!=="effect";chat.hidden=category!=="bubble";petBox.hidden=category!=="pet";timer.hidden=category!=="timer";
  for(const button of tabs.children)button.setAttribute("aria-pressed",String(button.dataset.category===category));
  for(const button of options.querySelectorAll("[data-option-key]")){const k=button.dataset.optionKey;button.setAttribute("aria-pressed",String((k.startsWith("details.")?draft.details[k.slice(8)]:draft[k])===button.dataset.choice));}
 }
 function set(k,v){if(k.startsWith("details."))draft.details[k.slice(8)]=v;else draft[k]=v;refresh();}
 function tiles(title,key,values,kind){
  options.append(E("h3",title));const group=E("div",null,"sl-plus-tile-grid");for(const v of values){
   const button=E("button",null,"sl-plus-studio-tile");button.type="button";button.dataset.optionKey=key;button.dataset.choice=v;
   const swatch=E("span",null,"sl-plus-tile-swatch");if(kind==="cover")swatch.dataset.plusCover=v;
   else if(kind==="frame"){const ring=E("span","✦","sl-plus-ring-swatch");ring.dataset.plusFrame=v;swatch.append(ring);}
   else if(kind==="bubble"){swatch.dataset.plusBubble=v;swatch.classList.add("study-chat-message");swatch.textContent="Aa";}
   else if(kind==="effect"){swatch.dataset.plusEffect=v;swatch.classList.add("room-person-card");swatch.textContent="✧";}
   else if(kind==="pet"){const mini=E("span","••","sl-plus-pet-tile");mini.dataset.pet=v;swatch.append(mini);}
   else{swatch.textContent=key==="details.eyes"?({default:"▮ ▮",round:"● ●",pixel:"■ ■",star:"✦ ✦",arc:"⌒ ⌒"}[v]||"✧"):key==="details.shape"?({default:"▢",capsule:"⬭",square:"□",orb:"○"}[v]||"✧"):key==="timer"?"00:42":key==="details.mouth"?({default:"⌣",smile:"◡",dot:"•",none:"—"}[v]||"✧"):"✧";}
   button.append(swatch,E("span",label(v)));button.onclick=()=>set(key,v);group.append(button);
  }options.append(group);
 }
 function color(title,key,value){const row=E("label",title,"sl-plus-studio-color"),picker=E("input"),clear=E("button","Default");picker.type="color";picker.value=/^#[0-9a-f]{6}$/i.test(value)?value:"#a78bfa";picker.setAttribute("aria-label",title);picker.oninput=()=>set(key,picker.value);clear.type="button";clear.onclick=e=>{e.preventDefault();set(key,"default");};row.append(picker,clear);options.append(row);}
 function renderOptions(){
  options.replaceChildren();
  if(category==="cover")tiles("Profile backgrounds","cover",covers,"cover");
  if(category==="frame"){tiles("Avatar rings","frame",frames,"frame");color("Custom ring colour","frame",draft.frame);}
  if(category==="effect")tiles("Live studying card effects","effect",effects,"effect");
  if(category==="bubble")tiles("Chat bubble colours","bubble",bubbles,"bubble");
  if(category==="pet"){tiles("Robot finish","pet",pets,"pet");tiles("Body shape","details.shape",petShapes);tiles("Eye shape","details.eyes",petEyes);color("Eye colour","details.eyeColor",draft.details.eyeColor);tiles("Aura","details.glow",petGlows);tiles("Mouth","details.mouth",petMouths);}
  if(category==="timer"){tiles("Floating timer layout","timer",timerModes);color("Timer glow","details.timerAccent",draft.details.timerAccent);}
  refresh();
 }
 for(const [key,title] of Object.entries(groupNames)){const button=E("button",title);button.type="button";button.dataset.category=key;button.onclick=()=>{category=key;renderOptions();};tabs.append(button);}
 reset.onclick=()=>{draft=appearance({active:true});renderOptions();message.textContent="Defaults previewed. Apply to save.";};
 apply.onclick=async()=>{apply.disabled=true;try{
  if(account.getUser()?.id!==user.id)throw Error("Session changed. Reopen the studio.");
  const latest=await profileState(user.id);if(account.getUser()?.id!==user.id)throw Error("Session changed.");
  if(!latest.active&&!hasPremiumDraft(draft)){editor.close();return;}
  if(!latest.active){message.textContent="Your preview is unchanged. Choose Plus to apply.";await open("your selected designs");return;}
  await saveAppearance(draft.cover,draft.frame,{effect:draft.effect,bubble:draft.bubble,pet:draft.pet,timer:draft.timer,details:draft.details});editor.close();
 }catch(e){message.textContent=e.message||"Could not save appearance.";}finally{apply.disabled=false;}};
 controls.append(tabs,options);layout.append(previewPane,controls);editor.append(header,note,layout,message,actionBar);
 editor.addEventListener("close",()=>{editor.remove();if(studio===editor)studio=null;previous?.focus?.({preventScroll:true});});d.body.append(editor);renderOptions();try{editor.showModal();}catch(_){editor.remove();studio=null;}
}
function profileEditor(panel,id){
 panel.querySelector(".sl-plus-customize")?.remove();
 const a=root.StudyLabAccount,u=a?.getUser?.();if(!eligible(u)||u.id!==id)return;
 const b=E("button","✦ Plus Studio","sl-plus-profile-entry sl-plus-customize");b.type="button";b.onclick=()=>void openStudio("cover");panel.querySelector(".sl-pv-actions")?.append(b);
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
  const card=E("section",null,"sl-plus-plan"+(plus?" is-plus":""));card.append(E("h3",plus?"✦ StudyLab Plus":"StudyLab Free"),E("strong",plus?"Rs. 199 / month":"Rs. 0","sl-plus-price"),E("p",plus?"Choose your billing period":"All essential learning tools"));
  if(plus){const choices=E("div",null,"sl-plus-duration-grid");const price=card.querySelector(".sl-plus-price");let selected=plans[0];for(const plan of plans){const choice=E("button",null,"sl-plus-duration");choice.type="button";choice.dataset.months=String(plan.months);choice.setAttribute("aria-pressed",String(plan===selected));choice.append(E("strong",plan.label),E("span","Rs. "+plan.price.toLocaleString("en-LK")),E("small",plan.months===1?"Per month":"Save Rs. "+(199*plan.months-plan.price)));choice.onclick=()=>{selected=plan;price.textContent="Rs. "+plan.price.toLocaleString("en-LK")+" / "+(plan.months===1?"month":plan.months+" months");for(const item of choices.children)item.setAttribute("aria-pressed",String(item.dataset.months===String(plan.months)));};choices.append(choice);}card.append(choices);}
  const action=E("button",plus?(currentDemo()?"Plus demo active":state.active?"Membership active":"Checkout not available yet"):(currentDemo()?"Free plan (demo)":state.active?"Free plan":"Your current plan"),"sl-plus-action");action.type="button";action.disabled=true;if(preview&&plus){action.disabled=false;action.textContent=currentDemo()?"Switch to Free demo":"Try Plus demo";action.onclick=()=>{if(root.StudyLabAccount?.getUser?.()?.id!==session){close();return;}setDemo(!currentDemo());close();};}card.append(action);
  const list=E("ul");for(const f of (plus?["Everything in Free",...planned]:core))list.append(E("li",f));card.append(list);
  
  grid.append(card);
 }
 node.append(head,title,sub,banner,grid);

 node.append(E("p","Displayed prices are proposed launch prices. No charges in preview. Plus badge is separate from blue verification. Some benefits are still in development.","sl-plus-foot"));
 node.addEventListener("cancel",e=>{e.preventDefault();close();});node.addEventListener("close",()=>{node.remove();if(dialog===node){dialog=null;session=null;}previous?.focus?.({preventScroll:true});});
 d.body.append(node);try{node.showModal();x.focus();}catch(_){node.remove();dialog=null;session=null;}
}

const badgeQueue=new Set(),badgeCache=new Map();let badgeTimer=null,badgeBlockedUntil=0,badgeViewer=null;
const validId=id=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function renderNameBadge(node,id){
 const own=root.StudyLabAccount?.getUser?.()?.id===id,demo=own&&currentDemo(),cached=badgeCache.get(id);
 const show=demo||Boolean(cached?.active&&cached.until>Date.now());const state=demo?appearance({...demoAppearance,active:true}):show?appearance(cached):appearance(null);const surface=node.closest(".room-person-card,.room-rank,.study-chat-message");if(surface){if(surface.classList.contains("room-person-card"))surface.dataset.plusEffect=state.effect;else if(surface.classList.contains("study-chat-message"))surface.dataset.plusBubble=state.bubble;const avatar=surface.querySelector(".room-avatar,.study-chat-message-avatar");if(avatar){avatar.dataset.plusFrame=state.frame;avatar.style.removeProperty("--sl-plus-ring");if(/^#[0-9a-f]{6}$/i.test(state.frame)){avatar.dataset.plusFrame="custom";avatar.style.setProperty("--sl-plus-ring",state.frame);}}}
 let mark=node.querySelector(":scope > .sl-plus-inline-badge");
 if(!show){mark?.remove();return;}
 if(!mark){mark=E("small",null,"sl-plus-inline-badge");node.append(mark);}
 if(mark.textContent!=="✦ Plus")mark.textContent="✦ Plus";mark.title=demo?"Plus demo · Preview only":"StudyLab Plus";if(demo)mark.setAttribute("aria-label","StudyLab Plus demo");else mark.removeAttribute("aria-label");
}
function decorateName(node,id){
 if(!node)return;
 if(node.closest(".sl-pv-dialog"))return; // Profile view has a dedicated badge and appearance.
 node.dataset.slPlusUser=validId(id)?id:"";
 renderNameBadge(node,id);
 if((preview&&id===root.StudyLabAccount?.getUser?.()?.id)||!validId(id)||badgeBlockedUntil>Date.now()||badgeCache.get(id)?.until>Date.now())return;
 badgeQueue.add(id);
 if(!badgeTimer)badgeTimer=setTimeout(flushBadges,100);
}
async function flushBadges(){
 badgeTimer=null;const a=root.StudyLabAccount;await a?.ready;const viewer=a?.getUser?.();const ids=[...badgeQueue].slice(0,100);ids.forEach(id=>badgeQueue.delete(id));if(!eligible(viewer)||!ids.length)return;
 if(badgeViewer!==viewer.id){badgeCache.clear();badgeViewer=viewer.id;}
 try{const result=await a.client.rpc("studylab_plus_public_styles",{p_users:ids});if(a.getUser()?.id!==viewer.id)return;if(result.error)throw result.error;
 const members=result.data&&typeof result.data==="object"?result.data:{};for(const id of ids)badgeCache.set(id,{...appearance(members[id]),until:Date.now()+60000});
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
 const uid=session?.user?.id||null;if(event==="SIGNED_OUT"||(badgeViewer&&badgeViewer!==uid)){badgeCache.clear();badgeQueue.clear();badgeViewer=uid;demoUser=null;demoAppearance=appearance(null);persistDemo();setTimeout(()=>{close();studio?.close();changed();},0);}
});

root.StudyLabPlus=Object.freeze({status,sync,open,adFree,filterSponsored,refreshProfile,clearProfile,decorateName,ownAppearance,savePreference,openStudio,paintPet});
})(typeof window!=="undefined"?window:globalThis);
