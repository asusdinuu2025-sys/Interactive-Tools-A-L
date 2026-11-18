/* Admin guided publishing for StudyLab's existing subject, channel and lesson cards.
   Generic cards and Sections remain available in the original admin editor. */
(function(){
"use strict";
if(window.StudyLabAdminPublisher)return;
const subjects=[["maths.html","Mathematics"],["physics.html","Physics"],["chemistry.html","Chemistry"],["biology.html","Biology"]];
const groups=[
 {id:"simulation",name:"Practical Simulations",icon:"⚗",hint:"Upload a standalone HTML tool to an existing subject"},
 {id:"telegram",name:"A/L Telegram Channels",icon:"➤",hint:"Publish to Sponsored, subject channels or All"},
 {id:"lesson-pack",name:"Free Lesson Packs",icon:"▤",hint:"Create matching lesson and revision-pack cards"},
 {id:"custom",name:"Custom Sections",icon:"▦",hint:"Add a resource inside an existing or new section"}
];
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=text;if(cls)n.className=cls;return n;};
function labeled(text,type="text",name="",value="",limit=0){
 const wrap=el("label",null,"sladmin-publish-field"),title=el("span",text);
 const input=el(type==="textarea"?"textarea":"input");
 if(type!=="textarea")input.type=type;
 input.name=name;input.value=value??"";
 if(limit)input.maxLength=limit;
 wrap.append(title,input);return wrap;
}
function choice(text,name,options,value){
 const wrap=el("label",null,"sladmin-publish-field"),s=el("select");
 s.name=name;wrap.append(el("span",text),s);
 for(const [v,label] of options){
   const option=el("option",label);option.value=v;option.selected=v===value;s.append(option);
 }
 return wrap;
}
function addStatus(form,message,error=false){
 const status=form.querySelector("[data-publisher-status]");
 status.textContent=message;status.classList.toggle("is-error",error);
}
function mount(host,api,rows,onRefresh){
 const panel=el("div",null,"sladmin-publish"),heading=el("div",null,"sladmin-publish-heading");
 heading.append(el("strong","Publish to StudyLab"),el("p","Choose where your new resource belongs. The original card editor is below."));
 panel.append(heading);
 const grid=el("div",null,"sladmin-publish-grid");
 let current="";
 const entries=groups.map(group=>{
   const button=el("button",null,"sladmin-publish-choice");
   button.type="button";button.dataset.kind=group.id;
   const icon=el("span",group.icon,"sladmin-publish-icon");
   button.append(icon,el("strong",group.name),el("small",group.hint));
   button.addEventListener("click",()=>{
     current=current===group.id?"":group.id;
     entries.forEach(x=>x.classList.toggle("is-selected",x.dataset.kind===current));
     options.replaceChildren();
     if(current)buildChoices(current);
   });
   grid.append(button);return button;
 });
 panel.append(grid);
 const options=el("div",null,"sladmin-publish-options");panel.append(options);
 host.prepend(panel);
 function nextOrder(page,section=""){
   return Math.min(10000,Math.max(0,...rows.filter(r=>r.draft?.page===page&&
     (!section||r.draft.section===section)).map(r=>Number(r.draft.order)||0))+10);
 }
 function buildChoices(kind){
   const choices=el("div",null,"sladmin-publish-path");
   const dest=kind==="simulation"?subjects:kind==="telegram"?[
     ["sponsored","Sponsored"],["maths","Mathematics"],["biology","Biology"],
     ["chemistry","Chemistry"],["physics","Physics"],["all","All Channels"]
   ]:kind==="custom"?rows.filter(x=>x.draft?.kind==="section" && x.draft.page==="index.html"&&!x.draft.hidden)
     .map(x=>[x.id,x.draft.title]):[["lesson-packs.html","Free Lessons & Lesson Packs"]];
   if(!dest.length){options.append(el("p","Create a section under Sections first."));return;}
   for(const [value,label] of dest){
     const button=el("button",label,"sladmin-path-choice");button.type="button";
     button.addEventListener("click",()=>openEditor(kind,value));
     choices.append(button);
   }
   options.append(el("p","Select the destination:"),choices);
 }
 function openEditor(kind,destination,record=null){
   const draft=record?.draft||null;
   const dialog=el("dialog",null,"sladmin-dialog sladmin-publish-dialog");
   const form=el("form");const head=el("header");
   const title=el("h2",record?"Edit resource":"Publish new resource");
   const close=el("button","×");close.type="button";close.setAttribute("aria-label","Close publisher");
   close.addEventListener("click",()=>dialog.close());head.append(title,close);
   const fields=el("div",null,"sladmin-publish-fields");
   const page=kind==="simulation"?destination:kind==="telegram"?"Telegram_Channels.html":
     kind==="lesson-pack"?"lesson-packs.html":"index.html";
   const isSim=kind==="simulation";
   fields.append(labeled("Title / tool name","text","title",draft?.resource_title||draft?.title||"",160));
   fields.append(labeled("Description","textarea","description",draft?.description||"",1500));
   if(isSim){
     fields.append(labeled("Topic","text","topic",draft?.topic||"",120));
     fields.append(labeled("Lesson number (optional)","number","lesson_number",draft?.lesson_number||""));
     fields.append(labeled("Lesson name (optional)","text","lesson_name",draft?.lesson_name||"",120));
     // Pure / Applied classification belongs to Combined Mathematics only.
     // Other subject pages use their numbered A/L lesson filter.
     if(destination==="maths.html") fields.append(choice("Mathematics category","maths_category",
       [["pure","Pure Maths"],["applied","Applied Maths"],["resources","Resources"],["pastpapers","Past Papers"]],
       draft?.maths_category||"pure"));
     const file=labeled("Upload standalone .html simulation (5 MB max)","file","html");
     file.querySelector("input").accept=".html,text/html";
     if(!draft?.html_path)file.querySelector("input").required=true;
     fields.append(file);
     const saved=el("p",null,"sladmin-publish-file-status");
     const oldFile=draft?.html_path||"";
     saved.textContent=oldFile
       ? "✓ Saved HTML: "+(draft.html_name||oldFile.split("/").pop())+
         " · Kept unless you choose a replacement"
       : "No HTML uploaded yet · Choose a file before publishing.";
     file.querySelector("input").addEventListener("change",event=>{
       const selected=event.target.files?.[0];
       saved.textContent=selected
         ? "Selected: "+selected.name+" · Replaces saved HTML only after a successful update"
         :oldFile?"✓ Saved HTML retained: "+(draft.html_name||oldFile.split("/").pop()):
          "No HTML uploaded yet.";
     });
     fields.append(saved,el("p","Uploaded HTML runs only inside the StudyLab simulation viewer, not inside the account page.","sladmin-publish-note"));
   }else if(kind==="telegram"){
     fields.append(labeled("Telegram channel link","url","link",draft?.url||"https://t.me/",2048));
     fields.append(labeled("Channel handle / teacher (optional)","text","publisher",draft?.publisher||"",100));
     // The same existing Admin image uploader and storage bucket used for
     // lesson packs. No new bucket or migration is required.
     const avatar=labeled("Telegram group picture (optional, JPG/PNG/WebP, max 5 MB)",
       "file","telegram_avatar");
     const avatarFile=avatar.querySelector("input");
     avatarFile.accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
     fields.append(avatar);
     const avatarStatus=el("p",null,"sladmin-publish-file-status sladmin-publish-avatar-status");
     function describeAvatar(){
       avatarStatus.replaceChildren();
       const selected=avatarFile.files?.[0];
       if(selected)avatarStatus.append(document.createTextNode(
         "Selected: "+selected.name+" · Uploaded when you save"));
       else if(form.elements.remove_telegram_avatar?.checked)
         avatarStatus.append(document.createTextNode(
           "Remove picture · Original Telegram icon will be displayed."));
       else if(draft?.image){
         const thumb=el("img");thumb.src=draft.image;thumb.alt="";
         thumb.className="sladmin-publish-avatar-thumbnail";
         thumb.addEventListener("error",()=>thumb.remove());
         avatarStatus.append(thumb,document.createTextNode(
           "Saved group picture · "+(draft.avatar_file_name||"Existing picture")+
           " · Kept unless replaced or removed"));
       }else avatarStatus.append(document.createTextNode(
         "No group picture · Original Telegram icon will be used."));
     }
     if(draft?.image){
       const remove=el("label",null,"sladmin-publish-avatar-remove");
       const tick=el("input");tick.type="checkbox";tick.name="remove_telegram_avatar";
       remove.append(tick,document.createTextNode("Remove current group picture"));
       tick.addEventListener("change",()=>{
         if(tick.checked)avatarFile.value="";
         describeAvatar();
       });
       fields.append(remove);
     }
     avatarFile.addEventListener("change",()=>{
       if(avatarFile.files?.[0] && form.elements.remove_telegram_avatar)
         form.elements.remove_telegram_avatar.checked=false;
       describeAvatar();
     });
     describeAvatar();
     fields.append(avatarStatus);
   }else if(kind==="lesson-pack"){
     fields.append(choice("Subject","subject",subjects.map(([v,t])=>[v.replace(".html",""),t]),draft?.subject||"physics"));
     fields.append(labeled("Teacher / publisher","text","publisher",draft?.publisher||"",120));
     fields.append(labeled("Series or pack title","text","series",draft?.series||"",120));
     fields.append(labeled("Lesson pack link (or upload a PDF)","url","link",draft?.url||"",2048));
     const packPDF=labeled("Upload lesson pack PDF (optional, 5 MB max)","file","pack_pdf");
     packPDF.querySelector("input").accept=".pdf,application/pdf";
     fields.append(packPDF);
     if(draft?.pack_file_path)
       fields.append(el("p","✓ Saved PDF: "+(draft.pack_file_name||"Uploaded lesson pack")+
         " · Kept unless replaced.","sladmin-publish-file-status"));
     fields.append(labeled("Cover image URL (optional)","url","image",draft?.image||"",2048));
     const cover=labeled("Upload cover image (optional, 5 MB max)","file","pack_cover");
     cover.querySelector("input").accept="image/jpeg,image/png,image/webp";
     fields.append(cover);
     if(draft?.cover_file_path)
       fields.append(el("p","✓ Saved cover: "+(draft.cover_file_name||"Uploaded image")+
         " · Kept unless replaced.","sladmin-publish-file-status"));
   }else {
     fields.append(labeled("Destination link","url","link",draft?.url||"",2048));
     fields.append(labeled("Image URL (optional)","url","image",draft?.image||"",2048));
   }
   if(kind!=="telegram")fields.append(labeled("Emoji / icon (optional)","text","emoji",draft?.emoji||"",12));
   fields.append(labeled("Display order","number","order",draft?.order??nextOrder(page,kind==="custom"?destination:"")));
   const actionBar=el("div",null,"sladmin-editor-actions");
   const preview=el("button","Preview"),draftBtn=el("button","Save draft"),publish=el("button","Publish","sladmin-primary");
   for(const b of [preview,draftBtn,publish])b.type="button";
   const status=el("p","", "sladmin-publish-status");status.dataset.publisherStatus="";
   actionBar.append(preview,draftBtn,publish);
   const modeNotice=el("p",api.preview
     ? "Local-only editor: nothing appears to other students. Open PR #102 deploy preview to publish."
     : "Connected to StudyLab publishing. Published cards appear on their destination pages.",
     "sladmin-publish-note sladmin-publish-mode-note");
   form.append(head,modeNotice,fields,status,actionBar);dialog.append(form);document.body.append(dialog);
   form.addEventListener("submit",event=>event.preventDefault());
   dialog.addEventListener("close",()=>dialog.remove());dialog.showModal();
   function rawValues(){
     const d=new FormData(form);
     const title=String(d.get("title")||"").trim();
     const description=String(d.get("description")||"").trim();
     if(!title||title.length>160)throw Error("Enter a title up to 160 characters.");
     const order=Number(d.get("order"));
     if(!Number.isInteger(order)||order<0||order>10000)throw Error("Order must be 0–10000.");
     const emoji=kind==="telegram" ? String(draft?.emoji||"") : String(d.get("emoji")||"").trim();
     if(emoji.length>12)throw Error("Keep your emoji/icon under 12 characters.");
     const info={
       id:draft?.id||"custom-"+crypto.randomUUID(),kind:"card",page,
       resource_type:kind,resource_title:title,title,description,order,
       emoji,hidden:false,section:kind==="custom"?destination:"",
       url:kind==="simulation"?"/simulation-viewer.html?id="+encodeURIComponent(draft?.id||"") :
         String(d.get("link")||"").trim(),
       image:kind==="telegram" ? String(draft?.image||"") : String(d.get("image")||"").trim(),
       button_label:kind==="simulation"?"Open Tool":
         kind==="telegram"?"Open Channel":kind==="lesson-pack"?"View Lessons":"Open resource"
     };
     // Existing custom section cards keep their section and page semantics.
     if(kind==="simulation"){
       const number=String(d.get("lesson_number")||"").trim();
       const max=page==="physics.html"?11:page==="chemistry.html"?14:page==="biology.html"?10:40;
       if(number&&(!Number.isInteger(Number(number))||Number(number)<1||Number(number)>max))
         throw Error("Choose a valid lesson number for this subject.");
       info.lesson_number=number?Number(number):null;
       info.lesson_name=String(d.get("lesson_name")||"").trim().slice(0,120);
       info.topic=String(d.get("topic")||"").trim().slice(0,120);
       if(page==="maths.html") info.maths_category=String(d.get("maths_category")||"pure");
       info.html_path=draft?.html_path||"";
       info.html_name=draft?.html_name||"";
       info.url="/simulation-viewer.html?id="+encodeURIComponent(info.id);
       // Numbered title is used by the original lesson filter.
       if(number)info.title=String(number).padStart(2,"0")+". "+title;
     }else if(kind==="telegram"){
       info.telegram_category=destination;
       if(!/^https:\/\/(t\.me|telegram\.me)\//i.test(info.url))
         throw Error("Use a Telegram channel link starting https://t.me/");
       if(new URL(info.url).pathname==="/")
         throw Error("Enter a full Telegram channel link such as https://t.me/yourchannel.");
       info.publisher=String(d.get("publisher")||"").trim().slice(0,100);
       info.avatar_file_path=draft?.avatar_file_path||"";
       info.avatar_file_name=draft?.avatar_file_name||"";
       if(form.elements.remove_telegram_avatar?.checked){
         info.image="";info.avatar_file_path="";info.avatar_file_name="";
       }
     }else if(kind==="lesson-pack"){
       info.subject=String(d.get("subject")||"physics");
       info.publisher=String(d.get("publisher")||"").trim().slice(0,120);
       info.series=String(d.get("series")||"").trim().slice(0,120);
       info.pack_file_path=draft?.pack_file_path||"";
       info.pack_file_name=draft?.pack_file_name||"";
       info.cover_file_path=draft?.cover_file_path||"";
       info.cover_file_name=draft?.cover_file_name||"";
     }
     if(!info.url && !(kind==="lesson-pack" && form.elements.pack_pdf?.files?.[0]))
       throw Error("Provide a destination link or upload a lesson pack PDF.");
     return info;
   }
   async function previewHTML(){
     if(!isSim)return;
     const file=form.elements.html?.files?.[0];
     if(!file && !draft?.html_path){
       addStatus(form,"Choose an HTML file to preview.",true);return;
     }
     if(file && (!/\.html?$/i.test(file.name)||file.size>5*1024*1024)){
       addStatus(form,"Choose an .html file under 5 MB.",true);return;
     }
     const code=file ? await file.text() : await api.readSimulation(draft.html_path);
     const frame=el("iframe");frame.sandbox="allow-scripts allow-forms";
     frame.referrerPolicy="no-referrer";frame.style.cssText="width:100%;height:min(68vh,600px);border:1px solid rgba(130,197,255,.3);border-radius:14px;background:#fff";
     const modal=el("dialog",null,"sladmin-dialog sladmin-html-preview");
     const end=el("button","Close Preview");end.type="button";end.onclick=()=>modal.close();
     modal.append(end,frame);document.body.append(modal);
     modal.addEventListener("close",()=>modal.remove());
     modal.showModal();frame.srcdoc=code;
   }
   preview.onclick=async()=>{try{if(isSim)await previewHTML();else{
      const item=rawValues();addStatus(form,"Ready to publish: "+item.title+" · "+item.page);
   }}catch(e){addStatus(form,e.message,true)}};
   async function submit(action){
     if(!form.reportValidity()){
       addStatus(form,"Complete the required fields before saving.",true);
       return;
     }
     let info;
     try{info=rawValues();}
     catch(e){addStatus(form,e?.message||"Check resource details.",true);return;}
     if(action==="publish"&&!window.confirm(api.preview
       ? "Save this resource on this device only?"
       : "Publish this resource to the StudyLab database?"))return;
     const newSimulation=form.elements.html?.files?.[0];
     const newPDF=form.elements.pack_pdf?.files?.[0];
     const newCover=form.elements.pack_cover?.files?.[0];
     const newAvatar=form.elements.telegram_avatar?.files?.[0];
     if(newAvatar && (!["image/jpeg","image/png","image/webp"].includes(newAvatar.type) ||
        !newAvatar.size || newAvatar.size>5*1024*1024)){
       addStatus(form,"Choose a JPG, PNG or WebP group picture under 5 MB.",true);
       return;
     }
     for(const b of [draftBtn,publish,preview])b.disabled=true;
     let uploadedSimulation=null,committed=false;
     const uploadedMedia=[];
     try{
       if(isSim){
         if(newSimulation){
           uploadedSimulation=await api.uploadSimulation(newSimulation);
           info.html_path=uploadedSimulation.path;
           info.html_name=newSimulation.name.slice(0,120);
         }
         if(!info.html_path)throw Error("Upload an HTML file before publishing.");
       }
       if(kind==="telegram" && newAvatar){
         const saved=await api.upload(newAvatar);
         uploadedMedia.push(saved);
         info.image=saved.url;
         info.avatar_file_path=saved.path;
         info.avatar_file_name=newAvatar.name.slice(0,120);
       }
       if(kind==="lesson-pack"){
         if(newPDF){
           const saved=await api.upload(newPDF);
           uploadedMedia.push(saved);
           info.url=saved.url;
           info.pack_file_path=saved.path;
           info.pack_file_name=newPDF.name.slice(0,120);
         }
         if(newCover){
           const saved=await api.upload(newCover);
           uploadedMedia.push(saved);
           info.image=saved.url;
           info.cover_file_path=saved.path;
           info.cover_file_name=newCover.name.slice(0,120);
         }
       }
       addStatus(form,action==="draft"?"Saving resource draft…":"Publishing resource…");
       await api.save(info,record?.revision||0,action);
       committed=true;
       let publicationVerified=api.preview ? false : null;
       if(action==="publish" && !api.preview && api.verifyPublishedContent){
         try{publicationVerified=await api.verifyPublishedContent(info);}
         catch(error){console.warn("Publication read-back check:",error);}
       }
       // Never delete a successfully published file if the list refresh fails.
       if(uploadedSimulation && draft?.html_path &&
          draft.html_path!==uploadedSimulation.path)
         api.removeSimulation(draft.html_path)
           .catch(e=>console.warn("Old simulation cleanup:",e));
       if(kind==="telegram" && draft?.avatar_file_path &&
          draft.avatar_file_path!==info.avatar_file_path)
         api.removeMedia(draft.avatar_file_path)
           .catch(e=>console.warn("Old Telegram picture cleanup:",e));
       if(kind==="lesson-pack" && uploadedMedia.length){
         for(const [before,after] of [[draft?.pack_file_path,info.pack_file_path],
           [draft?.cover_file_path,info.cover_file_path]])
           if(before && before!==after)
             api.removeMedia(before)
               .catch(e=>console.warn("Old lesson file cleanup:",e));
       }
       dialog.close();
       try{await onRefresh();}
       catch(e){console.warn("Resource saved; list refresh failed:",e);}
       const currentPanel=document.querySelector(".sladmin-publish");
       if(currentPanel){
         currentPanel.querySelector(".sladmin-publish-result")?.remove();
         const result=el("div",null,"sladmin-publish-result");
         result.setAttribute("role","status");
         const copy=el("span",action==="draft"?"Resource draft saved. Not publicly visible."
           :api.preview?"Saved on this device only. Not published for other students."
           :publicationVerified===true
             ?"Published and verified in Supabase. Open the page on THIS preview."
             :"Saved to Supabase. Public visibility could not be confirmed; check the linked preview page.");
         result.append(copy);
         if(action==="publish" && !api.preview){
           const link=el("a","View the updated page on this preview");
           link.href=new URL(info.page,location.href).href;
           link.target="_blank";link.rel="noopener noreferrer";
           result.append(link);
         }
         currentPanel.prepend(result);
       }
     }catch(e){
       if(!committed){
         if(uploadedSimulation)
           await api.removeSimulation(uploadedSimulation.path)
             .catch(err=>console.warn("Unpublished HTML cleanup:",err));
         for(const item of uploadedMedia)
           await api.removeMedia(item.path)
             .catch(err=>console.warn("Unpublished lesson file cleanup:",err));
       }
       addStatus(form,e?.message||"Could not save the resource.",true);
     }finally{
       for(const b of [draftBtn,publish,preview])b.disabled=false;
     }
   }
   draftBtn.onclick=()=>submit("draft");publish.onclick=()=>submit("publish");
 }
 return {open:openEditor};
}
window.StudyLabAdminPublisher=Object.freeze({mount});
})();