/* Plus launch preview. No payment collection or browser-side entitlement grants. */
(function(root){
"use strict";
const core=["Live Study Room and standard timer","Social and Chat","Past papers and simulations","Existing profile pictures and themes","Tasks, notes and bookmarks","Guardian safety screening"];
const planned=["Plus membership badge","Premium profile covers, icon packs and avatar rings","Live study card gradients, doodles and glow","Daily and weekly leaderboard colours and doodles","Custom studying cards and chat bubbles","Chat bubble colours and 5 extra message fonts","Pet body shapes, eye styles, colours and auras","Compact and micro floating timer","Premium Home and Study Room backgrounds","Advanced personal study reports"];const future=[];
function normalize(s){return {enabled:s?.enabled===true,active:s?.active===true&&s?.enabled===true,granted:s?.granted===true,expires_at:s?.expires_at||null,billing_ready:false};}
function eligible(u){return Boolean(u?.id&&!u.is_anonymous);}
function demoAllowed(host){return /^deploy-preview-[0-9]+--studylablk\.netlify\.app$/.test(host)||["localhost","127.0.0.1"].includes(host);}
const covers=["default","aurora","ocean","sunset","galaxy","nebula","starlight","mountains","forest","sakura","midnight","prism"],frames=["default","violet","cyan","gold","rose","mint","silver","rainbow"];
function validFrame(value){return typeof value==="string"&&(frames.includes(value)||/^#[0-9a-f]{6}$/i.test(value));}
const effects=["default","aurora","galaxy","pulse","sakura","ocean"],bubbles=["default","violet","cyan","rose","mint","gold"],pets=["default","nebula","mint","rose","gold"],timerModes=["standard","compact","micro"];
const plans=Object.freeze([{months:1,price:199,label:"Monthly"},{months:3,price:499,label:"3 months"},{months:12,price:1799,label:"Yearly"}]);
const petShapes=["default","teardrop","square","orb"],petEyes=["default","round","pixel","arc","visor","softsquare","droplet","focused","sleepy","happy"],petGlows=["default","none","soft","neon","galaxy","spark"],petMouths=["default","smile","dot","none"];
const workspaces=["default","aurora","ocean","galaxy","forest","sunset","prism"];
const colorValue=(v)=>typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():"default";
function details(v){return {shape:petShapes.includes(v?.shape)?v.shape:"default",eyes:petEyes.includes(v?.eyes)?v.eyes:"default",glow:petGlows.includes(v?.glow)?v.glow:"default",mouth:petMouths.includes(v?.mouth)?v.mouth:"default",eyeColor:colorValue(v?.eyeColor),timerAccent:"default",workspace:workspaces.includes(v?.workspace)?v.workspace:"default",rankDailyColor:colorValue(v?.rankDailyColor),rankWeeklyColor:colorValue(v?.rankWeeklyColor),rankPattern:patterns.includes(v?.rankPattern)?v.rankPattern:"default"};}
const patterns=["default","none","science","space","nature","music","books"],cardGlows=["default","none","soft","neon","halo"],chatFonts=["default","clean","classic","mono","italic","rog"];
function appearance(s){const active=s?.active===true;return {active,cover:active&&covers.includes(s.cover)?s.cover:"default",frame:active&&validFrame(s.frame)?s.frame:"default",effect:active&&effects.includes(s.effect)?s.effect:"default",bubble:active&&bubbles.includes(s.bubble)?s.bubble:"default",pet:active&&pets.includes(s.pet)?s.pet:"default",timer:active&&timerModes.includes(s.timer)?s.timer:"standard",details:details(active?s.details:null),pattern:active&&patterns.includes(s.pattern)?s.pattern:"default",cardPattern:active&&patterns.includes(s.cardPattern)?s.cardPattern:"default",cardGlow:active&&cardGlows.includes(s.cardGlow)?s.cardGlow:"default",chatFont:active&&chatFonts.includes(s.chatFont)?s.chatFont:"default",rankDailyColor:active?colorValue(s.details?.rankDailyColor??s.rankDailyColor):"default",rankWeeklyColor:active?colorValue(s.details?.rankWeeklyColor??s.rankWeeklyColor):"default",rankPattern:active&&patterns.includes(s.details?.rankPattern??s.rankPattern)?(s.details?.rankPattern??s.rankPattern):"default"};}
function hasPremiumDraft(s){const a=appearance({...s,active:true}),base=appearance({active:true});return JSON.stringify(a)!==JSON.stringify(base);}
function sponsored(item){return item?.kind==="sponsored"||item?.design?.preset==="sponsored";}
function filterSponsored(items){return items;}
if(typeof module!=="undefined"&&module.exports){module.exports={normalize,core,planned,eligible,demoAllowed,appearance,sponsored,filterSponsored,validFrame,covers,frames,effects,bubbles,pets,timerModes,plans,details,petShapes,petEyes,petGlows,petMouths,hasPremiumDraft,patterns,cardGlows,chatFonts,workspaces};return;}
const d=root.document;
// Optional styling shared by profile, chat, live cards and both leaderboard views.
if(d.head&&!d.querySelector('link[data-sl-plus-ranks]')){const css=d.createElement("link");css.rel="stylesheet";css.href="/assets/css/studylab-plus-ranks.css?v=plus-10";css.dataset.slPlusRanks="true";d.head.append(css);}
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
 const r=await a.client.rpc("studylab_plus_save_appearance",{p_cover:next.cover,p_frame:next.frame,p_effect:next.effect,p_bubble:next.bubble,p_pet:next.pet,p_timer:next.timer,p_details:next.details,p_pattern:next.pattern,p_card_pattern:next.cardPattern,p_card_glow:next.cardGlow,p_chat_font:next.chatFont});if(r.error||a.getUser()?.id!==u.id)throw Error(r.error?.message||"Session changed.");badgeCache.delete(u.id);changed();
}
async function ownAppearance(){const a=root.StudyLabAccount;await a?.ready;return profileState(a?.getUser?.()?.id);}
async function savePreference(key,value){const s=await ownAppearance();if(!s.active){await open("Premium customization");return false;}const allowed={pet:pets,timer:timerModes,effect:effects,bubble:bubbles};if(!allowed[key]?.includes(value))return false;await saveAppearance(s.cover,s.frame,{[key]:value});return true;}
function paintAppearance(panel,avatar,state){
 avatar.dataset.plusActive=String(state.active);
 panel.dataset.plusCover=state.active?state.cover:"default";
 avatar.dataset.plusFrame=state.active?state.frame:"default";
 avatar.style.removeProperty("--sl-plus-ring");
 if(state.active&&/^#[0-9a-f]{6}$/i.test(state.frame)){avatar.dataset.plusFrame="custom";avatar.style.setProperty("--sl-plus-ring",state.frame);}
 paintMotifs(panel,state.active?(state.pattern==="default"?(state.cover==="default"?"none":state.cover==="forest"||state.cover==="sakura"?"nature":"space"):state.pattern):"none");
}
const motifPaths={
 science:["M9 3h6m-5 0v7l-6 9q-1 2 2 2h12q3 0 2-2l-6-9V3M7 16h10","M12 3c4 0 8 8 8 9s-4 9-8 9-8-8-8-9 4-9 8-9Zm-8 5c3-5 18 5 16 8S2 11 4 8Zm0 8c-2-3 13-13 16-8S7 21 4 16Z","M5 20V4m0 16h16M7 16l5-6 4 3 5-8"],
 space:["M12 3a8 8 0 1 0 8 8M3 17c-2-3 15-14 18-11s-14 14-18 11Z","M9 14c0-6 4-10 11-11 0 7-4 11-10 12l-1-1ZM9 14l-5 1 1-5 5-3m0 8-1 5 5-1 3-5M5 19l-2 2","M15 3a9 9 0 1 0 6 15A8 8 0 0 1 15 3Z"],
 nature:["M3 20C3 6 13 3 21 3c0 11-5 17-13 17M4 21 17 8","M12 21V9m0 4c-8 0-10-8-10-8 7 0 10 4 10 8Zm0 4c8 0 10-8 10-8-7 0-10 4-10 8Z","M4 18h16M5 18l5-10 4 6 3-5 4 9"],
 music:["M9 18V5l12-2v13M9 18a3 2 0 1 1-6 0 3 2 0 1 1 6 0Zm12-2a3 2 0 1 1-6 0 3 2 0 1 1 6 0Z","M4 13v-2a8 8 0 0 1 16 0v2M4 12h3v7H4Zm13 0h3v7h-3Z","M3 12h3l2-6 4 12 3-9 2 3h4"],
 books:["M3 4q5-2 9 2 4-4 9-2v15q-5-2-9 2-4-4-9-2ZM12 6v15","M4 20h16M6 16 18 4l3 3L9 19 4 20ZM15 7l3 3","M3 8l9-5 9 5-9 5-9-5Zm4 3v6q5 5 10 0v-6M21 8v7"]
};
function motif(pack,i){const paths=motifPaths[pack];if(!paths)return null;const svg=d.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.35");svg.setAttribute("stroke-linecap","round");svg.setAttribute("stroke-linejoin","round");const p=d.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",paths[i%paths.length]);svg.append(p);return svg;}
function paintMotifs(panel,pack){
 if(panel.dataset.plusMotifs===pack&&(!motifPaths[pack]||panel.querySelector(":scope > .sl-plus-floats")))return;
 panel.dataset.plusMotifs=pack;panel.querySelector(":scope > .sl-plus-floats")?.remove();
 if(!motifPaths[pack])return;
 const layer=E("div",null,"sl-plus-floats");layer.setAttribute("aria-hidden","true");
 for(let i=0;i<6;i++){const n=E("span");n.dataset.particle=String(i);n.append(motif(pack,i));layer.append(n);}panel.prepend(layer);
}
function paintCard(card,state){card.dataset.plusEffect=state.effect;card.dataset.plusCardGlow=state.cardGlow;paintMotifs(card,state.cardPattern==="default"?"none":state.cardPattern);}
function paintRank(row,state){
 const period=row.dataset.plusRankPeriod==="weekly"?"weekly":"daily";
 const value=state.active?(period==="weekly"?state.rankWeeklyColor:state.rankDailyColor):"default";
 const color=colorValue(value);
 row.dataset.plusRankColor=color==="default"?"default":"custom";
 row.style.removeProperty("--sl-plus-rank-color");
 if(color!=="default")row.style.setProperty("--sl-plus-rank-color",color);
 paintMotifs(row,state.active&&state.rankPattern!=="default"?state.rankPattern:"none");
}
function paintChat(card,state){card.dataset.plusBubble=state.bubble;card.dataset.plusChatFont=state.chatFont;}

function paintProfile(panel,avatar,name,state){
 paintAppearance(panel,avatar,state);
 panel.querySelector(".sl-plus-member-badge")?.remove();
 if(state.active){const mark=E("span",state.demo?"✦ Plus demo":"✦ Plus","sl-plus-member-badge");name.append(mark);}
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
 if(studio){if(studio.open)studio.focus();return;}
 const account=root.StudyLabAccount;await account?.ready;const user=account?.getUser?.();if(!eligible(user))return;
 if(!preview&&!(await status()).enabled)return;
 const saved=await profileState(user.id);if(account.getUser()?.id!==user.id||studio)return;
 let draft=appearance({...saved,active:true}),category=["cover","frame","effect","rank","bubble","pet","workspace"].includes(initial)?initial:"cover";
 const editor=E("dialog",null,"sl-plus-dialog sl-plus-studio");studio=editor;editor.setAttribute("aria-label","StudyLab Plus Studio");
 const previous=d.activeElement,header=E("header",null,"sl-plus-head"),heading=E("div"),closeButton=E("button","×","sl-plus-close");
 heading.append(E("span","STUDYLAB · CUSTOMIZATION","sl-plus-eyebrow"),E("h2","Plus Studio"));closeButton.type="button";closeButton.setAttribute("aria-label","Close without applying");closeButton.onclick=()=>editor.close();header.append(heading,closeButton);
 const note=E("p",saved.demo?"Demo mode · Changes apply only to this tab.":saved.active?"Preview your design, then apply it to your account.":"Explore every design for free. Plus is required only when applying premium changes.","sl-plus-notice");
 const layout=E("div",null,"sl-plus-studio-layout"),previewPane=E("section",null,"sl-plus-studio-preview"),controls=E("section",null,"sl-plus-studio-controls"),tabs=E("nav",null,"sl-plus-studio-tabs"),options=E("div",null,"sl-plus-studio-options");
 const sample=E("div",null,"sl-plus-appearance-sample"),sampleAvatar=E("div","✦","sl-plus-sample-avatar"),sampleName=E("strong","Your profile"),sampleBadge=E("small","✦ Plus","sl-plus-inline-badge");
 const profile=await Promise.resolve(account.getProfile?.()).catch(()=>null);if(account.getUser()?.id!==user.id){studio=null;return;}sampleName.textContent=profile?.display_name||"Your profile";editor.append(sampleName);root.StudyLabNameMark?.decorate(sampleName,user.id);sampleName.querySelector(".sl-plus-inline-badge")?.remove();delete sampleName.dataset.slPlusUser;sampleAvatar.textContent=(profile?.display_name||"S").trim().slice(0,1).toUpperCase();root.StudyLabAvatar?.decorate(sampleAvatar,user.id);sampleName.append(sampleBadge);sample.append(sampleAvatar,sampleName,E("small",profile?.username?"@"+profile.username:"Your profile appearance"));
 const live=E("article",null,"room-person-card sl-plus-live-sample");const liveAvatar=E("div",sampleAvatar.textContent,"sl-plus-sample-avatar sl-plus-live-avatar");root.StudyLabAvatar?.decorate(liveAvatar,user.id);const liveName=E("strong",profile?.display_name||"Student");live.append(liveAvatar,E("small","● Studying now"),liveName,E("small","Combined Mathematics"),E("strong","00:42:18"));
 const chat=E("article",null,"study-chat-message sl-plus-chat-sample");chat.append(E("strong",profile?.display_name||"You"),E("p","Ready for another study session.","study-chat-message-text"));
 const petBox=E("div",null,"sl-plus-pet-preview"),pet=E("div",null,"sl-pet-character sl-plus-pet-sample"),face=E("div",null,"sl-pet-visual");for(const side of ["left","right"]){const eye=E("div",null,"sl-pet-eye "+side);eye.append(E("i"));face.append(eye);}face.append(E("div",null,"sl-pet-mouth"));pet.append(face);petBox.append(pet,E("small","Your study companion"));
 
 const rankBox=E("section",null,"sl-plus-ranking-preview");
 const dailyRank=E("div",null,"room-rank sl-plus-rank-sample"),weeklyRank=E("div",null,"room-rank sl-plus-rank-sample");
 for(const [item,period] of [[dailyRank,"daily"],[weeklyRank,"weekly"]]){
  item.dataset.plusRankPeriod=period;
  item.append(E("span",period==="daily"?"1":"2","room-rank-number"),E("div","●","room-avatar"));
  const info=E("div",null,"room-rank-info");info.append(E("strong",profile?.display_name||"Student"),E("span",period==="daily"?"Daily leaderboard":"Weekly leaderboard"));
  item.append(info,E("span",period==="daily"?"04:35":"28:15","room-time"));rankBox.append(item);
 }
 const workspaceSample=E("div",null,"sl-plus-workspace-sample");workspaceSample.append(E("small","STUDYLAB"),E("strong","Your study workspace"),E("div","Live Study Room","sl-plus-workspace-sample-card"),E("div","Study resources","sl-plus-workspace-sample-card"));previewPane.append(E("small","LIVE PREVIEW · NOT SAVED","sl-plus-eyebrow"),sample,live,rankBox,chat,petBox,workspaceSample);
 const groupNames={cover:"Profile cover",frame:"Avatar ring",effect:"Study card",rank:"Ranking bars",bubble:"Chat bubble",pet:"Pet studio",workspace:"Workspace"};
 const label=v=>v==="default"?"Original":v[0].toUpperCase()+v.slice(1);
 const actionBar=E("footer",null,"sl-plus-studio-actions"),reset=E("button","Reset design","sl-plus-profile-entry"),apply=E("button",saved.active?"Apply style":"🔒 Apply style","sl-plus-profile-entry sl-plus-apply"),message=E("p",null,"sl-plus-studio-message");message.setAttribute("role","status");reset.type=apply.type="button";actionBar.append(reset,apply);
 function refresh(){
  paintAppearance(sample,sampleAvatar,draft);liveAvatar.dataset.plusActive="true";liveAvatar.dataset.plusFrame=sampleAvatar.dataset.plusFrame;liveAvatar.style.setProperty("--sl-plus-ring",sampleAvatar.style.getPropertyValue("--sl-plus-ring"));paintCard(live,draft);paintRank(dailyRank,{...draft,rankDailyColor:draft.details.rankDailyColor,rankWeeklyColor:draft.details.rankWeeklyColor,rankPattern:draft.details.rankPattern});paintRank(weeklyRank,{...draft,rankDailyColor:draft.details.rankDailyColor,rankWeeklyColor:draft.details.rankWeeklyColor,rankPattern:draft.details.rankPattern});paintChat(chat,draft);paintPet(pet,draft);
  sample.hidden=!["cover","frame"].includes(category);live.hidden=category!=="effect";rankBox.hidden=category!=="rank";chat.hidden=category!=="bubble";petBox.hidden=category!=="pet";workspaceSample.hidden=category!=="workspace";workspaceSample.dataset.plusWorkspace=draft.details.workspace;
  for(const button of tabs.children)button.setAttribute("aria-pressed",String(button.dataset.category===category));
  for(const button of options.querySelectorAll("[data-option-key]")){const k=button.dataset.optionKey;button.setAttribute("aria-pressed",String(button.dataset.choice==="custom"?/^#[0-9a-f]{6}$/i.test(k.startsWith("details.")?draft.details[k.slice(8)]:draft[k]):(k.startsWith("details.")?draft.details[k.slice(8)]:draft[k])===button.dataset.choice));}
 }
 function set(k,v){if(k.startsWith("details."))draft.details[k.slice(8)]=v;else draft[k]=v;refresh();}
 function tiles(title,key,values,kind){
  options.append(E("h3",title));const group=E("div",null,"sl-plus-tile-grid");for(const v of values){
   const button=E("button",null,"sl-plus-studio-tile");button.type="button";button.dataset.optionKey=key;button.dataset.choice=v;
   const swatch=E("span",null,"sl-plus-tile-swatch");if(kind==="cover")swatch.dataset.plusCover=v;else if(kind==="workspace")swatch.dataset.plusWorkspace=v;
   else if(kind==="frame"){const ring=E("span",null,"sl-plus-ring-swatch");const center=E("span",null,"sl-plus-ring-center");center.append(E("span","●"));ring.append(center);ring.dataset.plusFrame=v;swatch.append(ring);}
   else if(kind==="bubble"){swatch.dataset.plusBubble=v;swatch.classList.add("study-chat-message");swatch.textContent="Aa";}
   else if(kind==="effect"){swatch.dataset.plusEffect=v;swatch.classList.add("room-person-card");swatch.textContent="✧";}
   else if(kind==="pattern"){const icon=motif(v,0);if(icon)swatch.append(icon);else swatch.textContent=v==="none"?"×":"Auto";}
   else if(kind==="font"){swatch.dataset.plusChatFont=v;swatch.classList.add("sl-plus-font-swatch");swatch.textContent="Study 123";}
   else if(kind==="glow"){swatch.dataset.plusCardGlow=v;swatch.classList.add("sl-plus-glow-swatch");swatch.textContent="✧";}
   else if(kind==="color"){swatch.style.background=/^#[0-9a-f]{6}$/i.test(v)?v:"";swatch.textContent=v==="default"?"Auto":"";}
   else if(kind==="pet"){const mini=E("span","••","sl-plus-pet-tile");mini.dataset.pet=v;swatch.append(mini);}
   else if(key==="details.eyes"){const face=E("span",null,"sl-plus-eye-tile");face.dataset.plusEyes=v;for(const side of ["left","right"]){const eye=E("span",null,"sl-plus-eye-tile-"+side);face.append(eye);}swatch.append(face);}
   else{swatch.textContent=key==="details.eyes"?({default:"▮ ▮",round:"● ●",pixel:"■ ■",arc:"⌒ ⌒"}[v]||"✧"):key==="details.shape"?({default:"▢",teardrop:"◕",square:"□",orb:"○"}[v]||"✧"):key==="timer"?"00:42":key==="details.mouth"?({default:"⌣",smile:"◡",dot:"•",none:"—"}[v]||"✧"):"✧";}
   button.append(swatch,E("span",kind==="color"&&v!=="default"?v.toUpperCase():label(v)));button.onclick=()=>set(key,v);group.append(button);
  }if(kind==="frame"||kind==="color"){const custom=E("button",null,"sl-plus-studio-tile");custom.type="button";custom.dataset.optionKey=key;custom.dataset.choice="custom";const swatch=E("span","◉","sl-plus-tile-swatch sl-plus-custom-swatch");custom.append(swatch,E("span","Custom"));const palette=E("div",null,"sl-plus-custom-palette");palette.hidden=true;const picker=E("input");picker.type="color";picker.setAttribute("aria-label","Custom colour");const value=k=>k.startsWith("details.")?draft.details[k.slice(8)]:draft[k];picker.value=/^#[0-9a-f]{6}$/i.test(value(key))?value(key):"#a78bfa";picker.oninput=()=>set(key,picker.value);for(const hex of ["#60a5fa","#a78bfa","#f9a8d4","#fbbf24","#34d399","#22d3ee","#e2e8f0","#f87171"]){const choice=E("button");choice.type="button";choice.style.background=hex;choice.setAttribute("aria-label",hex);choice.onclick=()=>{picker.value=hex;set(key,hex);};palette.append(choice);}palette.append(picker);custom.onclick=()=>{palette.hidden=!palette.hidden;custom.setAttribute("aria-expanded",String(!palette.hidden));};group.append(custom);options.append(group,palette);}else options.append(group);
 }
 function renderOptions(){
  options.replaceChildren();
  if(category==="workspace")tiles("Workspace backgrounds","details.workspace",workspaces,"workspace");
  if(category==="cover"){tiles("Profile backgrounds","cover",covers,"cover");tiles("Profile icon packs","pattern",patterns,"pattern");}
  if(category==="frame")tiles("Avatar rings","frame",frames,"frame");
  if(category==="effect"){tiles("Live studying card effects","effect",effects,"effect");tiles("Card watermark","cardPattern",patterns,"pattern");tiles("Card glow","cardGlow",cardGlows,"glow");}
  if(category==="rank"){tiles("Daily ranking colour","details.rankDailyColor",["default","#a78bfa","#22d3ee","#34d399","#f472b6","#fbbf24"],"color");tiles("Weekly ranking colour","details.rankWeeklyColor",["default","#a78bfa","#22d3ee","#34d399","#f472b6","#fbbf24"],"color");tiles("Ranking bar doodles","details.rankPattern",patterns,"pattern");}
  if(category==="bubble"){tiles("Chat bubble colours","bubble",bubbles,"bubble");tiles("Message typeface","chatFont",chatFonts,"font");}
  if(category==="pet"){tiles("Robot finish","pet",pets,"pet");tiles("Body shape","details.shape",petShapes);tiles("Eye shape","details.eyes",petEyes);tiles("Eye colour","details.eyeColor",["default","#5de7ff","#bba0ff","#ffb6db","#8bffcb","#ffda7a"],"color");tiles("Aura","details.glow",petGlows);tiles("Mouth","details.mouth",petMouths);}
  refresh();
 }
 for(const [key,title] of Object.entries(groupNames)){const button=E("button",title);button.type="button";button.dataset.category=key;button.onclick=()=>{category=key;renderOptions();layout.scrollTop=0;};tabs.append(button);}
 reset.onclick=()=>{draft=appearance({active:true,timer:saved.timer});renderOptions();message.textContent="Defaults previewed. Apply to save.";};
 apply.onclick=async()=>{apply.disabled=true;try{
  if(account.getUser()?.id!==user.id)throw Error("Session changed. Reopen the studio.");
  const latest=await profileState(user.id);if(account.getUser()?.id!==user.id)throw Error("Session changed.");
  
  if(!latest.active){message.textContent="Your preview is unchanged. Choose Plus to apply.";await open("your selected designs");return;}
  await saveAppearance(draft.cover,draft.frame,{effect:draft.effect,bubble:draft.bubble,pet:draft.pet,timer:draft.timer,details:draft.details,pattern:draft.pattern,cardPattern:draft.cardPattern,cardGlow:draft.cardGlow,chatFont:draft.chatFont});editor.close();
 }catch(e){message.textContent=e.message||"Could not save appearance.";}finally{apply.disabled=false;}};
 controls.append(options);layout.append(controls,previewPane);editor.append(header,note,tabs,layout,message,actionBar);
 const updateApply=async()=>{const state=await profileState(user.id);if(studio!==editor||account.getUser()?.id!==user.id)return;apply.textContent=state.active?"Apply style":"🔒 Apply style";apply.dataset.locked=String(!state.active);};void updateApply();d.addEventListener("studylab:plus-changed",updateApply);
 editor.addEventListener("close",()=>{d.removeEventListener("studylab:plus-changed",updateApply);editor.remove();if(studio===editor)studio=null;previous?.focus?.({preventScroll:true});});d.body.append(editor);renderOptions();try{editor.showModal();}catch(_){editor.remove();studio=null;}
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
function clearProfile(panel,avatar){refreshGeneration.set(panel,(refreshGeneration.get(panel)||0)+1);panel.querySelector(".sl-plus-member-badge")?.remove();panel.querySelector(".sl-plus-customize")?.remove();delete panel.dataset.plusCover;delete panel.dataset.plusMotifs;delete avatar.dataset.plusFrame;delete avatar.dataset.plusActive;avatar.style.removeProperty("--sl-plus-ring");panel.querySelector(":scope > .sl-plus-floats")?.remove();}
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
  if (plus) {
    const choices = E("div", null, "sl-plus-duration-grid");
    const price = card.querySelector(".sl-plus-price");
    const reward = E("p", null, "sl-plus-xp-note");
    reward.setAttribute("aria-live", "polite");
    function selectPlan(plan) {
      const amount = plan.price.toLocaleString("en-LK");
      price.textContent = "Rs. " + amount + " / " + (plan.months === 1 ? "month" : plan.months + " months");
      reward.textContent = "This purchase adds " + amount + " XP to your total once your payment is confirmed.";
      for (const item of choices.children) {
        item.setAttribute("aria-pressed", String(item.dataset.months === String(plan.months)));
      }
    }
    for (const plan of plans) {
      const choice = E("button", null, "sl-plus-duration");
      choice.type = "button";
      choice.dataset.months = String(plan.months);
      choice.append(E("strong", plan.label), E("span", "Rs. " + plan.price.toLocaleString("en-LK")),
        E("small", plan.months === 1 ? "Per month" : "Save Rs. " + (plans[0].price * plan.months - plan.price)));
      choice.addEventListener("click", () => selectPlan(plan));
      choices.append(choice);
    }
    selectPlan(plans[0]);
    card.insertBefore(reward, price.nextSibling);
    card.append(choices);
  }
  const action=E("button",plus?(currentDemo()?"Plus demo active":state.active?"Membership active":"Checkout not available yet"):(currentDemo()?"Free plan (demo)":state.active?"Free plan":"Your current plan"),"sl-plus-action");action.type="button";action.disabled=true;if(preview&&plus){action.disabled=false;action.textContent=currentDemo()?"Switch to Free demo":"Try Plus demo";action.onclick=()=>{if(root.StudyLabAccount?.getUser?.()?.id!==session){close();return;}setDemo(!currentDemo());close();};}card.append(action);
  const list=E("ul");for(const f of (plus?["Everything in Free",...planned]:core))list.append(E("li",f));card.append(list);
  
  grid.append(card);
 }
 node.append(head,title,sub,banner,grid);if(future.length)node.append(E("p","Planned, not yet available: "+future.join(" · "),"sl-plus-foot"));

 node.append(E("p","Displayed prices are proposed launch prices. No charges in preview. Plus badge is separate from blue verification. Some benefits are still in development.","sl-plus-foot"));
 node.addEventListener("cancel",e=>{e.preventDefault();close();});node.addEventListener("close",()=>{node.remove();if(dialog===node){dialog=null;session=null;}previous?.focus?.({preventScroll:true});});
 d.body.append(node);try{node.showModal();x.focus();}catch(_){node.remove();dialog=null;session=null;}
}

const badgeQueue=new Set(),badgeCache=new Map();let badgeTimer=null,badgeBlockedUntil=0,badgeViewer=null;
const validId=id=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function renderNameBadge(node,id){
 const own=root.StudyLabAccount?.getUser?.()?.id===id,demo=own&&currentDemo(),cached=badgeCache.get(id);
 const show=demo||Boolean(cached?.active&&cached.until>Date.now());const state=demo?appearance({...demoAppearance,active:true}):show?cached:appearance(null);const surface=node.closest(".room-person-card,.room-rank,.study-chat-message");if(surface){if(surface.classList.contains("room-person-card"))paintCard(surface,state);else if(surface.classList.contains("room-rank"))paintRank(surface,state);else if(surface.classList.contains("study-chat-message"))paintChat(surface,state);const avatar=surface.querySelector(".room-avatar,.study-chat-message-avatar");if(avatar){avatar.dataset.plusActive=String(state.active);avatar.dataset.plusFrame=state.frame;avatar.style.removeProperty("--sl-plus-ring");if(/^#[0-9a-f]{6}$/i.test(state.frame)){avatar.dataset.plusFrame="custom";avatar.style.setProperty("--sl-plus-ring",state.frame);}}}
 let mark=node.querySelector(":scope > .sl-plus-inline-badge");
 if(!show){mark?.remove();return;}
 if(!mark){mark=E("small",null,"sl-plus-inline-badge");node.append(mark);}
 if(mark.textContent!=="✦ Plus")mark.textContent="✦ Plus";mark.title=demo?"Plus demo · Preview only":"StudyLab Plus";if(demo)mark.setAttribute("aria-label","StudyLab Plus demo");else mark.removeAttribute("aria-label");
}
function decorateName(node,id){
 if(!node)return;
 if(node.closest(".sl-pv-dialog,.sl-plus-studio"))return; // Profile view has a dedicated badge and appearance.
 node.dataset.slPlusUser=validId(id)?id:"";
 renderNameBadge(node,id);
 if((preview&&id===root.StudyLabAccount?.getUser?.()?.id)||!validId(id)||badgeBlockedUntil>Date.now()||badgeCache.get(id)?.until>Date.now())return;
 badgeQueue.add(id);
 if(!badgeTimer)badgeTimer=setTimeout(flushBadges,100);
}
async function flushBadges(){
 badgeTimer=null;const a=root.StudyLabAccount;await a?.ready;const viewer=a?.getUser?.();const ids=[...badgeQueue].slice(0,100);ids.forEach(id=>badgeQueue.delete(id));if(!viewer?.id||!ids.length)return;
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

async function attachMenu(menu,closeMenu,reposition){const anchor=menu.querySelector('[data-account-action="profile"]');const account=root.StudyLabAccount;const user=account?.getUser?.();if(!anchor||!eligible(user))return;const state=preview?await ownAppearance():await status();if(!anchor.isConnected||account.getUser()?.id!==user.id||(!preview&&!state.enabled))return;const b=E("button");b.type="button";b.setAttribute("role","menuitem");b.className="sl-plus-menu-entry";const icon=E("span","✦","account-menu-icon");icon.setAttribute("aria-hidden","true");const copy=E("span",null,"account-menu-copy");copy.append(E("strong",state.active?"Plus Studio Customizations":"Try StudyLab Plus"),E("small",state.active?"Personalize your study workspace":"Explore membership plans"));b.append(icon,copy);b.onclick=()=>{closeMenu();if(state.active)void openStudio("cover");else void open();};anchor.after(b);reposition?.();}
let workspaceGeneration=0;
async function refreshWorkspace(){const generation=++workspaceGeneration;const account=root.StudyLabAccount;const user=account?.getUser?.();const state=await ownAppearance();if(generation!==workspaceGeneration||account?.getUser?.()?.id!==user?.id)return;if(!d.body)return;const isHome=/(?:^\/|\/index\.html)$/.test(root.location.pathname),isRoom=d.body.classList.contains("study-room-page");if(!isHome&&!isRoom)return;if(state.active&&state.details.workspace!=="default")d.body.dataset.plusWorkspace=state.details.workspace;else delete d.body.dataset.plusWorkspace;}
d.addEventListener("studylab:plus-changed",refreshWorkspace);Promise.resolve(root.StudyLabAccount?.ready).then(refreshWorkspace).catch(()=>{});
root.StudyLabPlus=Object.freeze({attachMenu,status,sync,open,adFree,filterSponsored,refreshProfile,clearProfile,decorateName,ownAppearance,savePreference,openStudio,paintPet});
})(typeof window!=="undefined"?window:globalThis);
