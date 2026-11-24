/* StudyLab workspace: local settings, notes and existing resource dashboard integration. */
(function(root){
"use strict";
function deviceType(n={}){
 const u=String(n.userAgent||""),p=String(n.platform||"");
 if(/iPad|Tablet|PlayBook|Silk/i.test(u)||(/Mac/i.test(p)&&Number(n.maxTouchPoints)>1)||(/Android/i.test(u)&&!/Mobile/i.test(u)))return "tablet";
 if(n.userAgentData?.mobile===true||/iPhone|iPod|Windows Phone|Android.*Mobile|Mobile/i.test(u))return "mobile";
 if(n.userAgentData?.mobile===false||/Windows|Macintosh|MacIntel|Linux|CrOS|X11/i.test(u+" "+p))return "desktop";
 return "unknown";
}
function aggregatePresence(state){const counts={desktop:0,mobile:0,tablet:0,unknown:0};for(const a of Object.values(state||{})){if(!Array.isArray(a)||!a.length)continue;const k=a[a.length-1]?.device_type;counts[["desktop","mobile","tablet"].includes(k)?k:"unknown"]++;}return counts;}
if(typeof module!=="undefined"&&module.exports){module.exports={deviceType,aggregatePresence};return;}
if(/\/admin\.html$/i.test(root.location.pathname)){root.StudyLabWorkspace=Object.freeze({deviceType,aggregatePresence});return;}
const d=root.document,KEY="studylab-workspace-settings-v1",PREFIX="studylab-workspace-note-v1:";
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch(_){return f;}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}}
let prefs=read(KEY,{});
function apply(){d.documentElement.dataset.slFocus=prefs.focus===true?"on":"off";d.documentElement.dataset.slLite=prefs.lite===true?"on":"off";root.dispatchEvent(new Event("studylab-workspace-settings"));}
function setPreference(name,value){if(!["focus","lite"].includes(name))return false;prefs={...prefs,[name]:!!value};const ok=write(KEY,prefs);apply();return ok;}
apply();root.addEventListener("storage",e=>{if(e.key===KEY){prefs=read(KEY,{});apply();}});
const E=(tag,text,cls)=>{const x=d.createElement(tag);if(text!=null)x.textContent=text;if(cls)x.className=cls;return x;};
const B=(label,fn)=>{const b=E("button",label,"slws-button");b.type="button";b.addEventListener("click",fn);return b;};
function url(value){try{const u=new URL(value,location.href);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
function resources(host,items,remove=false){
 host.replaceChildren();if(!items.length){host.append(E("p",remove?"Save learning resources with their favorite star or the Save button in Recent.":"No learning resources opened yet.","slws-muted"));return;}
 for(const item of items){const href=url(item.url);if(!href)continue;const row=E("div",null,"slws-resource"),a=E("a",null,"slws-resource-link");a.href=href;a.append(E("strong",item.title||"Learning resource"),E("small",item.subject||"StudyLab","slws-muted"));a.addEventListener("click",()=>root.StudyLabResourceDashboard?.record(item));row.append(a);if(remove)row.append(B("Remove",()=>root.StudyLabResourceDashboard?.removeFavorite(item.url)));else{const saved=(root.StudyLabResourceDashboard?.favorites()||[]).some(x=>x.url===item.url);row.append(B(saved?"Saved":"Save",()=>root.StudyLabResourceDashboard?.saveFavorite(item)));}host.append(row);}
}
function notes(host){
 const n=E("textarea"),status=E("p","Loading local note…","slws-muted");n.rows=5;n.maxLength=12000;n.placeholder="Write a study reminder or idea…";n.setAttribute("aria-label","Personal quick notes");n.disabled=true;status.setAttribute("role","status");host.append(n,status);
 let key=null;const current=()=>PREFIX+(root.StudyLabAccount?.getUser?.()?.id||"this-browser");
 Promise.resolve(root.StudyLabAccount?.ready).catch(()=>{}).then(()=>{if(!host.isConnected)return;key=current();n.value=String(read(key,""));n.disabled=false;status.textContent="Saved on this device. Not shared or cloud-synced.";});
 n.addEventListener("input",()=>{if(!key)return;if(current()!==key){n.disabled=true;status.textContent="Account changed. Reload before editing.";return;}const ok=write(key,n.value);status.textContent=ok?"Saved on this device":"Storage unavailable. Copy your note before leaving.";if(ok)root.dispatchEvent(new CustomEvent("studylab-note-change",{detail:key}));});
 function sync(e){if(key&&(e.key===key||e.detail===key)&&d.activeElement!==n)n.value=String(read(key,""));}root.addEventListener("storage",sync);root.addEventListener("studylab-note-change",sync);
}
function settings(host){
 const status=E("p","Settings are saved on this device.","slws-muted");
 for(const [name,label,detail] of [["focus","Focus Mode","Hide decorative distractions and chat unread badges. Chat remains available."],["lite","Lite Mode","Reduce decorative blur, animation and background effects."]]){
  const row=E("label",null,"slws-setting"),copy=E("span"),input=E("input");copy.append(E("strong",label),E("small",detail,"slws-muted"));input.type="checkbox";input.setAttribute("role","switch");input.checked=prefs[name]===true;input.addEventListener("change",()=>{status.textContent=setPreference(name,input.checked)?"Saved on this device":"Applied temporarily; local storage unavailable.";});root.addEventListener("studylab-workspace-settings",()=>{input.checked=prefs[name]===true;});row.append(copy,input);host.append(row);
 }
 const keys=E("details",null,"slws-shortcuts");keys.append(E("summary","Keyboard shortcuts"));for(const [k,v] of [["Ctrl/⌘ + K","Search"],["Alt + Q","Quick Access / Workspace"],["Alt + C","Chat"],["Alt + N","Notes"],["Alt + F","Focus Mode"],["Alt + L","Lite Mode"],["Esc","Existing panel close controls"]]){const line=E("div",null,"slws-key");line.append(E("kbd",k),E("span",v));keys.append(line);}keys.append(E("p","Some browser-reserved shortcuts may take priority.","slws-muted"));host.append(keys,status);
}
function refreshContinue(){const last=(root.StudyLabResourceDashboard?.recent()||[])[0];for(const host of d.querySelectorAll("[data-slws-continue]")){host.hidden=!last;if(last)resources(host,[last]);}}
function mountQuick(panel){if(panel.querySelector(".slws-quick-extra"))return;const c=E("section",null,"study-quick-section slws-continue"),list=E("div");list.dataset.slwsContinue="";c.append(E("div","Continue learning","study-quick-section-title"),list);panel.insertBefore(c,panel.querySelector(".study-quick-progress"));const extra=E("section",null,"study-quick-section slws-quick-extra"),s=E("details"),n=E("details");s.append(E("summary","Workspace settings"));settings(s);n.dataset.slwsNotes="";n.append(E("summary","Quick Notes"));notes(n);extra.append(s,n);panel.append(extra);refreshContinue();}
function mountHome(){const copy=d.querySelector(".sl-home-intro-copy");if(!copy||copy.querySelector("[data-slws-continue]"))return;const h=E("div",null,"slws-home-continue");h.dataset.slwsContinue="";h.hidden=true;copy.append(h);refreshContinue();}
function mountRoom(panel,tasks){
 if(!panel||!tasks||panel.querySelector("#slStudyWorkspace"))return;
 const w=E("section",null,"sl-card sl-wide slws-room");w.id="slStudyWorkspace";const head=E("div",null,"sl-head");head.append(E("h3","My Study Workspace"),E("small","Saved on this device"));const nav=E("div",null,"slws-tabs");nav.setAttribute("role","group");nav.setAttribute("aria-label","Workspace sections");w.append(head,nav);tasks.before(w);
 const bodies=["Tasks","Library","Recent","Notes","Settings"].map(label=>[label,E("div",null,"slws-tab-body")]);for(const [,body] of bodies)w.append(body);bodies[0][1].append(tasks);notes(bodies[3][1]);settings(bodies[4][1]);
 const refresh=()=>{resources(bodies[1][1],root.StudyLabResourceDashboard?.favorites()||[],true);resources(bodies[2][1],root.StudyLabResourceDashboard?.recent()||[]);};
 function select(name,focus=false){for(const [label,body] of bodies){body.hidden=label!==name;nav.querySelector('[data-tab="'+label+'"]')?.setAttribute("aria-pressed",String(label===name));}if(name==="Library"||name==="Recent")refresh();if(focus){w.scrollIntoView?.({block:"start",behavior:"auto"});if(name==="Notes")bodies[3][1].querySelector("textarea")?.focus();}}
 for(const [label] of bodies){const b=B(label,()=>select(label));b.dataset.tab=label;nav.append(b);}select("Tasks");root.addEventListener("studylab-resource-dashboard-change",refresh);w.addEventListener("studylab-workspace-open",e=>select(e.detail||"Tasks",true));
}
function openQuick(note=false){const w=d.getElementById("slStudyWorkspace");if(w){w.dispatchEvent(new CustomEvent("studylab-workspace-open",{detail:note?"Notes":"Tasks"}));return true;}const p=d.getElementById("studyQuickAccessPanel"),b=d.getElementById("studyQuickButton");if(!p||!b)return false;if(p.hidden)b.click();if(note){const n=p.querySelector("[data-slws-notes]");if(n){n.open=true;requestAnimationFrame(()=>{n.scrollIntoView?.({block:"nearest"});n.querySelector("textarea")?.focus();});}}return true;}
d.addEventListener("keydown",e=>{if(e.defaultPrevented||e.repeat||e.isComposing||e.shiftKey||e.target?.closest?.("input,textarea,select,[contenteditable]:not([contenteditable=false])"))return;const k=String(e.key).toLowerCase();let handled=false;if((e.ctrlKey||e.metaKey)&&!e.altKey&&k==="k"){const b=d.getElementById("studyHeaderSearchButton");if(b){if(b.getAttribute("aria-expanded")!=="true")b.click();else d.querySelector("#studyHeaderSearchPanel input")?.focus();handled=true;}else handled=!!root.StudyLabResourceDashboard?.focusSearch();}else if(e.altKey&&!e.ctrlKey&&!e.metaKey){if(k==="q")handled=openQuick();if(k==="n")handled=openQuick(true);if(k==="c"){const b=d.querySelector("[data-chat-button]");if(b){if(b.getAttribute("aria-expanded")!=="true")b.click();handled=true;}}if(k==="f"){setPreference("focus",!prefs.focus);handled=true;}if(k==="l"){setPreference("lite",!prefs.lite);handled=true;}}if(handled)e.preventDefault();});
root.addEventListener("studylab-resource-dashboard-change",refreshContinue);
root.StudyLabWorkspace=Object.freeze({deviceType,aggregatePresence,mountQuick,mountHome,mountRoom,setPreference});
})(typeof window!=="undefined"?window:globalThis);
