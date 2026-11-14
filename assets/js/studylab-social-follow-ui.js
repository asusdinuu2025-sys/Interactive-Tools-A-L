/* Search and recent follow alerts live beside the existing Social bell.
   No friendship invitations, messaging or unrelated Social changes. */
(() => {
  "use strict";
  if(window.__studyLabSocialFollowUi)return;
  const panel=document.getElementById("studyLabFeedPanel");
  const actions=panel?.querySelector(".sl-feed-head-actions");
  const bell=actions?.querySelector(".sl-feed-notifications-toggle");
  if(!panel||!actions||!bell||!window.StudyLabFollow)return;
  window.__studyLabSocialFollowUi=true;
  const follow=window.StudyLabFollow;
  const iconPaths={
    search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    add:'<circle cx="9.3" cy="8" r="3.5"/><path d="M2.8 20v-2.2c0-3.3 3-5.4 6.5-5.4 2.4 0 4.4.8 5.7 2.4M19 13v7m-3.5-3.5h7"/>'
  };
  function el(tag,cls,text){
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function btn(cls,label,svg){
    const node=el("button",cls);
    node.type="button";
    node.setAttribute("aria-label",label);
    node.title=label;
    node.setAttribute("aria-expanded","false");
    if(svg)node.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+svg+'</svg>';
    return node;
  }
  function openProfile(id){
    if(!id)return;
    closePanels();
    window.StudyLabProfileView?.open({userId:id});
  }
  const searchToggle=btn("sl-follow-head-toggle sl-follow-search-toggle","Search students",iconPaths.search);
  const alertsToggle=btn("sl-follow-head-toggle sl-follow-alerts-toggle","New followers",iconPaths.add);
  const unread=el("span","sl-follow-unread");
  unread.hidden=true;
  alertsToggle.append(unread);
  // Place Search directly beside the existing likes/comments bell.
  actions.insertBefore(alertsToggle,bell);
  actions.insertBefore(searchToggle,bell);

  const searchPanel=el("section","sl-follow-popover sl-follow-search-panel");
  const searchHead=el("div","sl-follow-popover-head");
  searchHead.append(el("strong","","Find students"));
  const searchInput=el("input","sl-follow-search-input");
  searchInput.type="search";
  searchInput.maxLength=55;
  searchInput.autocomplete="off";
  searchInput.placeholder="Search name or @username";
  searchInput.setAttribute("aria-label","Search StudyLab students");
  const searchList=el("div","sl-follow-result-list");
  searchList.setAttribute("aria-live","polite");
  searchList.append(el("p","sl-follow-empty","Enter at least 2 characters."));
  searchPanel.append(searchHead,searchInput,searchList);
  searchPanel.hidden=true;

  const alertsPanel=el("section","sl-follow-popover sl-follow-alerts-panel");
  alertsPanel.hidden=true;
  const alertsHead=el("div","sl-follow-popover-head");
  alertsHead.append(el("strong","","New followers"));
  const markAll=btn("sl-follow-mark-read","Mark all read");
  markAll.textContent="Mark all read";
  alertsHead.append(markAll);
  const alertsList=el("div","sl-follow-result-list");
  alertsList.setAttribute("aria-live","polite");
  alertsPanel.append(alertsHead,alertsList);
  actions.append(searchPanel,alertsPanel);

  let searchSerial=0;
  let searchTimer=null;
  let loadingAlerts=false;
  let unreadCount=0;
  let displayedAlerts=[];
  const alertAge=()=>new Date(Date.now()-14*24*60*60*1000).toISOString();
  function closePanels(except){
    for(const [toggle,box] of [[searchToggle,searchPanel],[alertsToggle,alertsPanel]]){
      if(box===except)continue;
      box.hidden=true;toggle.setAttribute("aria-expanded","false");
    }
    if(except){
      const bellPanel=actions.querySelector(".sl-feed-notification-popover");
      if(bellPanel)bellPanel.hidden=true;
      bell.setAttribute("aria-expanded","false");
    }
  }
  function row(profile){
    const b=btn("sl-follow-search-result","View profile for "+profile.display_name);
    const avatar=el("span","sl-follow-search-avatar",String(profile.display_name||"S").slice(0,1).toUpperCase());
    const copy=el("span","sl-follow-search-copy");
    const title=el("strong","",profile.display_name||"Student");
    window.StudyLabNameMark?.decorate(title,profile.user_id);
    copy.append(title,el("small","","@"+profile.username));
    b.append(avatar,copy,el("span","sl-follow-search-arrow","›"));
    b.addEventListener("click",()=>openProfile(profile.user_id));
    return b;
  }
  function renderSearch(profiles){
    searchList.replaceChildren();
    const own=follow.currentId();
    if(!profiles.length){
      searchList.append(el("p","sl-follow-empty","No matching student profiles."));
      return;
    }
    for(const p of profiles){
      const result=row(p);
      if(p.user_id===own)result.classList.add("is-self");
      searchList.append(result);
    }
  }
  async function runSearch(){
    const query=searchInput.value.trim();
    const serial=++searchSerial;
    if(query.replace(/^@/,"").length<2){
      searchList.replaceChildren(el("p","sl-follow-empty","Enter at least 2 characters."));
      return;
    }
    searchList.replaceChildren(el("p","sl-follow-empty","Searching…"));
    try{
      const results=await follow.search(query);
      if(serial!==searchSerial||searchPanel.hidden)return;
      renderSearch(results);
    }catch(error){
      if(serial!==searchSerial||searchPanel.hidden)return;
      searchList.replaceChildren(el("p","sl-follow-empty","Student search unavailable. Try again."));
    }
  }
  searchInput.addEventListener("input",()=>{
    if(searchTimer)clearTimeout(searchTimer);
    searchTimer=setTimeout(runSearch,240);
  });
  searchToggle.addEventListener("click",()=>{
    const showing=searchPanel.hidden;
    closePanels(showing?searchPanel:undefined);
    searchPanel.hidden=!showing;
    searchToggle.setAttribute("aria-expanded",String(showing));
    if(showing){searchInput.focus();if(searchInput.value.trim().length>=2)runSearch();}
  });
  function updateUnread(n){
    unreadCount=Math.max(0,n||0);
    unread.hidden=unreadCount===0;
    unread.textContent=unreadCount>99?"99+":String(unreadCount);
    alertsToggle.setAttribute("aria-label",unreadCount
      ?"New followers, "+unreadCount+" unread":"New followers");
    markAll.disabled=unreadCount===0;
  }
  function timeAgo(date){
    const sec=Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/1000));
    if(sec<60)return "Just now";
    if(sec<3600)return Math.floor(sec/60)+"m ago";
    if(sec<86400)return Math.floor(sec/3600)+"h ago";
    return Math.floor(sec/86400)+"d ago";
  }
  function renderAlerts(alerts,byId){
    alertsList.replaceChildren();
    if(!alerts.length){
      alertsList.append(el("p","sl-follow-empty","No recent followers."));
      return;
    }
    for(const item of alerts){
      const profile=byId.get(item.actor_id);
      if(!profile)continue;
      const b=row(profile);
      b.classList.add("sl-follow-alert-row");
      if(!item.is_read)b.classList.add("is-unread");
      const info=b.querySelector(".sl-follow-search-copy");
      info.append(el("small","sl-follow-alert-caption","Started following you · "+timeAgo(item.created_at)));
      b.addEventListener("click",async ()=>{
        try{
          const db=window.StudyLabAccount?.client;
          if(!item.is_read&&db){
            const {error}=await db.from("studylab_follow_alerts")
              .update({is_read:true})
              .eq("id",item.id).eq("recipient_id",follow.currentId());
            if(error)throw error;
            item.is_read=true;
            updateUnread(unreadCount-1);
          }
        }catch(e){console.warn("Could not mark follow alert read:",e);}
      });
      alertsList.append(b);
    }
    if(!alertsList.children.length)alertsList.append(el("p","sl-follow-empty","No recent followers."));
  }
  async function loadAlerts(){
    if(loadingAlerts)return;
    const own=follow.currentId();
    if(!own)return;
    loadingAlerts=true;
    try{
      const db=window.StudyLabAccount?.client;
      if(!db)return;
      const cutoff=alertAge();
      const [items,total]=await Promise.all([
        db.from("studylab_follow_alerts")
          .select("id,actor_id,recipient_id,is_read,created_at")
          .eq("recipient_id",own).gte("created_at",cutoff)
          .order("created_at",{ascending:false}).limit(30),
        db.from("studylab_follow_alerts")
          .select("id",{count:"exact",head:true})
          .eq("recipient_id",own).eq("is_read",false).gte("created_at",cutoff)
      ]);
      if(items.error)throw items.error;
      if(total.error)throw total.error;
      displayedAlerts=items.data||[];
      const ids=displayedAlerts.map(r=>r.actor_id);
      const people=await follow.lookup(ids);
      const byId=new Map(people.map(p=>[p.user_id,p]));
      updateUnread(total.count||0);
      renderAlerts(displayedAlerts,byId);
    }catch(err){
      console.warn("StudyLab follow alerts:",err);
      if(!alertsPanel.hidden)
        alertsList.replaceChildren(el("p","sl-follow-empty","Could not load follow notifications."));
    }finally{loadingAlerts=false;}
  }
  markAll.addEventListener("click",async()=>{
    if(!unreadCount)return;
    const db=window.StudyLabAccount?.client;
    try{
      const {error}=await db.from("studylab_follow_alerts").update({is_read:true})
        .eq("recipient_id",follow.currentId()).eq("is_read",false)
        .gte("created_at",alertAge());
      if(error)throw error;
      displayedAlerts=displayedAlerts.map(row=>({...row,is_read:true}));
      updateUnread(0);
      await loadAlerts();
    }catch(err){console.warn("Could not mark follow notifications read:",err);}
  });
  alertsToggle.addEventListener("click",()=>{
    const showing=alertsPanel.hidden;
    closePanels(showing?alertsPanel:undefined);
    alertsPanel.hidden=!showing;
    alertsToggle.setAttribute("aria-expanded",String(showing));
    if(showing){
      alertsList.replaceChildren(el("p","sl-follow-empty","Loading…"));
      loadAlerts();
    }
  });
  bell.addEventListener("click",()=>closePanels());
  document.addEventListener("pointerdown",event=>{
    if(!actions.contains(event.target))closePanels();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!searchPanel.hidden){closePanels();searchToggle.focus();}
    else if(event.key==="Escape"&&!alertsPanel.hidden){closePanels();alertsToggle.focus();}
  });
  window.addEventListener("studylab:social-visibility",event=>{
    if(event.detail?.open)loadAlerts();
    else closePanels();
  });
  // Poll only while the Social panel is visible. No extra realtime subscription
  // or background notification service needed for this lightweight feature.
  window.setInterval(()=>{
    if(!document.hidden&&panel.getAttribute("aria-hidden")==="false")loadAlerts();
  },35000);
})();
