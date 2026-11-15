/* StudyLab announcement carousel v2.
   Admin-managed posts; no per-student view, read, click, or dismiss tracking.
   Approved destinations remain on this website; no ads or external redirects. */
(function(){
  "use strict";
  const card=document.getElementById("slDiscoveryCarousel");
  if(!card)return;
  const account=window.StudyLabAccount;
  const client=account?.client;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const BUCKET="studylab-announcements";
  const MAX_SOURCE=8*1024*1024,MAX_FINAL=2*1024*1024;
  const W=1200,H=480;
  const text=x=>String(x??"").trim();
  const els={
    badge:card.querySelector("[data-discovery-badge]"),
    title:card.querySelector("[data-discovery-title]"),
    body:card.querySelector("[data-discovery-body]"),
    action:card.querySelector("[data-discovery-action]"),
    art:card.querySelector("[data-discovery-art]"),
    main:card.querySelector("[data-discovery-main]"),
    dots:card.querySelector("[data-discovery-dots]")
  };
  const bannerImage=document.createElement("img");
  bannerImage.className="sl-discovery-custom-image";
  bannerImage.alt="";bannerImage.loading="lazy";bannerImage.decoding="async";
  bannerImage.hidden=true;
  card.insertBefore(bannerImage,els.main);
  const art={
    profile:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><rect x="75" y="17" width="112" height="116" rx="25" stroke="currentColor" stroke-width="3" opacity=".9"/><circle cx="131" cy="65" r="20" stroke="currentColor" stroke-width="4"/><path d="M95 112c5-31 66-31 72 0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="61" cy="91" r="28" fill="#aa73ff" fill-opacity=".23" stroke="#ab8fff" stroke-width="3"/><path d="M51 103c1-16 19-16 20 0m-10-19a8 8 0 1 0 0 16" stroke="#d2b4ff" stroke-width="3"/><path d="m176 111 8 7 14-17" stroke="#3ce5e6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    social:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><circle cx="90" cy="65" r="23" stroke="currentColor" stroke-width="4"/><circle cx="149" cy="58" r="19" stroke="#d6a3ff" stroke-width="4"/><path d="M44 122c3-34 87-34 91 0M127 106c15-16 47-12 53 9" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M187 18h-48a14 14 0 0 0-14 14v7a14 14 0 0 0 14 14h11l12 10V53h25a14 14 0 0 0 14-14v-7a14 14 0 0 0-14-14Z" stroke="#7ae7ff" stroke-width="3"/></svg>',
    science:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><path d="M84 20v48l-31 52c-5 10 1 15 11 15h101c10 0 17-7 12-16l-33-51V20M76 20h78" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M69 101c29 10 65-13 94 0l13 22c4 7-1 12-13 12H65c-10 0-13-5-9-12l13-22Z" fill="#6974ff" fill-opacity=".33"/><circle cx="113" cy="108" r="8" stroke="#90f6ff" stroke-width="3"/><circle cx="140" cy="119" r="5" fill="#9c85ff"/><circle cx="99" cy="85" r="4" fill="#90f6ff"/><path d="m176 26 7-7m-7 7 7 7m-7-7h-9m9 0h10" stroke="#7be3ff" stroke-width="3" stroke-linecap="round"/></svg>',
    announcement:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><path d="m66 60 95-33v89L66 84H44V60h22ZM65 85l12 39h26L91 95" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M178 55c18 7 18 31 0 38m10-51c26 13 25 52 0 64" stroke="#ad87ff" stroke-width="4" stroke-linecap="round"/><path d="m45 43 6-14m79 2 5-11" stroke="#71edff" stroke-width="3" stroke-linecap="round"/></svg>',
    room:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><circle cx="110" cy="73" r="50" stroke="currentColor" stroke-width="3" opacity=".65"/><path d="M92 33h35M94 114h33" stroke="#86f3ff" stroke-width="4" stroke-linecap="round"/><path d="M96 17h27m-14 0v13" stroke="#92d7ff" stroke-width="4"/><path d="M110 70V43m0 27 25 14" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="m173 26 10 4-10 4-4 10-4-10-10-4 10-4 4-10 4 10Z" stroke="#a39aff" stroke-width="3"/></svg>',
    chat:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><rect x="30" y="30" width="135" height="87" rx="23" stroke="currentColor" stroke-width="4"/><path d="m58 117-12 18v-24" stroke="currentColor" stroke-width="4"/><path d="M56 59h83M56 80h62" stroke="#8ceaf6" stroke-width="4" stroke-linecap="round"/><path d="M170 19h22a16 16 0 0 1 16 16v36a16 16 0 0 1-16 16h-7l-17 13V86" stroke="#b496ff" stroke-width="4" stroke-linejoin="round"/></svg>',
    about:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><path d="M50 111V46l65-23 65 23v65l-65 23-65-23Z" stroke="currentColor" stroke-width="3"/><path d="m50 46 65 25 65-25m-65 25v63" stroke="#8ddfff" stroke-width="3"/><path d="m90 49 25-10 25 10-25 10-25-10ZM102 57v12" stroke="#bd9fff" stroke-width="3" stroke-linejoin="round"/><circle cx="176" cy="32" r="14" fill="#83ddff" fill-opacity=".18" stroke="#83ddff" stroke-width="2"/></svg>'
  };
  let items=[],historyItems=[],current=0,admin=false;
  let interactionUntil=0,hovered=false,visible=true,rotation=null;
  let slideTimer=null;
  let historyDialog=null,managerDialog=null,aboutDialog=null;
  function safeDestination(raw){
    try{
      const path=text(raw);
      if(!path.startsWith("/")||path.startsWith("//")||path.includes("\\")
         ||/[\u0000-\u001f]/.test(path))return null;
      const url=new URL(path,location.origin);
      return url.origin===location.origin?url:null;
    }catch(_){return null;}
  }
  function imageUrl(path){
    if(!client||!/^banners\/[0-9a-f-]{36}\.webp$/.test(text(path)))return "";
    return client.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl||"";
  }
  function kindLabel(item){
    return item.kind==="feature"?"NEW FEATURE":
      item.kind==="discover"?"DISCOVER STUDYLAB":"STUDYLAB ANNOUNCEMENT";
  }
  function openProfile(){
    if(window.StudyLabProfileView?.open)window.StudyLabProfileView.open();
    else document.getElementById("profileButton")?.click();
  }
  function openChat(){
    const root=document.querySelector("[data-study-chat]");
    const panel=root?.querySelector("[data-chat-panel]");
    const button=root?.querySelector("[data-chat-button]");
    if(button&&panel?.hidden)button.click();
    if(!button)document.querySelector('[data-home-sidebar-target="chat"]')?.click();
  }
  function dialogShell(id,title){
    const dlg=document.createElement("dialog");
    dlg.className="sl-ann-dialog";dlg.id=id;dlg.setAttribute("aria-label",title);
    const header=document.createElement("div");header.className="sl-ann-dialog-head";
    const heading=document.createElement("h2");heading.textContent=title;
    const close=document.createElement("button");close.type="button";
    close.className="sl-ann-close";close.textContent="×";
    close.setAttribute("aria-label","Close");
    close.addEventListener("click",()=>dlg.close());
    header.append(heading,close);
    const content=document.createElement("div");content.className="sl-ann-dialog-body";
    dlg.append(header,content);
    dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});
    document.body.append(dlg);
    return {dlg,content};
  }
  function openAbout(){
    if(!aboutDialog)aboutDialog=dialogShell("slAboutStudyLab","About StudyLab");
    const {dlg,content}=aboutDialog;
    content.replaceChildren();
    const summary=document.createElement("p");summary.className="sl-ann-dialog-intro";
    summary.textContent="StudyLab helps Sri Lankan G.C.E. A/L students explore, practise and learn together.";
    content.append(summary);
    const features=[
      ["Practical Simulations","/#practical-simulations"],
      ["Live Study Room","/study-room.html?completeProfile=1&returnTo=%2Fstudy-room.html"],
      ["StudyLab Social","/#social"],
      ["Past Papers","/#past-papers"],
      ["A/L Resources","/#other-al-resources"]
    ];
    for(const [label,path] of features){
      const btn=document.createElement("button");
      btn.className="sl-ann-secondary";btn.type="button";btn.textContent=label+" ↗";
      btn.addEventListener("click",()=>{dlg.close();navigate(path);});
      content.append(btn);
    }
    if(!dlg.open)dlg.showModal();
  }
  function navigate(raw){
    const url=safeDestination(raw);
    if(!url)return;
    if(url.pathname==="/"&&url.hash==="#profile"){openProfile();return;}
    if(url.pathname==="/"&&url.hash==="#study-chat"){openChat();return;}
    if(url.pathname==="/"&&url.hash==="#about-studylab"){openAbout();return;}
    if(url.pathname===location.pathname&&!url.search&&url.hash){
      const section=document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if(section){
        history.replaceState(null,"",url.hash);
        section.scrollIntoView({behavior:reduced.matches?"auto":"smooth",block:"start"});
        return;
      }
    }
    location.assign(url.href);
  }
  function explore(item){
    interactionUntil=Date.now()+12000;
    if(item?.target_path)navigate(item.target_path);
  }
  function render(){
    if(!items.length){
      card.hidden=true;
      card.closest(".sl-home-intro-row")?.classList.add("sl-discovery-no-posts");
      return;
    }
    card.hidden=false;
    card.closest(".sl-home-intro-row")?.classList.remove("sl-discovery-no-posts");
    current=Math.min(current,items.length-1);
    const item=items[current];
    els.badge.textContent=kindLabel(item);
    els.title.textContent=item.title;
    els.body.textContent=item.body;
    els.action.textContent=item.cta_label||"Explore";
    els.main.setAttribute("aria-label",item.title+". "+(item.cta_label||"Explore"));
    els.art.innerHTML=art[item.art_key]||art.announcement;
    const url=imageUrl(item.image_path);
    bannerImage.hidden=!url;
    if(url)bannerImage.src=url;
    else bannerImage.removeAttribute("src");
    card.classList.toggle("has-uploaded-banner",Boolean(url));
    card.dataset.discoveryKind=item.kind||"announcement";
    els.dots.replaceChildren();
    for(let i=0;i<items.length;i++){
      const dot=document.createElement("button");
      dot.type="button";dot.className="sl-discovery-dot";
      dot.setAttribute("aria-label","Show slide "+(i+1)+": "+items[i].title);
      dot.setAttribute("aria-current",String(i===current));
      dot.addEventListener("click",()=>{
        interactionUntil=Date.now()+12000;changeSlide(i);
      });
      els.dots.append(dot);
    }
  }
  function changeSlide(index){
    if(!items.length)return;
    const next=(index+items.length)%items.length;
    if(slideTimer){clearTimeout(slideTimer);slideTimer=null;}
    if(next===current){
      card.classList.remove("is-transitioning");
      return;
    }
    // Keep the four-second cadence; fade the *content*, not the card's
    // background, so neither navigation buttons nor layout ever jump.
    if(reduced.matches){
      card.classList.remove("is-transitioning");
      current=next;render();return;
    }
    card.classList.add("is-transitioning");
    slideTimer=setTimeout(()=>{
      slideTimer=null;
      current=next;render();
      requestAnimationFrame(()=>card.classList.remove("is-transitioning"));
    },190);
  }
  function step(delta){
    if(!items.length)return;
    interactionUntil=Date.now()+12000;
    changeSlide(current+delta);
  }
  card.querySelector("[data-discovery-prev]").addEventListener("click",()=>step(-1));
  card.querySelector("[data-discovery-next]").addEventListener("click",()=>step(1));
  els.main.addEventListener("click",()=>explore(items[current]));
  card.addEventListener("mouseenter",()=>{hovered=true;});
  card.addEventListener("mouseleave",()=>{hovered=false;});
  card.addEventListener("focusin",()=>{hovered=true;});
  card.addEventListener("focusout",e=>{if(!card.contains(e.relatedTarget))hovered=false;});
  card.addEventListener("touchstart",()=>{interactionUntil=Date.now()+12000;},{passive:true});
  if("IntersectionObserver" in window){
    new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;},{threshold:.25}).observe(card);
  }
  async function loadAnnouncements(){
    if(!client)return;
    const {data,error}=await client.from("studylab_announcements")
      .select("id,kind,title,body,cta_label,target_path,art_key,image_path,sort_order,published,starts_at,ends_at,created_at")
      .order("sort_order",{ascending:true})
      .order("created_at",{ascending:true}).limit(150);
    if(error){
      console.warn("Announcements unavailable:",error.message);
      return;
    }
    const now=Date.now();
    historyItems=(data||[]).filter(x=>x.published&&new Date(x.starts_at).getTime()<=now
      &&safeDestination(x.target_path));
    items=historyItems.filter(x=>!x.ends_at||new Date(x.ends_at).getTime()>now);
    if(slideTimer){clearTimeout(slideTimer);slideTimer=null;}
    card.classList.remove("is-transitioning");
    current=Math.min(current,Math.max(0,items.length-1));
    render();
  }
  function startRotation(){
    if(rotation)clearInterval(rotation);
    rotation=setInterval(()=>{
      if(items.length<2||reduced.matches||document.hidden||hovered||!visible||Date.now()<interactionUntil)return;
      changeSlide(current+1);
    },4000);
  }
  reduced.addEventListener?.("change",()=>{interactionUntil=Date.now()+2000;});
  render();startRotation();loadAnnouncements();

  function emptyMessage(parent,message){
    const p=document.createElement("p");p.className="sl-ann-empty";p.textContent=message;
    parent.append(p);
  }
  function historyCard(item){
    const box=document.createElement("article");box.className="sl-ann-history-card";
    const label=document.createElement("span");label.className="sl-ann-history-tag";
    label.textContent=item.kind==="feature"?"New feature":
      item.kind==="discover"?"Discover":"Announcement";
    const h=document.createElement("h3");h.textContent=item.title;
    const p=document.createElement("p");p.textContent=item.body;
    const footer=document.createElement("div");footer.className="sl-ann-history-footer";
    const date=document.createElement("time");date.dateTime=item.starts_at||"";
    date.textContent=new Date(item.starts_at||Date.now()).toLocaleDateString(undefined,{
      day:"numeric",month:"short",year:"numeric"
    });
    const btn=document.createElement("button");btn.type="button";btn.className="sl-ann-card-action";
    btn.textContent=item.cta_label||"Explore";
    btn.addEventListener("click",()=>{historyDialog?.dlg.close();explore(item);});
    if(item.image_path){
      const src=imageUrl(item.image_path);
      if(src){
        const img=document.createElement("img");img.className="sl-ann-history-image";
        img.alt="";img.loading="lazy";img.src=src;box.append(img);
      }
    }
    footer.append(date,btn);
    box.append(label,h,p,footer);
    return box;
  }
  function canManage(){return admin;}
  async function verifyAdmin(){
    const user=account?.getUser?.();
    if(!user||user.is_anonymous||!client){admin=false;return false;}
    const result=await client.rpc("studylab_social_is_admin");
    admin=!result.error&&result.data===true;
    return admin;
  }
  async function openHistory(){
    if(!historyDialog)historyDialog=dialogShell("slAnnouncementHistory","StudyLab Announcements");
    const {dlg,content}=historyDialog;
    content.replaceChildren();
    await loadAnnouncements();
    const intro=document.createElement("p");intro.className="sl-ann-dialog-intro";
    intro.textContent="StudyLab updates and features, including previously published announcements.";
    content.append(intro);
    if(historyItems.length)for(const item of historyItems)content.append(historyCard(item));
    else emptyMessage(content,"No published announcements yet.");
    const foot=document.createElement("div");foot.className="sl-ann-dialog-actions";
    const tour=document.createElement("button");tour.type="button";tour.className="sl-ann-secondary";
    tour.textContent="Explore StudyLab";
    tour.addEventListener("click",()=>{dlg.close();navigate("/#practical-simulations");});
    foot.append(tour);
    if(await verifyAdmin()){
      const manage=document.createElement("button");manage.type="button";
      manage.textContent="Manage announcements";manage.className="sl-ann-primary";
      manage.addEventListener("click",()=>{dlg.close();openManager();});
      foot.append(manage);
    }
    content.append(foot);
    if(!dlg.open)dlg.showModal();
  }
  function localTime(value){
    if(!value)return "";
    const d=new Date(value);
    if(!Number.isFinite(d.getTime()))return "";
    return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  function convertImage(file){
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))
      return Promise.reject(new Error("Use JPG, PNG or WebP."));
    if(file.size>MAX_SOURCE)
      return Promise.reject(new Error("Original image must be 8 MB or smaller."));
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file);
      const img=new Image();
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Could not read the image."));};
      img.onload=async()=>{
        URL.revokeObjectURL(url);
        try{
          const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
          const context=canvas.getContext("2d");
          if(!context)throw new Error("Image resizing unavailable in this browser.");
          const cropW=Math.min(img.naturalWidth,img.naturalHeight*W/H);
          const cropH=cropW*H/W;
          const cropX=(img.naturalWidth-cropW)/2,cropY=(img.naturalHeight-cropH)/2;
          context.drawImage(img,cropX,cropY,cropW,cropH,0,0,W,H);
          const exportBlob=quality=>new Promise(done=>canvas.toBlob(done,"image/webp",quality));
          let processed=null;
          for(const quality of [.88,.78,.67,.55]){
            processed=await exportBlob(quality);
            if(processed?.type==="image/webp"&&processed.size<=MAX_FINAL)break;
          }
          if(!processed||processed.type!=="image/webp"||processed.size>MAX_FINAL)
            throw new Error("Image couldn't be compressed below 2 MB.");
          resolve(processed);
        }catch(err){reject(err);}
      };
      img.src=url;
    });
  }
  async function openManager(){
    if(!await verifyAdmin())return;
    if(!managerDialog)managerDialog=dialogShell("slAnnouncementManager","Manage Announcements");
    const {dlg,content}=managerDialog;
    content.replaceChildren();
    const intro=document.createElement("p");intro.className="sl-ann-dialog-intro";
    intro.textContent="Create, upload, edit, reorder, publish or delete StudyLab banners. Changes are visible on the Home carousel.";
    content.append(intro);
    const form=document.createElement("form");form.className="sl-ann-editor";
    form.innerHTML=[
      '<label>Post type<select name="kind"><option value="feature">New feature</option><option value="announcement">Announcement</option><option value="discover">Discover StudyLab</option></select></label>',
      '<label>Headline<input name="title" maxlength="90" minlength="3" required placeholder="New StudyLab feature"></label>',
      '<label>Short message<textarea name="body" maxlength="300" minlength="5" rows="3" required placeholder="Keep the text short for the 4-second carousel."></textarea></label>',
      '<div class="sl-ann-form-pair"><label>Button text<input name="cta_label" maxlength="36" value="Explore" required></label><label>Slide order<input name="sort_order" type="number" min="1" max="10000" step="1" value="1000" required></label></div>',
      '<label>Open when clicked<select name="target_path"><option value="/#profile">View Profile</option><option value="/#social">Social / Followers</option><option value="/study-room.html?completeProfile=1&amp;returnTo=%2Fstudy-room.html">Enter Live Study Room</option><option value="/#study-chat">Open Chat</option><option value="/#practical-simulations">Practical Simulations</option><option value="/#about-studylab">About StudyLab</option><option value="/#past-papers">Past Papers</option><option value="/#telegram-links">Telegram channels</option><option value="/#other-al-resources">Other A/L resources</option><option value="/#home-overview">Home</option><option value="custom">Another StudyLab page...</option></select></label>',
      '<label class="sl-ann-custom-path" hidden>Custom StudyLab path<input name="custom_path" placeholder="/physics.html or /#social"></label>',
      '<label>Decorative illustration<select name="art_key"><option value="announcement">Announcement megaphone</option><option value="profile">Profile</option><option value="social">Community</option><option value="room">Study timer</option><option value="chat">Chat</option><option value="science">Science</option><option value="about">StudyLab</option></select></label>',
      '<label>Custom banner image (optional)<input name="image_file" type="file" accept="image/jpeg,image/png,image/webp"></label>',
      '<p class="sl-ann-image-guidance">Recommended: 1200 × 480 px (2.5:1). JPG, PNG or WebP; original up to 8 MB. StudyLab automatically crops and compresses it to 1200 × 480 WebP, maximum 2 MB.</p>',
      '<img class="sl-ann-image-preview" data-banner-preview alt="Banner image preview" hidden>',
      '<label class="sl-ann-toggle sl-ann-remove-image" hidden><input name="remove_image" type="checkbox"> Remove uploaded image and use SVG</label>',
      '<div class="sl-ann-form-pair"><label>Publish from<input name="starts_at" type="datetime-local"></label><label>Expire at (optional)<input name="ends_at" type="datetime-local"></label></div>',
      '<label class="sl-ann-toggle"><input name="published" type="checkbox" checked> Publish this banner</label>',
      '<p class="sl-ann-form-status" role="status" aria-live="polite"></p>',
      '<div class="sl-ann-dialog-actions"><button class="sl-ann-secondary" type="button" data-new-post>New post</button><button class="sl-ann-primary" type="submit">Publish / Save</button></div>'
    ].join("");
    const list=document.createElement("section");list.className="sl-ann-admin-list";
    const listTitle=document.createElement("h3");listTitle.textContent="Your banners (smaller order appears first)";
    list.append(listTitle);
    content.append(form,list);
    const elements=form.elements;
    const find=name=>elements.namedItem(name);
    const state=form.querySelector(".sl-ann-form-status");
    const preview=form.querySelector("[data-banner-preview]");
    const fileField=find("image_file");
    const removeField=find("remove_image");
    const removeLabel=form.querySelector(".sl-ann-remove-image");
    const selectTarget=find("target_path");
    const customWrapper=form.querySelector(".sl-ann-custom-path");
    const submit=form.querySelector('[type="submit"]');
    let editing=null,processed=null,tempUrl="",processing=false;
    const setStatus=(message,bad=false)=>{
      state.textContent=message;state.dataset.error=String(bad);
    };
    function clearPreview(){
      if(tempUrl){URL.revokeObjectURL(tempUrl);tempUrl="";}
      preview.hidden=true;preview.removeAttribute("src");
    }
    function showPreview(url){
      preview.hidden=!url;
      if(url)preview.src=url;
      else preview.removeAttribute("src");
    }
    function targetChanged(){
      customWrapper.hidden=selectTarget.value!=="custom";
    }
    selectTarget.addEventListener("change",targetChanged);
    function resetEditor(){
      editing=null;processed=null;processing=false;
      form.reset();clearPreview();fileField.value="";
      removeLabel.hidden=true;removeField.checked=false;
      selectTarget.value="/#profile";targetChanged();
      find("sort_order").value="1000";
      setStatus("Ready to create a new banner.");
      submit.disabled=false;
    }
    form.querySelector("[data-new-post]").addEventListener("click",resetEditor);
    function selectPost(item){
      resetEditor();editing=item;
      for(const key of ["kind","title","body","cta_label","sort_order","art_key"]){
        find(key).value=item[key]??"";
      }
      if([...selectTarget.options].some(option=>option.value===item.target_path)){
        selectTarget.value=item.target_path;
      }else{
        selectTarget.value="custom";find("custom_path").value=item.target_path;
      }
      targetChanged();
      find("starts_at").value=localTime(item.starts_at);
      find("ends_at").value=localTime(item.ends_at);
      find("published").checked=Boolean(item.published);
      removeLabel.hidden=!item.image_path;
      showPreview(imageUrl(item.image_path));
      setStatus("Editing: "+item.title);
      form.scrollIntoView({behavior:reduced.matches?"auto":"smooth",block:"start"});
    }
    fileField.addEventListener("change",async()=>{
      processed=null;clearPreview();
      const file=fileField.files?.[0];
      if(!file){showPreview(imageUrl(editing?.image_path));return;}
      processing=true;submit.disabled=true;
      setStatus("Preparing 1200 × 480 banner...");
      try{
        processed=await convertImage(file);
        tempUrl=URL.createObjectURL(processed);
        showPreview(tempUrl);
        removeField.checked=false;
        setStatus("Image ready: "+Math.ceil(processed.size/1024)+" KB WebP.");
      }catch(e){
        processed=null;fileField.value="";
        showPreview(imageUrl(editing?.image_path));
        setStatus(e.message||"Could not process image.",true);
      }finally{processing=false;submit.disabled=false;}
    });
    removeField.addEventListener("change",()=>{
      if(removeField.checked){
        processed=null;fileField.value="";clearPreview();
      }else showPreview(imageUrl(editing?.image_path));
    });
    function labelStatus(item){
      const now=Date.now();
      if(!item.published)return "Draft";
      if(new Date(item.starts_at).getTime()>now)return "Scheduled";
      if(item.ends_at&&new Date(item.ends_at).getTime()<=now)return "Expired";
      return "Published";
    }
    async function refreshList(){
      const {data,error}=await client.from("studylab_announcements")
        .select("id,kind,title,body,cta_label,target_path,art_key,image_path,sort_order,published,starts_at,ends_at,created_at")
        .order("sort_order",{ascending:true}).order("created_at",{ascending:true}).limit(150);
      list.replaceChildren(listTitle);
      if(error){emptyMessage(list,error.message);return;}
      if(!data?.length){emptyMessage(list,"No banners yet. Create the first one above.");return;}
      for(const item of data){
        const row=document.createElement("div");row.className="sl-ann-admin-row";
        if(item.image_path){
          const url=imageUrl(item.image_path);
          if(url){
            const thumb=document.createElement("img");
            thumb.src=url;thumb.alt="";thumb.loading="lazy";
            thumb.className="sl-ann-admin-thumb";row.append(thumb);
          }
        }
        const details=document.createElement("span");
        details.textContent="#"+item.sort_order+" · "+labelStatus(item)+" · "+item.title;
        const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";
        edit.addEventListener("click",()=>selectPost(item));
        const del=document.createElement("button");del.type="button";del.textContent="Delete";
        del.addEventListener("click",async()=>{
          if(!confirm("Delete '"+item.title+"' permanently? It will disappear from the carousel."))return;
          del.disabled=true;
          const {data:removed,error:e}=await client.from("studylab_announcements")
            .delete().eq("id",item.id).select("id");
          if(e||!removed?.length){
            setStatus(e?.message||"Could not delete banner.",true);
            del.disabled=false;return;
          }
          if(item.image_path){
            const {error:removeError}=await client.storage.from(BUCKET).remove([item.image_path]);
            if(removeError)console.warn("Old banner image cleanup:",removeError.message);
          }
          if(editing?.id===item.id)resetEditor();
          await Promise.all([refreshList(),loadAnnouncements()]);
          setStatus("Deleted '"+item.title+"'.");
        });
        row.append(details,edit,del);list.append(row);
      }
    }
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(processing||!form.reportValidity())return;
      if(!await verifyAdmin()){setStatus("Admin permission required.",true);return;}
      const field=name=>text(find(name)?.value);
      const destination=selectTarget.value==="custom"?field("custom_path"):selectTarget.value;
      if(!safeDestination(destination)){setStatus("Use a valid internal StudyLab destination.",true);return;}
      const sortOrder=Number(field("sort_order"));
      if(!Number.isInteger(sortOrder)||sortOrder<1||sortOrder>10000){
        setStatus("Display order must be from 1 to 10000.",true);return;
      }
      const start=field("starts_at"),end=field("ends_at");
      let startIso,endIso;
      try{
        startIso=start?new Date(start).toISOString():(editing?.starts_at||new Date().toISOString());
        endIso=end?new Date(end).toISOString():null;
      }catch(_){setStatus("Enter a valid publish/expiry date.",true);return;}
      if(endIso&&new Date(endIso)<=new Date(startIso)){
        setStatus("Expiry must be later than the start date.",true);return;
      }
      submit.disabled=true;
      let newImagePath="";
      try{
        const user=account.getUser();
        if(processed){
          if(!window.crypto?.randomUUID)throw Error("Secure image IDs unavailable in this browser.");
          newImagePath="banners/"+window.crypto.randomUUID()+".webp";
          const {error:uploadError}=await client.storage.from(BUCKET).upload(newImagePath,processed,{
            contentType:"image/webp",cacheControl:"3600",upsert:false
          });
          if(uploadError)throw uploadError;
        }
        const oldImage=editing?.image_path||null;
        const nextImage=newImagePath||(removeField.checked?null:oldImage);
        const payload={
          kind:field("kind"),title:field("title"),body:field("body"),
          cta_label:field("cta_label"),target_path:destination,
          art_key:field("art_key"),image_path:nextImage,sort_order:sortOrder,
          published:find("published").checked,
          starts_at:startIso,ends_at:endIso,updated_at:new Date().toISOString()
        };
        let query;
        if(editing)query=client.from("studylab_announcements").update(payload).eq("id",editing.id).select("id");
        else query=client.from("studylab_announcements").insert({
          ...payload,created_by:user.id
        }).select("id");
        const {data:saved,error:saveError}=await query;
        if(saveError||!saved?.length)throw saveError||Error("Database did not save the banner.");
        if(oldImage&&oldImage!==nextImage){
          const {error:cleanupError}=await client.storage.from(BUCKET).remove([oldImage]);
          if(cleanupError)console.warn("Banner cleanup:",cleanupError.message);
        }
        newImagePath="";resetEditor();
        await Promise.all([loadAnnouncements(),refreshList()]);
        setStatus("Banner saved. Published posts will appear in the Home carousel.");
      }catch(e){
        if(newImagePath){
          await client.storage.from(BUCKET).remove([newImagePath]).catch(()=>{});
        }
        setStatus(e.message||"Could not save banner.",true);
      }finally{submit.disabled=false;}
    });
    resetEditor();
    await refreshList();
    if(!dlg.open)dlg.showModal();
  }
  window.StudyLabAnnouncements=Object.freeze({openHistory,openManager,canManage});
  Promise.resolve(account?.ready).then(async()=>{
    await verifyAdmin();
    await loadAnnouncements();
    document.dispatchEvent(new Event("studylab:announcements-ready"));
  }).catch(e=>console.warn("Announcement initialization:",e));
})();
