/* StudyLab Home announcements and feature discovery.
   No ads, external links, user-tracking SDK, or notification permissions. */
(function () {
  "use strict";
  const card=document.getElementById("slDiscoveryCarousel");
  if(!card)return;
  const account=window.StudyLabAccount;
  const client=account?.client;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const slides=[
    {kind:"feature",tag:"NEW FEATURE",title:"Profile pictures are here!",
      body:"Personalize your profile and connect with other A/L students.",
      cta_label:"Update Your Profile",target_path:"/#home-overview",art:"profile",action:"profile"},
    {kind:"announcement",tag:"STUDYLAB COMMUNITY",title:"Follow & connect",
      body:"Share study ideas, join the conversation and learn together.",
      cta_label:"Explore Social",target_path:"/#social",art:"social"},
    {kind:"discover",tag:"DISCOVER STUDYLAB",title:"Explore practical simulations",
      body:"Bring Maths, Physics, Chemistry and Biology to life.",
      cta_label:"Explore Simulations",target_path:"/#practical-simulations",art:"science"}
  ];
  const els={
    badge:card.querySelector("[data-discovery-badge]"),
    title:card.querySelector("[data-discovery-title]"),
    body:card.querySelector("[data-discovery-body]"),
    action:card.querySelector("[data-discovery-action]"),
    art:card.querySelector("[data-discovery-art]"),
    main:card.querySelector("[data-discovery-main]"),
    dots:card.querySelector("[data-discovery-dots]")
  };
  const art={
    profile:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><rect x="75" y="17" width="112" height="116" rx="25" stroke="currentColor" stroke-width="3" opacity=".9"/><circle cx="131" cy="65" r="20" stroke="currentColor" stroke-width="4"/><path d="M95 112c5-31 66-31 72 0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="61" cy="91" r="28" fill="#aa73ff" fill-opacity=".23" stroke="#ab8fff" stroke-width="3"/><path d="M51 103c1-16 19-16 20 0m-10-19a8 8 0 1 0 0 16" stroke="#d2b4ff" stroke-width="3"/><path d="m176 111 8 7 14-17" stroke="#3ce5e6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    social:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><circle cx="90" cy="65" r="23" stroke="currentColor" stroke-width="4"/><circle cx="149" cy="58" r="19" stroke="#d6a3ff" stroke-width="4"/><path d="M44 122c3-34 87-34 91 0M127 106c15-16 47-12 53 9" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M187 18h-48a14 14 0 0 0-14 14v7a14 14 0 0 0 14 14h11l12 10V53h25a14 14 0 0 0 14-14v-7a14 14 0 0 0-14-14Z" stroke="#7ae7ff" stroke-width="3"/></svg>',
    science:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><path d="M84 20v48l-31 52c-5 10 1 15 11 15h101c10 0 17-7 12-16l-33-51V20M76 20h78" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M69 101c29 10 65-13 94 0l13 22c4 7-1 12-13 12H65c-10 0-13-5-9-12l13-22Z" fill="#6974ff" fill-opacity=".33"/><circle cx="113" cy="108" r="8" stroke="#90f6ff" stroke-width="3"/><circle cx="140" cy="119" r="5" fill="#9c85ff"/><circle cx="99" cy="85" r="4" fill="#90f6ff"/><path d="m176 26 7-7m-7 7 7 7m-7-7h-9m9 0h10" stroke="#7be3ff" stroke-width="3" stroke-linecap="round"/></svg>',
    announcement:'<svg viewBox="0 0 230 150" fill="none" aria-hidden="true"><path d="m66 60 95-33v89L66 84H44V60h22ZM65 85l12 39h26L91 95" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M178 55c18 7 18 31 0 38m10-51c26 13 25 52 0 64" stroke="#ad87ff" stroke-width="4" stroke-linecap="round"/><path d="m45 43 6-14m79 2 5-11" stroke="#71edff" stroke-width="3" stroke-linecap="round"/></svg>'
  };
  let current=0,items=slides.slice(),announcements=[],historyItems=[],receipts=new Map(),admin=false,interval=null;
  let interactionUntil=0,hovered=false,visible=true;
  let historyDialog=null,managerDialog=null,editingId=null;
  const safeText=x=>String(x||"").trim();
  function localKey(){
    const user=account?.getUser?.();
    return "sl-announcement-receipts:"+(!user||user.is_anonymous?"guest":user.id);
  }
  function localReceipts(){
    try{return JSON.parse(localStorage.getItem(localKey())||"{}")||{};}catch(_){return {};}
  }
  function loadLocalReceipts(){
    for(const [id,v] of Object.entries(localReceipts()))if(!receipts.has(id))receipts.set(id,v);
  }
  function safeDestination(path){
    try{
      const value=safeText(path);
      if(!value.startsWith("/")||value.startsWith("//")||value.includes("\\")||/[\u0000-\u001f]/.test(value))return null;
      const result=new URL(value,window.location.origin);
      if(result.origin!==window.location.origin)return null;
      return result;
    }catch(_){return null;}
  }
  function navigate(path){
    const url=safeDestination(path);
    if(!url)return;
    if(url.pathname===window.location.pathname && !url.search && url.hash){
      const target=document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if(target){
        window.history.replaceState(null,"",url.hash);
        target.scrollIntoView({behavior:reduced.matches?"auto":"smooth",block:"start"});
        return;
      }
    }
    window.location.assign(url.href);
  }
  function openProfile(){
    const viewer=window.StudyLabProfileView;
    if(viewer?.open)viewer.open();
    else document.getElementById("profileButton")?.click();
  }
  function explore(item){
    interactionUntil=Date.now()+11000;
    if(item?.action==="profile")return openProfile();
    if(item?.target_path)navigate(item.target_path);
  }
  function render(){
    const item=items[current]||slides[0];
    els.badge.textContent=item.tag||(item.kind==="feature"?"NEW FEATURE":"STUDYLAB UPDATE");
    els.title.textContent=item.title;
    els.body.textContent=item.body;
    els.action.textContent=item.cta_label||"Explore";
    els.art.innerHTML=art[item.art]||art.announcement;
    card.dataset.discoveryKind=item.kind||"announcement";
    els.main.setAttribute("aria-label",item.title+". "+(item.cta_label||"Explore"));
    els.dots.replaceChildren();
    for(let i=0;i<items.length;i++){
      const dot=document.createElement("button");
      dot.type="button";dot.className="sl-discovery-dot";
      dot.setAttribute("aria-label","Show slide "+(i+1)+": "+items[i].title);
      dot.setAttribute("aria-current",String(i===current));
      dot.addEventListener("click",()=>{current=i;interactionUntil=Date.now()+12000;render();});
      els.dots.append(dot);
    }
    // Only active slide is exposed to screen readers. No duplicate hidden slides.
  }
  function step(delta){
    current=(current+delta+items.length)%items.length;
    interactionUntil=Date.now()+10000;render();
  }
  card.querySelector("[data-discovery-prev]").addEventListener("click",()=>step(-1));
  card.querySelector("[data-discovery-next]").addEventListener("click",()=>step(1));
  els.main.addEventListener("click",()=>explore(items[current]));
  card.addEventListener("mouseenter",()=>{hovered=true;});
  card.addEventListener("mouseleave",()=>{hovered=false;});
  card.addEventListener("focusin",()=>{hovered=true;});
  card.addEventListener("focusout",event=>{if(!card.contains(event.relatedTarget))hovered=false;});
  card.addEventListener("touchstart",()=>{interactionUntil=Date.now()+12000;},{passive:true});
  if("IntersectionObserver" in window){
    new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;},{threshold:.25}).observe(card);
  }
  function autoStart(){
    if(interval)window.clearInterval(interval);
    interval=window.setInterval(()=>{
      if(reduced.matches||document.hidden||hovered||!visible||Date.now()<interactionUntil)return;
      current=(current+1)%items.length;render();
    },4000);
  }
  reduced.addEventListener?.("change",()=>{interactionUntil=Date.now()+2000;});
  render();autoStart();

  function canManage(){return admin;}
  async function loadAnnouncements(){
    if(!client)return;
    const {data,error}=await client.from("studylab_announcements")
      .select("id,kind,title,body,cta_label,target_path,published,starts_at,ends_at,created_at")
      .order("created_at",{ascending:false}).limit(50);
    if(error){console.warn("StudyLab announcements:",error.message);return;}
    const now=Date.now();
    // History retains published past updates; the carousel only promotes active ones.
    historyItems=(data||[]).filter(a=>a.published&&new Date(a.starts_at).getTime()<=now);
    announcements=historyItems.filter(a=>!a.ends_at||new Date(a.ends_at).getTime()>now);
    const announcement=announcements[0];
    items=slides.slice();
    if(announcement&&safeDestination(announcement.target_path)){
      items[1]={kind:announcement.kind,tag:announcement.kind==="feature"?"NEW FEATURE":
        announcement.kind==="discover"?"DISCOVER":"STUDYLAB ANNOUNCEMENT",
        title:announcement.title,body:announcement.body,cta_label:announcement.cta_label,
        target_path:announcement.target_path,art:announcement.kind==="feature"?"profile":"announcement",
        announcement_id:announcement.id};
    }
    current=Math.min(current,items.length-1);render();
  }
  function status(id){return receipts.get(id)||{};}
  async function markSeen(id,field){
    if(!id)return;
    const now=new Date().toISOString();
    const old=status(id);
    const next={...old,viewed_at:old.viewed_at||now,[field]:now};
    receipts.set(id,next);
    try{
      const local=localReceipts();local[id]=next;
      localStorage.setItem(localKey(),JSON.stringify(local));
    }catch(_){}
    const user=account?.getUser?.();
    if(!user||user.is_anonymous||!client)return;
    const payload={announcement_id:id,user_id:user.id,viewed_at:next.viewed_at,
      dismissed_at:next.dismissed_at||null,opened_at:next.opened_at||null};
    const {error}=await client.from("studylab_announcement_reads")
      .upsert(payload,{onConflict:"announcement_id,user_id"});
    if(error)console.warn("StudyLab announcement read status:",error.message);
  }
  async function loadReceipts(){
    loadLocalReceipts();
    const user=account?.getUser?.();
    if(!client||!user||user.is_anonymous)return;
    const {data,error}=await client.from("studylab_announcement_reads")
      .select("announcement_id,viewed_at,dismissed_at,opened_at").eq("user_id",user.id);
    if(error)return;
    for(const item of data||[]){
      receipts.set(item.announcement_id,{viewed_at:item.viewed_at,
        dismissed_at:item.dismissed_at,opened_at:item.opened_at});
    }
  }
  function dialogShell(name,title){
    const dlg=document.createElement("dialog");
    dlg.className="sl-ann-dialog";
    dlg.id=name;
    dlg.setAttribute("aria-label",title);
    const head=document.createElement("div");head.className="sl-ann-dialog-head";
    const heading=document.createElement("h2");heading.textContent=title;
    const close=document.createElement("button");close.type="button";
    close.className="sl-ann-close";close.textContent="×";close.setAttribute("aria-label","Close dialog");
    close.addEventListener("click",()=>dlg.close());
    head.append(heading,close);
    const content=document.createElement("div");content.className="sl-ann-dialog-body";
    dlg.append(head,content);document.body.append(dlg);
    dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});
    return {dlg,content};
  }
  function emptyMessage(target,text){
    const p=document.createElement("p");p.className="sl-ann-empty";p.textContent=text;
    target.append(p);
  }
  function tag(kind){return kind==="feature"?"New feature":kind==="discover"?"Discover":"Announcement";}
  function historyCard(item,compact){
    const box=document.createElement("article");box.className="sl-ann-history-card";
    const label=document.createElement("span");label.className="sl-ann-history-tag";label.textContent=tag(item.kind);
    const title=document.createElement("h3");title.textContent=item.title;
    const body=document.createElement("p");body.textContent=item.body;
    const footer=document.createElement("div");footer.className="sl-ann-history-footer";
    const time=document.createElement("time");time.dateTime=item.created_at||"";
    time.textContent=new Date(item.created_at||Date.now()).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
    const button=document.createElement("button");button.type="button";button.className="sl-ann-card-action";
    button.textContent=item.cta_label||"Explore";
    button.addEventListener("click",async()=>{
      await markSeen(item.id,"opened_at");historyDialog?.dlg.close();explore(item);
    });
    footer.append(time,button);
    box.append(label,title,body,footer);
    if(compact)box.classList.add("sl-ann-history-card--compact");
    return box;
  }
  async function openHistory(){
    if(!historyDialog)historyDialog=dialogShell("slAnnouncementHistory","StudyLab Announcements");
    const {dlg,content}=historyDialog;
    content.replaceChildren();
    const intro=document.createElement("p");intro.className="sl-ann-dialog-intro";
    intro.textContent="Discover StudyLab updates and revisit features at any time.";
    content.append(intro);
    await loadAnnouncements();await loadReceipts();
    if(historyItems.length){
      for(const item of historyItems)content.append(historyCard(item,false));
      for(const item of historyItems)markSeen(item.id,"viewed_at");
    }else emptyMessage(content,"No official announcements have been published yet. Keep exploring StudyLab!");
    const footer=document.createElement("div");footer.className="sl-ann-dialog-actions";
    const tour=document.createElement("button");tour.type="button";tour.className="sl-ann-secondary";
    tour.textContent="Explore StudyLab";tour.addEventListener("click",()=>{dlg.close();navigate("/#practical-simulations");});
    footer.append(tour);
    if(admin){
      const manage=document.createElement("button");manage.type="button";
      manage.textContent="Manage announcements";manage.className="sl-ann-primary";
      manage.addEventListener("click",()=>{dlg.close();openManager();});
      footer.append(manage);
    }
    content.append(footer);
    dlg.showModal();
  }

  function isValidDestination(raw){return !!safeDestination(raw);}
  async function verifyAdmin(){
    if(!client)return false;
    const user=account?.getUser?.();
    if(!user||user.is_anonymous){admin=false;return false;}
    const result=await client.rpc("studylab_social_is_admin");
    admin=!result.error&&result.data===true;
    return admin;
  }
  async function openManager(){
    if(!await verifyAdmin())return;
    if(!managerDialog)managerDialog=dialogShell("slAnnouncementManager","Manage Announcements");
    const {dlg,content}=managerDialog;
    content.replaceChildren();
    const form=document.createElement("form");
    form.className="sl-ann-editor";
    form.innerHTML='<label>Type<select name="kind"><option value="feature">New feature</option><option value="announcement">Announcement</option><option value="discover">Discover StudyLab</option></select></label>'+
      '<label>Title<input name="title" maxlength="90" minlength="3" required placeholder="New StudyLab feature"></label>'+
      '<label>Message<textarea name="body" maxlength="300" minlength="5" rows="3" required placeholder="Briefly explain why students should explore it."></textarea></label>'+
      '<div class="sl-ann-form-pair"><label>Button text<input name="cta_label" maxlength="36" value="Explore" required></label>'+
      '<label>Destination<select name="target_path"><option value="/#social">Social</option><option value="/#practical-simulations">Practical simulations</option><option value="/#live-study-room">Live Study Room section</option><option value="/study-room.html?completeProfile=1">Enter Study Room</option><option value="/#past-papers">Past Papers</option><option value="/#telegram-links">Telegram channels</option><option value="/#other-al-resources">Other A/L resources</option><option value="/#home-overview">Home</option></select></label></div>'+
      '<div class="sl-ann-form-pair"><label>Starts at<input name="starts_at" type="datetime-local"></label>'+
      '<label>Expires at (optional)<input name="ends_at" type="datetime-local"></label></div>'+
      '<label class="sl-ann-toggle"><input name="published" type="checkbox" checked> Publish announcement</label>'+
      '<p class="sl-ann-form-status" role="status" aria-live="polite"></p>'+
      '<div class="sl-ann-dialog-actions"><button class="sl-ann-secondary" type="reset">New announcement</button><button class="sl-ann-primary" type="submit">Publish / Save</button></div>';
    const existing=document.createElement("section");existing.className="sl-ann-admin-list";
    const existingTitle=document.createElement("h3");existingTitle.textContent="Published and scheduled";
    existing.append(existingTitle);
    content.append(form,existing);
    const elements=form.elements,statusEl=form.querySelector(".sl-ann-form-status");
    const setStatus=(msg,bad=false)=>{statusEl.textContent=msg;statusEl.dataset.error=String(bad);};
    function fill(item){
      editingId=item.id;
      elements.namedItem("kind").value=item.kind;
      elements.namedItem("title").value=item.title;
      elements.namedItem("body").value=item.body;
      elements.namedItem("cta_label").value=item.cta_label;
      elements.namedItem("target_path").value=item.target_path;
      // Using UTC local conversion only for input presentation.
      function localDatetime(v){
        const d=v?new Date(v):null;
        if(!d||!Number.isFinite(d.getTime()))return "";
        return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
      }
      elements.namedItem("starts_at").value=localDatetime(item.starts_at);
      elements.namedItem("ends_at").value=localDatetime(item.ends_at);
      elements.namedItem("published").checked=Boolean(item.published);
      setStatus("Editing: "+item.title);
      form.scrollIntoView({behavior:"smooth",block:"start"});
    }
    async function refresh(){
      const {data,error}=await client.from("studylab_announcements")
        .select("id,kind,title,body,cta_label,target_path,published,created_at,starts_at,ends_at")
        .order("created_at",{ascending:false}).limit(60);
      existing.replaceChildren(existingTitle);
      if(error){emptyMessage(existing,"Could not load announcements.");return;}
      if(!(data||[]).length){emptyMessage(existing,"No announcements published yet.");return;}
      for(const item of data){
        const row=document.createElement("div");row.className="sl-ann-admin-row";
        const copy=document.createElement("span");copy.textContent=(item.published?"● ":"○ ")+item.title;
        const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";
        edit.addEventListener("click",()=>fill(item));
        const del=document.createElement("button");del.type="button";del.textContent="Delete";
        del.addEventListener("click",async()=>{
          if(!window.confirm("Permanently delete the announcement '"+item.title+"'?"))return;
          const {error:e}=await client.from("studylab_announcements").delete().eq("id",item.id);
          if(e)setStatus(e.message,true);
          else{await refresh();await loadAnnouncements();}
        });
        row.append(copy,edit,del);existing.append(row);
      }
    }
    form.addEventListener("reset",()=>{
      window.setTimeout(()=>{editingId=null;setStatus("");},0);
    });
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      const user=account.getUser();
      if(!user||!await verifyAdmin()){setStatus("Admin permission required.",true);return;}
      const field=k=>safeText(elements.namedItem(k)?.value);
      const target_path=field("target_path");
      if(!isValidDestination(target_path)){setStatus("Choose a valid StudyLab destination.",true);return;}
      const start=field("starts_at"),end=field("ends_at");
      const payload={
        kind:field("kind"),title:field("title"),body:field("body"),
        cta_label:field("cta_label"),target_path,
        published:elements.namedItem("published").checked,
        starts_at:start?new Date(start).toISOString():new Date().toISOString(),
        ends_at:end?new Date(end).toISOString():null,
        updated_at:new Date().toISOString()
      };
      if(payload.ends_at&&new Date(payload.ends_at)<=new Date(payload.starts_at)){
        setStatus("Expiry must be after the start time.",true);return;
      }
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      try{
        let query;
        if(editingId)query=client.from("studylab_announcements").update(payload).eq("id",editingId);
        else query=client.from("studylab_announcements").insert({...payload,created_by:user.id});
        const {error:e}=await query;
        if(e)throw e;
        editingId=null;form.reset();setStatus("Announcement saved successfully.");
        await refresh();await loadAnnouncements();
      }catch(e){setStatus(e.message||"Could not save announcement.",true);}
      finally{submit.disabled=false;}
    });
    await refresh();dlg.showModal();
  }
  // Menu and user navigation use this small API; RLS remains the authority.
  window.StudyLabAnnouncements=Object.freeze({
    openHistory,openManager,canManage,
    unreadCount:()=>historyItems.filter(a=>!status(a.id).viewed_at).length
  });
  loadAnnouncements();
  Promise.resolve(account?.ready).then(async()=>{
    loadLocalReceipts();
    await Promise.all([verifyAdmin(),loadReceipts()]);
    document.dispatchEvent(new Event("studylab:announcements-ready"));
  }).catch(()=>{});
})();
