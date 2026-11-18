/* Native markup adapters for administrator-published StudyLab resources.
   Existing hard-coded cards and their layouts are left untouched. */
(function(){
"use strict";
if(window.StudyLabSpecialResources)return;
const el=(tag,cls,text)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined&&text!==null)node.textContent=String(text);
 return node;
};
const telegramSvg="assets/images/telegram-doodles/brand-telegram.svg";
function validChannelImage(raw){
  const value=String(raw||"").trim();
  if(!value)return "";
  if(window.StudyLabAdminConfig?.mode==="preview" &&
     /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value))return value;
  try{
    if(value.startsWith("//")||/[\u0000-\u0020\u007f\\]/.test(value))return "";
    const url=new URL(value,location.href);
    return ((url.protocol==="https:" ||
      (url.protocol==="http:" && url.origin===location.origin)) &&
      !url.username && !url.password) ? url.href : "";
  }catch(_){return "";}
}
function channelAvatar(d,featured=false){
  const wrap=el(featured?"div":"span",
    (featured?"telegram-featured-avatar":"telegram-channel-icon")+" sl-cms-channel-avatar");
  const fallback=featured?el("span","telegram-featured-avatar-fallback sl-cms-avatar-fallback"):wrap;
  const logo=el("img");logo.src=telegramSvg;logo.alt="";
  logo.setAttribute("aria-hidden","true");fallback.append(logo);
  if(featured)wrap.append(fallback);
  const photoURL=validChannelImage(d.image);
  if(photoURL){
    const photo=el("img","sl-cms-avatar-photo");
    photo.src=photoURL;photo.alt="";photo.loading="lazy";
    photo.addEventListener("error",()=>photo.remove());
    wrap.append(photo);
  }
  return wrap;
}
function setDestination(a,href){
 a.href=href;
 a.target=new URL(href,location.href).origin!==location.origin?"_blank":"_self";
 if(a.target==="_blank")a.rel="noopener noreferrer";
 else a.removeAttribute("rel");
}
function apply(d,href){
 if(!["simulation","telegram","lesson-pack"].includes(d.resource_type))return false;
 let card=document.querySelector('[data-cms-id="'+CSS.escape(d.id)+'"]');
 const kind=d.resource_type;
 const sponsored=kind==="telegram"&&d.telegram_category==="sponsored";
 const host=kind==="simulation"
     ?document.querySelector(".tool-grid")
     :kind==="lesson-pack"
       ?document.querySelector(".sl-lessons-publisher-grid")
       :findTelegramHost(d.telegram_category||"all");
 if(!host)return false;
 const requiredClass=kind==="simulation"?"tool-card":
     kind==="lesson-pack"?"sl-lesson-publisher-card":
     sponsored?"telegram-featured-channel":
     d.telegram_category==="all"?"telegram-all-channel":"telegram-channel";
 const tag=sponsored?"section":"a";
 if(card && (card.tagName.toLowerCase()!==tag||!card.classList.contains(requiredClass))){
   card.remove();card=null;
 }
 if(!card){
   card=el(tag,requiredClass+" sl-cms-special"+(sponsored?" sl-cms-sponsored":""));
   card.dataset.cmsId=d.id;
   host.append(card);
 }
 if(card.parentElement!==host)host.append(card);
 card.hidden=Boolean(d.hidden);
 card.dataset.cmsOrder=String(d.order??100);
 if(sponsored)card.removeAttribute("href");
 else setDestination(card,href);
 card.setAttribute("aria-label",
   (sponsored?"Featured Telegram channel: ":"")+
   String(d.resource_title||d.title||"Open resource"));
 card.replaceChildren();
 if(kind==="simulation"){
   const icon=el("span","card-icon",d.emoji||"🔬");
   const title=el("h3",null,d.title);
   const description=el("p",null,d.description||d.topic||d.lesson_name||"Interactive learning");
   const open=el("span","open-tool-btn",d.button_label||"Open Tool");
   card.dataset.lesson=String(d.lesson_number||"");
   card.dataset.filterCategory=d.maths_category||"";
   card.append(icon,title,description,open);
   return true;
 }
 if(kind==="telegram"){
   // Match the existing wide featured card, including the Join button layout.
   if(sponsored){
     const avatar=channelAvatar(d,true);
     const copy=el("div","telegram-featured-copy");
     copy.append(el("span","telegram-featured-eyebrow","✦ Featured Channel"),
       el("h2",null,d.resource_title||d.title),
       el("p",null,d.description||"StudyLab educational channel"),
       el("span","telegram-featured-count",
         "👥 ග්‍රාහකයින්ගේ වත්මන් ගණන Telegram තුළ බලන්න"));
     const action=el("div","telegram-featured-action");
     const join=el("a","telegram-open");
     setDestination(join,href);
     const logo=el("img");logo.src=telegramSvg;logo.alt="";
     logo.setAttribute("aria-hidden","true");
     join.append(logo,document.createTextNode(" Join Channel"));
     const note=el("small");
     note.append(document.createTextNode("Current subscriber count"),
       el("br"),document.createTextNode("shown on Telegram"));
     action.append(join,note);
     card.append(avatar,copy,action);
     return true;
   }
   // Emoji values from older cards remain stored for compatibility, but a
   // channel without an uploaded profile picture always shows Telegram.
   const icon=channelAvatar(d);
   const copy=el("span");
   copy.append(el("strong",null,d.resource_title||d.title),
     el("span",null,d.description||"StudyLab educational channel"));
   const action=el("span","telegram-open");
   const image=el("img");image.src=telegramSvg;image.alt="";
   image.setAttribute("aria-hidden","true");
   action.append(image,document.createTextNode(" "+(d.button_label||"Open Channel")));
   card.append(icon,copy,action);
   return true;
 }
 if(kind==="lesson-pack"){
   const identity=el("span","sl-lesson-publisher-identity");
   identity.append(
     el("span","sl-lesson-publisher-mark",d.emoji||"📚"),
     el("span","sl-lesson-publisher-topline","FREE "+String(d.subject||"A/L").toUpperCase()+" · 2027 A/L")
   );
   const body=el("span","sl-lesson-publisher-body");
   body.append(el("strong","sl-lesson-publisher-title",d.resource_title||d.title),
     el("span","sl-lesson-publisher-series",d.series||d.publisher||"STUDYLAB LESSON PACK"),
     el("span","sl-lesson-publisher-description",d.description));
   const topics=el("span","sl-lesson-publisher-topics");
   if(d.publisher)topics.append(el("span",null,d.publisher));
   const action=el("span","sl-lesson-publisher-action");
   action.append(el("span",null,d.button_label||"View Lessons"));
   card.append(identity,body,topics,action);
   if(d.image){
     const picture=el("img","sl-cms-lesson-image");
     picture.alt="";picture.loading="lazy";picture.src=d.image;
     identity.prepend(picture);
   }
   return true;
 }
 return false;
}
function findTelegramHost(group){
 if(group==="all")return document.querySelector(".telegram-all-grid");
 if(group==="sponsored"){
   let host=document.querySelector("[data-cms-sponsored]");
   if(!host){
     const featured=document.querySelector(".telegram-featured-channel");
     host=el("div","sl-cms-sponsored-grid");
     host.dataset.cmsSponsored="";
     if(featured)featured.after(host);
     else document.querySelector("main")?.prepend(host);
   }
   return host;
 }
 const heading={
   maths:"mathematics",biology:"biology",chemistry:"chemistry",physics:"physics"
 }[group];
 return [...document.querySelectorAll(".telegram-subject")]
   .find(section=>section.querySelector("h2")?.textContent.trim().toLowerCase().includes(heading))||
   document.querySelector(".telegram-all-grid");
}
window.StudyLabSpecialResources=Object.freeze({apply});
})();