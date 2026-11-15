/* StudyLab announcement carousel v3.
   Safe external links, custom image cropping, image-only banners,
   per-post transitions/timing; no student read or click tracking. */
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
  let slideTimer=null,revealTimer=null;
  let historyDialog=null,managerDialog=null,aboutDialog=null;
  function safeDestination(raw){
    try{
      const path=text(raw);
      if(!path||/[\u0000-\u001f\u007f]/.test(path)||path.includes("\\"))return null;
      const relative=path.startsWith("/")&&!path.startsWith("//");
      const web=/^https?:\/\//i.test(path);
      if(!relative&&!web)return null;
      const url=new URL(path,location.origin);
      if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return null;
      if(relative&&url.origin!==location.origin)return null;
      return url;
    }catch(_){return null;}
  }
  function isExternal(url){return url.origin!==location.origin;}
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
    if(isExternal(url)){
      window.open(url.href,"_blank","noopener,noreferrer");
      return;
    }
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
    interactionUntil=Date.now()+2000;
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
    els.art.innerHTML=item.art_key==="none"?"":(art[item.art_key]||art.announcement);
    const url=imageUrl(item.image_path);
    bannerImage.hidden=!url;
    if(url)bannerImage.src=url;
    else bannerImage.removeAttribute("src");
    card.classList.toggle("has-uploaded-banner",Boolean(url));
    card.classList.toggle("sl-discovery-image-only",item.display_mode==="image"&&Boolean(url));
    card.classList.toggle("sl-discovery-no-art",item.art_key==="none");
    card.dataset.discoveryKind=item.kind||"announcement";
    card.dataset.transitionStyle=item.transition_style||"fade";
    const destination=safeDestination(item.target_path);
    els.main.title=destination&&isExternal(destination)?"Opens external website in a new tab":item.title;
    els.dots.replaceChildren();
    for(let i=0;i<items.length;i++){
      const dot=document.createElement("button");
      dot.type="button";dot.className="sl-discovery-dot";
      dot.setAttribute("aria-label","Show slide "+(i+1)+": "+items[i].title);
      dot.setAttribute("aria-current",String(i===current));
      dot.addEventListener("click",()=>{
        interactionUntil=Date.now()+2000;changeSlide(i);
      });
      els.dots.append(dot);
    }
  }
  function stopTransition(){
    if(slideTimer){clearTimeout(slideTimer);slideTimer=null;}
    if(revealTimer){clearTimeout(revealTimer);revealTimer=null;}
    card.classList.remove("is-transitioning","is-revealing");
  }
  function transitionOf(item){
    return ["none","fade","slide","dissolve","zoom"].includes(item?.transition_style)?item.transition_style:"fade";
  }
  function durationOf(item){
    return Math.min(10,Math.max(1,Number(item?.display_seconds)||4))*1000;
  }
  function changeSlide(index){
    if(!items.length)return;
    const next=(index+items.length)%items.length;
    if(next===current){stopTransition();scheduleRotation();return;}
    const effect=transitionOf(items[current]);
    stopTransition();
    card.dataset.exitStyle=effect;
    if(reduced.matches||effect==="none"){
      current=next;render();scheduleRotation();return;
    }
    const exitMs={fade:180,slide:230,dissolve:270,zoom:210}[effect];
    card.classList.add("is-transitioning");
    slideTimer=setTimeout(()=>{
      slideTimer=null;
      current=next;render();
      card.classList.remove("is-transitioning");
      card.classList.add("is-revealing");
      revealTimer=setTimeout(()=>{revealTimer=null;card.classList.remove("is-revealing");},420);
      scheduleRotation();
    },exitMs);
  }
  function step(delta){
    if(!items.length)return;
    interactionUntil=Date.now()+2000;
    changeSlide(current+delta);
  }
  card.querySelector("[data-discovery-prev]").addEventListener("click",()=>step(-1));
  card.querySelector("[data-discovery-next]").addEventListener("click",()=>step(1));
  els.main.addEventListener("click",()=>explore(items[current]));
  card.addEventListener("mouseenter",()=>{hovered=true;});
  card.addEventListener("mouseleave",()=>{hovered=false;});
  card.addEventListener("focusin",()=>{hovered=true;});
  card.addEventListener("focusout",e=>{if(!card.contains(e.relatedTarget))hovered=false;});
  card.addEventListener("touchstart",()=>{interactionUntil=Date.now()+2000;},{passive:true});
  if("IntersectionObserver" in window){
    new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;},{threshold:.25}).observe(card);
  }
  async function loadAnnouncements(){
    if(!client)return;
    const {data,error}=await client.from("studylab_announcements")
      .select("id,kind,title,body,cta_label,target_path,art_key,image_path,sort_order,display_seconds,transition_style,display_mode,published,starts_at,ends_at,created_at")
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
    stopTransition();
    current=Math.min(current,Math.max(0,items.length-1));
    render();scheduleRotation();
  }
  function scheduleRotation(){
    if(rotation){clearTimeout(rotation);rotation=null;}
    if(items.length<2||reduced.matches)return;
    function tick(){
      rotation=null;
      if(reduced.matches||document.hidden||hovered||!visible||Date.now()<interactionUntil){
        rotation=setTimeout(tick,800);return;
      }
      changeSlide(current+1);
    }
    rotation=setTimeout(tick,durationOf(items[current]));
  }
  reduced.addEventListener?.("change",()=>{interactionUntil=Date.now()+1200;scheduleRotation();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)scheduleRotation();});
  render();loadAnnouncements();

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
  async function convertImage(crop){
    const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("This browser cannot process images.");
    ctx.drawImage(crop.image,crop.x,crop.y,crop.w,crop.h,0,0,W,H);
    const exportBlob=quality=>new Promise(done=>canvas.toBlob(done,"image/webp",quality));
    for(const q of [.9,.8,.7,.6,.5]){
      const result=await exportBlob(q);
      if(result?.type==="image/webp"&&result.size<=MAX_FINAL)return result;
    }
    throw new Error("Image could not be compressed below 2 MB.");
  }
  async function openManager(){
    if(!await verifyAdmin())return;
    if(!managerDialog)managerDialog=dialogShell("slAnnouncementManager","Manage Announcements");
    const {dlg,content}=managerDialog;
    content.replaceChildren();
    const intro=document.createElement("p");intro.className="sl-ann-dialog-intro";
    intro.textContent="Create StudyLab updates or clean image ads. Choose animations, display time, links, and exactly which part of your picture shows.";
    content.append(intro);
    const form=document.createElement("form");form.className="sl-ann-editor";
    form.innerHTML=[
      '<label>Post type<select name="kind"><option value="feature">New feature</option><option value="announcement">Announcement / advertisement</option><option value="discover">Discover StudyLab</option></select></label>',
      '<label>Headline<input name="title" maxlength="90" minlength="3" required placeholder="New StudyLab feature"></label>',
      '<label>Short message<textarea name="body" maxlength="300" minlength="5" rows="3" required placeholder="Shown below the headline on standard banners."></textarea></label>',
      '<div class="sl-ann-form-pair"><label>Button text<input name="cta_label" maxlength="36" value="Explore" required></label><label>Slide order<input name="sort_order" type="number" min="1" max="10000" step="1" value="1000" required></label></div>',
      '<label>Open when clicked<select name="target_path"><option value="/#profile">View Profile</option><option value="/#social">Social / Followers</option><option value="/study-room.html?completeProfile=1&amp;returnTo=%2Fstudy-room.html">Enter Live Study Room</option><option value="/#study-chat">Open Chat</option><option value="/#practical-simulations">Practical Simulations</option><option value="/#about-studylab">About StudyLab</option><option value="/#past-papers">Past Papers</option><option value="/#telegram-links">Telegram channels</option><option value="/#other-al-resources">Other A/L resources</option><option value="/#home-overview">Home</option><option value="custom">Any website or StudyLab link...</option></select></label>',
      '<label class="sl-ann-custom-path" hidden>Link address<input name="custom_path" type="text" maxlength="2048" placeholder="https://example.com or /physics.html" autocomplete="off"></label>',
      '<p class="sl-ann-image-guidance">External HTTP(S) links open in a separate tab. Only approved administrators can publish them.</p>',
      '<div class="sl-ann-form-pair"><label>Banner layout<select name="display_mode"><option value="standard">Normal: headline and button</option><option value="image">Image only: clean artwork / ad</option></select></label><label>Decorative illustration<select name="art_key"><option value="announcement">Announcement megaphone</option><option value="none">None</option><option value="profile">Profile</option><option value="social">Community</option><option value="room">Study timer</option><option value="chat">Chat</option><option value="science">Science</option><option value="about">StudyLab</option></select></label></div>',
      '<div class="sl-ann-form-pair"><label>Transition effect<select name="transition_style"><option value="fade">Soft fade</option><option value="slide">Slide away</option><option value="dissolve">Soft dissolve / dust</option><option value="zoom">Soft zoom out</option><option value="none">None: instant change</option></select></label><label>Display time<span class="sl-ann-range-line"><input name="display_seconds" type="range" min="1" max="10" step="1" value="4"><output data-duration-value>4 seconds</output></span></label></div>',
      '<label>Custom banner image (optional)<input name="image_file" type="file" accept="image/jpeg,image/png,image/webp"></label>',
      '<p class="sl-ann-image-guidance">Recommended 1200 × 480 px (2.5:1). JPG/PNG/WebP, original up to 8 MB, final 1200 × 480 WebP ≤ 2 MB. Upload a picture, then drag the frame and adjust zoom to select its crop.</p>',
      '<div class="sl-ann-crop-editor" data-crop-editor hidden>',
      '  <div class="sl-ann-crop-stage" data-crop-stage><img data-crop-source alt="Original image for cropping" draggable="false"><div class="sl-ann-crop-box" data-crop-box tabindex="0" role="group" aria-label="Move crop selection using drag or arrow keys"><span>DRAG TO POSITION</span></div></div>',
      '  <label>Crop zoom <span class="sl-ann-range-line"><input type="range" data-crop-zoom min="1" max="3" step="0.1" value="1"><output data-zoom-value>1.0×</output></span></label>',
      '  <p class="sl-ann-image-guidance">Selected 2.5:1 area (drag rectangle or use arrow keys). Cropping applies before upload, not to your original file.</p>',
      '  <canvas data-crop-preview width="600" height="240" class="sl-ann-crop-result" aria-label="Preview of selected banner area"></canvas>',
      '</div>',
      '<img class="sl-ann-image-preview" data-banner-preview alt="Existing banner image" hidden>',
      '<label class="sl-ann-toggle sl-ann-remove-image" hidden><input name="remove_image" type="checkbox"> Remove image and use illustration</label>',
      '<div class="sl-ann-form-pair"><label>Publish from<input name="starts_at" type="datetime-local"></label><label>Expire at (optional)<input name="ends_at" type="datetime-local"></label></div>',
      '<label class="sl-ann-toggle"><input name="published" type="checkbox" checked> Publish this banner</label>',
      '<p class="sl-ann-form-status" role="status" aria-live="polite"></p>',
      '<div class="sl-ann-dialog-actions"><button class="sl-ann-secondary" type="button" data-new-post>New post</button><button class="sl-ann-primary" type="submit">Publish / Save</button></div>'
    ].join("");
    const list=document.createElement("section");list.className="sl-ann-admin-list";
    const listTitle=document.createElement("h3");listTitle.textContent="Banners (smaller order shows first)";
    list.append(listTitle);
    content.append(form,list);
    const find=name=>form.elements.namedItem(name);
    const status=form.querySelector(".sl-ann-form-status");
    const submit=form.querySelector('[type="submit"]');
    const preview=form.querySelector("[data-banner-preview]");
    const fileField=find("image_file"),removeField=find("remove_image");
    const removeLabel=form.querySelector(".sl-ann-remove-image");
    const selectTarget=find("target_path"),customWrapper=form.querySelector(".sl-ann-custom-path");
    const cropEditor=form.querySelector("[data-crop-editor]");
    const cropStage=form.querySelector("[data-crop-stage]");
    const cropBox=form.querySelector("[data-crop-box]");
    const cropSource=form.querySelector("[data-crop-source]");
    const cropPreview=form.querySelector("[data-crop-preview]");
    const cropZoom=form.querySelector("[data-crop-zoom]");
    const zoomValue=form.querySelector("[data-zoom-value]");
    const durationValue=form.querySelector("[data-duration-value]");
    let editing=null,crop=null,processing=false,loadToken=0;
    let pointer=null;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const setStatus=(message,bad=false)=>{
      status.textContent=message;status.dataset.error=String(bad);
    };
    function setPreview(url){
      preview.hidden=!url;
      if(url)preview.src=url;
      else preview.removeAttribute("src");
    }
    function clearCrop(){
      ++loadToken;
      if(crop?.url)URL.revokeObjectURL(crop.url);
      crop=null;pointer=null;
      cropEditor.hidden=true;cropSource.removeAttribute("src");
      cropZoom.value="1";zoomValue.textContent="1.0×";
    }
    function updateDuration(){
      durationValue.textContent=find("display_seconds").value+" seconds";
    }
    find("display_seconds").addEventListener("input",updateDuration);
    function targetChanged(){customWrapper.hidden=selectTarget.value!=="custom";}
    selectTarget.addEventListener("change",targetChanged);
    function layoutChanged(){
      if(find("display_mode").value==="image"){
        setStatus("Image-only banners show your picture edge-to-edge, without text overlays or decorative effects.");
      }
    }
    find("display_mode").addEventListener("change",layoutChanged);
    function resetEditor(){
      editing=null;clearCrop();processing=false;
      form.reset();fileField.value="";
      setPreview("");removeLabel.hidden=true;removeField.checked=false;
      selectTarget.value="/#profile";targetChanged();
      find("sort_order").value="1000";updateDuration();
      setStatus("Ready to create a new banner.");
      submit.disabled=false;
    }
    form.querySelector("[data-new-post]").addEventListener("click",resetEditor);
    function cropBounds(){
      if(!crop)return null;
      const stage=cropStage.getBoundingClientRect();
      if(!stage.width||!stage.height)return null;
      const k=Math.min(stage.width/crop.image.naturalWidth,stage.height/crop.image.naturalHeight);
      const w=crop.image.naturalWidth*k,h=crop.image.naturalHeight*k;
      return {k,w,h,left:(stage.width-w)/2,top:(stage.height-h)/2};
    }
    function paintCrop(){
      if(!crop)return;
      const m=cropBounds();
      if(!m)return;
      Object.assign(cropSource.style,{
        width:m.w+"px",height:m.h+"px",left:m.left+"px",top:m.top+"px"
      });
      Object.assign(cropBox.style,{
        left:(m.left+crop.x*m.k)+"px",top:(m.top+crop.y*m.k)+"px",
        width:(crop.w*m.k)+"px",height:(crop.h*m.k)+"px"
      });
      const ctx=cropPreview.getContext("2d");
      if(ctx)ctx.drawImage(crop.image,crop.x,crop.y,crop.w,crop.h,
        0,0,cropPreview.width,cropPreview.height);
    }
    async function prepareCrop(file){
      if(!["image/jpeg","image/png","image/webp"].includes(file.type))
        throw new Error("Only JPG, PNG or WebP images are accepted.");
      if(file.size>MAX_SOURCE)throw new Error("Original image must be 8 MB or smaller.");
      const token=++loadToken;
      const url=URL.createObjectURL(file);
      const image=new Image();
      try{
        await new Promise((resolve,reject)=>{
          image.onload=resolve;image.onerror=()=>reject(new Error("Could not load that image."));
          image.src=url;
        });
        if(token!==loadToken){URL.revokeObjectURL(url);return;}
        if(!image.naturalWidth||!image.naturalHeight)
          throw new Error("Image dimensions are invalid.");
        const w=Math.min(image.naturalWidth,image.naturalHeight*W/H),h=w*H/W;
        crop={image,url,w,h,x:(image.naturalWidth-w)/2,y:(image.naturalHeight-h)/2};
        cropSource.src=url;
        cropEditor.hidden=false;setPreview("");
        cropZoom.value="1";zoomValue.textContent="1.0×";
        requestAnimationFrame(paintCrop);
      }catch(e){URL.revokeObjectURL(url);throw e;}
    }
    cropBox.addEventListener("pointerdown",event=>{
      if(!crop||event.button!==0)return;
      const b=cropBounds();if(!b)return;
      pointer={id:event.pointerId,x:event.clientX,y:event.clientY,
        cropX:crop.x,cropY:crop.y,k:b.k};
      cropBox.setPointerCapture?.(event.pointerId);event.preventDefault();
    });
    cropBox.addEventListener("pointermove",event=>{
      if(!crop||!pointer||pointer.id!==event.pointerId)return;
      crop.x=clamp(pointer.cropX+(event.clientX-pointer.x)/pointer.k,
        0,crop.image.naturalWidth-crop.w);
      crop.y=clamp(pointer.cropY+(event.clientY-pointer.y)/pointer.k,
        0,crop.image.naturalHeight-crop.h);
      paintCrop();
    });
    const finishPointer=()=>{pointer=null;};
    cropBox.addEventListener("pointerup",finishPointer);
    cropBox.addEventListener("pointercancel",finishPointer);
    cropBox.addEventListener("keydown",event=>{
      if(!crop)return;
      const shift=event.shiftKey?0.05:0.01;
      const d=shift*Math.min(crop.image.naturalWidth,crop.image.naturalHeight);
      if(event.key==="ArrowLeft")crop.x=clamp(crop.x-d,0,crop.image.naturalWidth-crop.w);
      else if(event.key==="ArrowRight")crop.x=clamp(crop.x+d,0,crop.image.naturalWidth-crop.w);
      else if(event.key==="ArrowUp")crop.y=clamp(crop.y-d,0,crop.image.naturalHeight-crop.h);
      else if(event.key==="ArrowDown")crop.y=clamp(crop.y+d,0,crop.image.naturalHeight-crop.h);
      else return;
      event.preventDefault();paintCrop();
    });
    cropZoom.addEventListener("input",()=>{
      if(!crop)return;
      const zoom=Number(cropZoom.value);
      const baseW=Math.min(crop.image.naturalWidth,crop.image.naturalHeight*W/H);
      const newW=baseW/zoom,newH=newW*H/W;
      const cx=crop.x+crop.w/2,cy=crop.y+crop.h/2;
      crop.w=newW;crop.h=newH;
      crop.x=clamp(cx-newW/2,0,crop.image.naturalWidth-newW);
      crop.y=clamp(cy-newH/2,0,crop.image.naturalHeight-newH);
      zoomValue.textContent=zoom.toFixed(1)+"×";paintCrop();
    });
    if("ResizeObserver" in window){
      const observer=new ResizeObserver(()=>paintCrop());observer.observe(cropStage);
      dlg.addEventListener("close",()=>{observer.disconnect();clearCrop();},{once:true});
    }else{
      window.addEventListener("resize",paintCrop);
      dlg.addEventListener("close",()=>{
        window.removeEventListener("resize",paintCrop);clearCrop();
      },{once:true});
    }
    function selectPost(item){
      resetEditor();editing=item;
      for(const key of ["kind","title","body","cta_label","sort_order",
        "art_key","transition_style","display_mode","display_seconds"]){
        find(key).value=item[key]??({display_seconds:4,transition_style:"fade",display_mode:"standard"}[key]??"");
      }
      if([...selectTarget.options].some(option=>option.value===item.target_path)){
        selectTarget.value=item.target_path;
      }else{
        selectTarget.value="custom";find("custom_path").value=item.target_path;
      }
      targetChanged();updateDuration();
      find("starts_at").value=localTime(item.starts_at);
      find("ends_at").value=localTime(item.ends_at);
      find("published").checked=Boolean(item.published);
      removeLabel.hidden=!item.image_path;
      setPreview(imageUrl(item.image_path));
      setStatus("Editing: "+item.title+". To recrop an older picture, upload its original again.");
      form.scrollIntoView({behavior:reduced.matches?"auto":"smooth",block:"start"});
    }
    fileField.addEventListener("change",async()=>{
      clearCrop();
      const file=fileField.files?.[0];
      if(!file){setPreview(imageUrl(editing?.image_path));return;}
      processing=true;submit.disabled=true;
      setStatus("Loading image crop editor...");
      try{
        await prepareCrop(file);
        removeField.checked=false;
        setStatus("Drag the highlighted rectangle to select the area, and adjust zoom if needed.");
      }catch(e){
        fileField.value="";clearCrop();setPreview(imageUrl(editing?.image_path));
        setStatus(e.message||"Could not read image.",true);
      }finally{processing=false;submit.disabled=false;}
    });
    removeField.addEventListener("change",()=>{
      if(removeField.checked){
        clearCrop();fileField.value="";setPreview("");
      }else setPreview(imageUrl(editing?.image_path));
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
        .select("id,kind,title,body,cta_label,target_path,art_key,image_path,sort_order,display_seconds,transition_style,display_mode,published,starts_at,ends_at,created_at")
        .order("sort_order",{ascending:true}).order("created_at",{ascending:true}).limit(150);
      list.replaceChildren(listTitle);
      if(error){emptyMessage(list,error.message);return;}
      if(!data?.length){emptyMessage(list,"No banners yet. Create the first post above.");return;}
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
        details.textContent="#"+item.sort_order+" · "+labelStatus(item)+" · "+item.title+
          " · "+(item.display_seconds||4)+"s · "+(item.transition_style||"fade");
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
      let destination=selectTarget.value==="custom"?field("custom_path"):selectTarget.value;
      if(selectTarget.value==="custom"&&destination&&!destination.startsWith("/")&&!/^[a-z][a-z0-9+.-]*:/i.test(destination)){
        destination="https://"+destination;
      }
      if(!safeDestination(destination)){
        setStatus("Enter a valid website link (http:// or https://) or a StudyLab path starting with /.",true);
        return;
      }
      const order=Number(field("sort_order"));
      const seconds=Number(field("display_seconds"));
      if(!Number.isInteger(order)||order<1||order>10000||
        !Number.isInteger(seconds)||seconds<1||seconds>10){
        setStatus("Order must be 1–10000 and display time must be 1–10 seconds.",true);return;
      }
      const mode=field("display_mode");
      if(mode==="image"&&!crop&&(!editing?.image_path||removeField.checked)){
        setStatus("Choose a banner picture before using Image-only mode.",true);return;
      }
      const start=field("starts_at"),end=field("ends_at");
      let startIso,endIso;
      try{
        startIso=start?new Date(start).toISOString():(editing?.starts_at||new Date().toISOString());
        endIso=end?new Date(end).toISOString():null;
      }catch(_){setStatus("Enter valid publish and expiry dates.",true);return;}
      if(endIso&&new Date(endIso)<=new Date(startIso)){
        setStatus("Expiry must be later than the start date.",true);return;
      }
      submit.disabled=true;
      let newImagePath="";
      try{
        const user=account.getUser();
        if(crop){
          setStatus("Cropping and compressing selected area...");
          const processed=await convertImage(crop);
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
          art_key:field("art_key"),image_path:nextImage,sort_order:order,
          display_seconds:seconds,transition_style:field("transition_style"),
          display_mode:mode,published:find("published").checked,
          starts_at:startIso,ends_at:endIso,updated_at:new Date().toISOString()
        };
        let query;
        if(editing)query=client.from("studylab_announcements").update(payload).eq("id",editing.id).select("id");
        else query=client.from("studylab_announcements").insert({...payload,created_by:user.id}).select("id");
        const {data:saved,error:saveError}=await query;
        if(saveError||!saved?.length)throw saveError||Error("Database did not save the banner.");
        if(oldImage&&oldImage!==nextImage){
          const {error:cleanupError}=await client.storage.from(BUCKET).remove([oldImage]);
          if(cleanupError)console.warn("Banner image cleanup:",cleanupError.message);
        }
        newImagePath="";resetEditor();
        await Promise.all([loadAnnouncements(),refreshList()]);
        setStatus("Banner saved. Published posts will appear on the Home carousel.");
      }catch(e){
        if(newImagePath){
          try{await client.storage.from(BUCKET).remove([newImagePath]);}catch(_){}
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
