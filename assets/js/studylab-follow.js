/* StudyLab follows: one lightweight relationship service shared by Social,
   profile cards and Study Room. Never reads private profile fields. */
(function () {
  "use strict";
  if (window.StudyLabFollow) return;
  const followingCache = new Map();
  const pendingReads = new Map();
  const busyIds = new Set();
  const buttons = new Set();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let toastTimer = null;
  let toastHideTimer = null;
  function showCompleteProfileToast() {
    let toast=document.getElementById("slFollowProfileToast");
    if(!toast){
      toast=document.createElement("div");
      toast.id="slFollowProfileToast";
      toast.className="sl-follow-profile-toast";
      toast.setAttribute("role","status");
      toast.setAttribute("aria-live","polite");
      document.body.appendChild(toast);
    }
    toast.textContent="First Complete Your Profile to follow others";
    toast.hidden=false;
    toast.classList.remove("is-hiding");
    if(toastTimer)clearTimeout(toastTimer);
    if(toastHideTimer)clearTimeout(toastHideTimer);
    toastTimer=setTimeout(()=>toast.classList.add("is-hiding"),3800);
    toastHideTimer=setTimeout(()=>{toast.hidden=true;},4250);
  }
  function hasBasicProfile(p){
    return Boolean(p?.display_name && !/^Student\d{4}$/.test(String(p.display_name)) &&
      p?.username && p?.exam_year && p?.study_stream);
  }

  function account() {
    const value = window.StudyLabAccount;
    if (!value?.client || !value?.getUser) throw new Error("StudyLab sign-in is unavailable.");
    return value;
  }
  function currentId() { return account().getUser()?.id || ""; }
  function valid(id) { return typeof id === "string" && UUID.test(id); }
  async function client() {
    const value=account();
    if(value.ready)await value.ready;
    if(!value.getUser()?.id)throw new Error("Sign in to your StudyLab account first.");
    return value.client;
  }
  function updateButtons(id) {
    for (const button of [...buttons]) {
      if(!button.isConnected){buttons.delete(button);continue;}
      if(button.dataset.followTarget !== id)continue;
      const following=followingCache.get(id)===true;
      const working=busyIds.has(id);
      button.textContent=working?"Updating…":following?"Following":"Follow";
      button.classList.toggle("is-following",following);
      button.setAttribute("aria-pressed",String(following));
      button.disabled=working;
      button.setAttribute("aria-label",working?"Updating following":following?"Unfollow student":"Follow student");
    }
  }
  async function prefetch(ids) {
    const uid=currentId();
    const unique=[...new Set((ids||[]).filter(id=>valid(id)&&id!==uid))].filter(id=>!followingCache.has(id));
    if(!unique.length)return;
    const db=await client();
    // Batch to avoid a network request per feed card.
    for(let i=0;i<unique.length;i+=40){
      const block=unique.slice(i,i+40);
      const {data,error}=await db.from("studylab_follows")
        .select("following_id").eq("follower_id",uid).in("following_id",block);
      if(error)throw error;
      const found=new Set((data||[]).map(row=>row.following_id));
      for(const id of block){followingCache.set(id,found.has(id));updateButtons(id);}
    }
  }
  async function isFollowing(id) {
    if(!valid(id)||id===currentId())return false;
    if(followingCache.has(id))return followingCache.get(id);
    if(pendingReads.has(id))return pendingReads.get(id);
    const request=prefetch([id]).then(()=>followingCache.get(id)===true);
    pendingReads.set(id,request);
    try{return await request;}finally{pendingReads.delete(id);}
  }
  async function setFollowing(id,shouldFollow) {
    const uid=currentId();
    if(!valid(id)||!uid||id===uid)throw new Error("Choose another student.");
    if(busyIds.has(id))return followingCache.get(id)===true;
    busyIds.add(id);updateButtons(id);
    try {
      const db=await client();
      if(shouldFollow){
        // Check BEFORE inserting: an incomplete student can still view profiles,
        // but must complete their own basic profile before following anyone.
        const own=account().getUser();
        const myProfile=await account().getProfile(true);
        if(own?.is_anonymous || !hasBasicProfile(myProfile)){
          showCompleteProfileToast();
          return followingCache.get(id)===true;
        }
        const {error}=await db.from("studylab_follows").insert({follower_id:uid,following_id:id});
        if(error&&error.code!=="23505")throw error;
      }else{
        const {error}=await db.from("studylab_follows").delete().eq("follower_id",uid).eq("following_id",id);
        if(error)throw error;
      }
      followingCache.set(id,shouldFollow);
      window.dispatchEvent(new CustomEvent("studylab:follow-changed",{
        detail:{targetId:id,following:shouldFollow}
      }));
      return shouldFollow;
    }finally{busyIds.delete(id);updateButtons(id);}
  }
  async function toggle(id){
    const state=await isFollowing(id);
    return setFollowing(id,!state);
  }
  function makeButton(id,options={}) {
    if(!valid(id)||id===currentId())return null;
    const button=document.createElement("button");
    button.type="button";
    button.className="sl-follow-btn"+(options.compact?" is-compact":"");
    button.dataset.followTarget=id;
    button.textContent="Follow";
    button.setAttribute("aria-pressed","false");
    button.setAttribute("aria-label","Follow student");
    buttons.add(button);
    updateButtons(id);
    if(!followingCache.has(id)){
      isFollowing(id).catch(err=>{
        console.warn("StudyLab following state:",err);
        button.title="Following status unavailable";
      });
    }
    button.addEventListener("click",async event=>{
      event.stopPropagation();
      if(button.disabled)return;
      button.disabled=true;
      try{await toggle(id);}
      catch(err){
        button.title=err?.message||"Could not change following status.";
        window.dispatchEvent(new CustomEvent("studylab:follow-error",{
          detail:{message:button.title}
        }));
      }
      finally{updateButtons(id);}
    });
    return button;
  }
  async function lookup(ids) {
    const selected=[...new Set((ids||[]).filter(valid))].slice(0,40);
    if(!selected.length)return [];
    const db=await client();
    const {data,error}=await db.rpc("studylab_public_student_lookup",{
      p_user_ids:selected,p_query:null,p_limit:40
    });
    if(error)throw error;
    return data||[];
  }
  async function search(query) {
    const text=String(query||"").trim().replace(/^@/,"");
    if(text.length<2)return [];
    const db=await client();
    const {data,error}=await db.rpc("studylab_public_student_lookup",{
      p_query:text.slice(0,55),p_user_ids:null,p_limit:20
    });
    if(error)throw error;
    return data||[];
  }
  async function getProfile(id) {
    if(!valid(id))return null;
    const found=await lookup([id]);
    return found.find(item=>item.user_id===id)||null;
  }
  async function stats(id){
    if(!valid(id))return {followers:0,following:0,isFollowing:false};
    const db=await client();
    const [fans,following]=await Promise.all([
      db.from("studylab_follows").select("follower_id",{count:"exact",head:true}).eq("following_id",id),
      db.from("studylab_follows").select("following_id",{count:"exact",head:true}).eq("follower_id",id)
    ]);
    if(fans.error)throw fans.error;
    if(following.error)throw following.error;
    const followingMe=id===currentId()?false:await isFollowing(id);
    return {followers:fans.count||0,following:following.count||0,isFollowing:followingMe};
  }
  async function list(type,id){
    if(!valid(id)||!["followers","following"].includes(type))return [];
    const db=await client();
    const inbound=type==="followers";
    const {data,error}=await db.from("studylab_follows")
      .select(inbound?"follower_id":"following_id")
      .eq(inbound?"following_id":"follower_id",id)
      .order("created_at",{ascending:false}).limit(40);
    if(error)throw error;
    const ids=(data||[]).map(item=>item[inbound?"follower_id":"following_id"]);
    const profiles=await lookup(ids);
    const byId=new Map(profiles.map(p=>[p.user_id,p]));
    return ids.map(i=>byId.get(i)).filter(Boolean);
  }
  window.StudyLabFollow=Object.freeze({
    currentId,prefetch,isFollowing,setFollowing,toggle,makeButton,lookup,search,
    getProfile,stats,list
  });
})();
