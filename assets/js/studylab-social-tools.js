/* Local Social editor utilities. No network requests, uploads or database writes. */
(function(root){
"use strict";
function move(list,from,to){const next=list.slice();if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=next.length||to>=next.length)return next;next.splice(to,0,next.splice(from,1)[0]);return next;}
function orderedImages(rows){const order=x=>Number(x.bucket_path?.split("/").pop()?.match(/^order-0([1-4])-/)?.[1]||0);return rows.every(x=>order(x)>0)?rows.slice().sort((a,b)=>order(a)-order(b)):rows.slice();}
function videoURL(raw){try{const u=new URL(raw);if(u.protocol!=="https:"||u.username||u.password||u.port)return "";let id="";if(["youtube.com","www.youtube.com","m.youtube.com"].includes(u.hostname)&&u.pathname==="/watch")id=u.searchParams.get("v")||"";else if(u.hostname==="youtu.be")id=u.pathname.slice(1);return /^[A-Za-z0-9_-]{11}$/.test(id)?"https://www.youtube.com/watch?v="+id:"";}catch(_){return "";}}
if(typeof module!=="undefined"&&module.exports){module.exports={move,orderedImages,videoURL};return;}
const d=root.document;
const E=(tag,txt,cls)=>{const e=d.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e;};
const B=(txt,fn)=>{const e=E("button",txt,"sl-social-modal-button");e.type="button";e.onclick=fn;return e;};
let active=null;
function modal(title,message,build,action="Continue",danger=false){
 if(active)return Promise.resolve(false);
 return new Promise(resolve=>{
  const dialog=E("dialog",null,"sl-social-modal"),heading=E("h2",title),copy=E("p",message,"sl-social-modal-copy"),content=E("div",null,"sl-social-modal-body"),actions=E("div",null,"sl-social-modal-actions");
  dialog.setAttribute("aria-label",title);dialog.append(heading,copy,content,actions);active=dialog;
  let done=false;const before=d.activeElement;
  function finish(value){if(done)return;done=true;active=null;dialog.remove();before?.focus?.({preventScroll:true});resolve(value);}
  const cancel=B("Cancel",()=>finish(false)),ok=B(action,()=>finish(true));ok.classList.add(danger?"is-danger":"is-primary");actions.append(cancel,ok);
  dialog.addEventListener("cancel",e=>{e.preventDefault();e.stopPropagation();finish(false);});
  dialog.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();e.preventDefault();finish(false);}});
  dialog.addEventListener("close",()=>finish(false));
  d.body.append(dialog);
  try{if(build)build(content,ok,finish);dialog.showModal();cancel.focus();}catch(_){finish(false);}
 });
}
function preview(html,files){
 const urls=[];
 return modal("Preview your post","Review your text and photo order. Guardian checks your post before publishing.",host=>{
  const text=E("div",null,"sl-social-preview-text");text.append(html);host.append(text);
  const grid=E("div",null,"sl-social-preview-grid");for(const [i,file] of files.entries()){const img=E("img");const u=URL.createObjectURL(file);urls.push(u);img.src=u;img.alt="Photo "+(i+1);grid.append(img);}host.append(grid);
 },"Publish post").finally(()=>urls.forEach(u=>URL.revokeObjectURL(u)));
}
function load(file){return new Promise((resolve,reject)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error("Cannot decode this image."));};im.src=u;});}
function canvas(w,h){const c=d.createElement("canvas");c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
function encode(c,name){return new Promise((resolve,reject)=>c.toBlob(blob=>{if(!blob||blob.size>4*1024*1024){reject(Error("Photo must be 4 MB or smaller."));return;}resolve(new File([blob],name.replace(/\.[^.]+$/,"")+".webp",{type:blob.type}));},"image/webp",.88));}
async function crop(file){
 const im=await load(file),scale=Math.min(1,2048/Math.max(im.naturalWidth,im.naturalHeight)),base=canvas(im.naturalWidth*scale,im.naturalHeight*scale);base.getContext("2d").drawImage(im,0,0,base.width,base.height);
 let result=null;
 const accepted=await modal("Crop and adjust photo","Adjust the crop locally. The original remains unchanged until you apply it.",(host,ok,finish)=>{
  const controls=E("div",null,"sl-social-crop-controls"),view=canvas(420,300);view.className="sl-social-crop-canvas";view.setAttribute("aria-label","Crop preview");
  const ratio=E("select");for(const [v,l] of [["original","Original"],["1","Square 1:1"],["0.75","Portrait 3:4"],["1.7777778","Landscape 16:9"]]){const o=E("option",l);o.value=v;ratio.append(o);}
  const slider=(min,max,value,step)=>{const x=E("input");x.type="range";Object.assign(x,{min,max,value,step});return x;};
  const zoom=slider(1,3,1,.05),x=slider(0,100,50,1),y=slider(0,100,50,1);let turn=0;
  for(const [label,control] of [["Crop shape",ratio],["Zoom",zoom],["Horizontal position",x],["Vertical position",y]]){const l=E("label",label);l.append(control);controls.append(l);control.addEventListener("input",paint);}
  const rotate=B("Rotate 90°",()=>{turn=(turn+1)%4;paint();});controls.append(rotate);host.append(view,controls);
  function render(max){
   const source=canvas(turn%2?base.height:base.width,turn%2?base.width:base.height),ctx=source.getContext("2d");ctx.translate(source.width/2,source.height/2);ctx.rotate(turn*Math.PI/2);ctx.drawImage(base,-base.width/2,-base.height/2);
   const r=ratio.value==="original"?source.width/source.height:Number(ratio.value),w=Math.min(source.width,source.height*r)/Number(zoom.value),h=w/r,sx=(source.width-w)*Number(x.value)/100,sy=(source.height-h)*Number(y.value)/100,f=Math.min(1,max/Math.max(w,h)),out=canvas(w*f,h*f);
   out.getContext("2d").drawImage(source,sx,sy,w,h,0,0,out.width,out.height);return out;
  }
  function paint(){const out=render(420);view.width=out.width;view.height=out.height;view.getContext("2d").drawImage(out,0,0);}
  paint();ok.onclick=async()=>{ok.disabled=true;try{result=await encode(render(2048),file.name);finish(true);}catch(e){host.append(E("p",e.message));ok.disabled=false;}};
 },"Apply crop");
 return accepted?result:null;
}
async function compress(file){if(file.type==="image/png"||file.size<700*1024)return file;try{const im=await load(file),scale=Math.min(1,2048/Math.max(im.naturalWidth,im.naturalHeight)),c=canvas(im.naturalWidth*scale,im.naturalHeight*scale);c.getContext("2d").drawImage(im,0,0,c.width,c.height);const next=await encode(c,file.name);return next.type==="image/webp"&&next.size<file.size?next:file;}catch(_){return file;}}
const unread={social:0,follow:0};
function updateUnread(kind,count){if(!(kind in unread))return;unread[kind]=Math.max(0,Number(count)||0);const total=unread.social+unread.follow;for(const button of d.querySelectorAll(".sl-feed-toggle,.sl-feed-floating-shortcut,[data-nav-id=social]")){button.classList.toggle("sl-social-has-unread",total>0);let dot=button.querySelector(".sl-social-unread-dot");if(!dot){dot=E("span",null,"sl-social-unread-dot");dot.setAttribute("aria-hidden","true");button.append(dot);}dot.hidden=total===0;}}
root.StudyLabSocialTools=Object.freeze({move,orderedImages,videoURL,modal,preview,crop,compress,updateUnread});
})(typeof window!=="undefined"?window:globalThis);
