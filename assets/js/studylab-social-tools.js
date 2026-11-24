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
 const accepted=await modal("Adjust photo","Drag the corners or edges to crop. Drag inside to move the selection.",(host,ok,finish)=>{
  const stage=E("div",null,"sl-social-crop-stage"),view=canvas(420,300);view.className="sl-social-crop-interactive";view.setAttribute("aria-label","Photo crop area");view.tabIndex=0;stage.append(view);host.append(stage);
  const controls=E("div",null,"sl-social-crop-toolbar"),ratio=E("select");ratio.setAttribute("aria-label","Crop aspect ratio");
  for(const [v,l] of [["free","Free"],["original","Original"],["1","1:1"],["0.8","4:5"],["1.7777778","16:9"]]){const o=E("option",l);o.value=v;ratio.append(o);}
  let turn=0,flip=false,source=base,rect,drag=null;const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
  function orient(){source=canvas(turn%2?base.height:base.width,turn%2?base.width:base.height);const ctx=source.getContext("2d");ctx.translate(source.width/2,source.height/2);ctx.rotate(turn*Math.PI/2);ctx.scale(flip?-1:1,1);ctx.drawImage(base,-base.width/2,-base.height/2);}
  function reset(){const r=ratio.value==="free"||ratio.value==="original"?source.width/source.height:Number(ratio.value),w=Math.min(source.width,source.height*r),h=w/r;rect={x:(source.width-w)/2,y:(source.height-h)/2,w,h};paint();}
  function paint(){const f=Math.min(1,540/source.width,360/source.height);view.width=Math.round(source.width*f);view.height=Math.round(source.height*f);const ctx=view.getContext("2d"),sx=view.width/source.width,sy=view.height/source.height,x=rect.x*sx,y=rect.y*sy,w=rect.w*sx,h=rect.h*sy;ctx.drawImage(source,0,0,view.width,view.height);ctx.fillStyle="#0009";ctx.fillRect(0,0,view.width,y);ctx.fillRect(0,y+h,view.width,view.height-y-h);ctx.fillRect(0,y,x,h);ctx.fillRect(x+w,y,view.width-x-w,h);ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);ctx.strokeStyle="#ffffff80";ctx.lineWidth=1;for(let n=1;n<3;n++){ctx.beginPath();ctx.moveTo(x+w*n/3,y);ctx.lineTo(x+w*n/3,y+h);ctx.moveTo(x,y+h*n/3);ctx.lineTo(x+w,y+h*n/3);ctx.stroke();}ctx.fillStyle="#fff";for(const [cx,cy] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h],[x+w/2,y],[x+w/2,y+h],[x,y+h/2],[x+w,y+h/2]])ctx.fillRect(cx-4,cy-4,8,8);}
  function point(e){const b=view.getBoundingClientRect();return {x:(e.clientX-b.left)*source.width/b.width,y:(e.clientY-b.top)*source.height/b.height,slop:Math.max(12,22*source.width/b.width)};}
  function hit(p){const r=rect,t=p.slop,near=(a,b)=>Math.abs(a-b)<=t;if(p.x<r.x-t||p.x>r.x+r.w+t||p.y<r.y-t||p.y>r.y+r.h+t)return "";const h=near(p.x,r.x)?"w":near(p.x,r.x+r.w)?"e":"",v=near(p.y,r.y)?"n":near(p.y,r.y+r.h)?"s":"";return v+h||"move";}
  view.addEventListener("pointerdown",e=>{const p=point(e),mode=hit(p);if(!mode)return;e.preventDefault();drag={id:e.pointerId,mode,p,r:{...rect}};view.setPointerCapture?.(e.pointerId);});
  view.addEventListener("pointermove",e=>{const p=point(e);if(!drag){view.style.cursor=({"move":"move","n":"ns-resize","s":"ns-resize","e":"ew-resize","w":"ew-resize","nw":"nwse-resize","se":"nwse-resize","ne":"nesw-resize","sw":"nesw-resize"})[hit(p)]||"default";return;}if(drag.id!==e.pointerId)return;const {mode,r}=drag,dx=p.x-drag.p.x,dy=p.y-drag.p.y,min=Math.min(24,source.width,source.height);
   if(mode==="move"){rect={...r,x:clamp(r.x+dx,0,source.width-r.w),y:clamp(r.y+dy,0,source.height-r.h)};}
   else{let l=r.x,t=r.y,rr=r.x+r.w,bb=r.y+r.h;if(mode.includes("w"))l=clamp(l+dx,0,rr-min);if(mode.includes("e"))rr=clamp(rr+dx,l+min,source.width);if(mode.includes("n"))t=clamp(t+dy,0,bb-min);if(mode.includes("s"))bb=clamp(bb+dy,t+min,source.height);
    if(ratio.value!=="free"){const aspect=r.w/r.h;let w=rr-l,h=bb-t;if(mode==="n"||mode==="s")w=h*aspect;else h=w/aspect;w=Math.min(w,source.width,source.height*aspect);h=w/aspect;l=mode.includes("w")?r.x+r.w-w:r.x;t=mode.includes("n")?r.y+r.h-h:r.y;l=clamp(l,0,source.width-w);t=clamp(t,0,source.height-h);rect={x:l,y:t,w,h};}else rect={x:l,y:t,w:rr-l,h:bb-t};
   }paint();});
  for(const ev of ["pointerup","pointercancel","lostpointercapture"])view.addEventListener(ev,()=>{drag=null;});
  function zoom(f){const r=rect,w=clamp(r.w*f,Math.min(24,source.width),source.width),h=w*r.h/r.w,hh=Math.min(h,source.height),ww=hh*r.w/r.h;rect={x:clamp(r.x+(r.w-ww)/2,0,source.width-ww),y:clamp(r.y+(r.h-hh)/2,0,source.height-hh),w:ww,h:hh};paint();}
  view.addEventListener("wheel",e=>{e.preventDefault();zoom(e.deltaY>0?1.1:.9);},{passive:false});
  view.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","-"].includes(e.key))return;e.preventDefault();if(e.key==="+"||e.key==="-"){zoom(e.key==="+"?.9:1.1);return;}const n=e.shiftKey?20:4;rect.x=clamp(rect.x+(e.key==="ArrowLeft"?-n:e.key==="ArrowRight"?n:0),0,source.width-rect.w);rect.y=clamp(rect.y+(e.key==="ArrowUp"?-n:e.key==="ArrowDown"?n:0),0,source.height-rect.h);paint();});
  function tool(label,title,fn){const b=B(label,fn);b.title=title;b.setAttribute("aria-label",title);return b;}
  ratio.addEventListener("change",reset);controls.append(ratio,tool("−","Zoom out",()=>zoom(1.12)),tool("+","Zoom in",()=>zoom(.88)),tool("↻","Rotate 90 degrees",()=>{turn=(turn+1)%4;orient();reset();}),tool("⇄","Flip horizontally",()=>{flip=!flip;orient();reset();}),tool("Reset","Reset crop",()=>{turn=0;flip=false;ratio.value="free";orient();reset();}));host.append(controls);reset();
  ok.onclick=async()=>{ok.disabled=true;try{const out=canvas(rect.w,rect.h);out.getContext("2d").drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,out.width,out.height);result=await encode(out,file.name);finish(true);}catch(e){host.append(E("p",e.message));ok.disabled=false;}};
 },"Apply crop");return accepted?result:null;
}
async function compress(file){if(file.type==="image/png"||file.size<700*1024)return file;try{const im=await load(file),scale=Math.min(1,2048/Math.max(im.naturalWidth,im.naturalHeight)),c=canvas(im.naturalWidth*scale,im.naturalHeight*scale);c.getContext("2d").drawImage(im,0,0,c.width,c.height);const next=await encode(c,file.name);return next.type==="image/webp"&&next.size<file.size?next:file;}catch(_){return file;}}
const unread={social:0,follow:0};
function updateUnread(kind,count){if(!(kind in unread))return;unread[kind]=Math.max(0,Number(count)||0);const total=unread.social+unread.follow;for(const button of d.querySelectorAll(".sl-feed-toggle,.sl-feed-floating-shortcut,[data-nav-id=social]")){button.classList.toggle("sl-social-has-unread",total>0);let dot=button.querySelector(".sl-social-unread-dot");if(!dot){dot=E("span",null,"sl-social-unread-dot");dot.setAttribute("aria-hidden","true");button.append(dot);}dot.hidden=total===0;}}
root.StudyLabSocialTools=Object.freeze({move,orderedImages,videoURL,modal,preview,crop,compress,updateUnread});
})(typeof window!=="undefined"?window:globalThis);
