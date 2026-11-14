/* StudyLab profile viewer: reads the currently signed-in account.
   The existing Edit Profile form owns all profile changes. No follower model
   is introduced here; counters are intentionally not fabricated. */
(() => {
  "use strict";
  if (window.StudyLabProfileView) return;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const escText = value => String(value ?? "").trim();

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function button(className, text, label) {
    const node = element("button", className, text);
    node.type = "button";
    if (label) node.setAttribute("aria-label", label);
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.85");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    const variants = {
      x:"M6 6 18 18 M18 6 6 18",
      calendar:"M8 2V6 M16 2V6 M3 10H21 M5 5H19Q21 5 21 7V19Q21 21 19 21H5Q3 21 3 19V7Q3 5 5 5Z",
      edit:"M4 20H8L19 9Q21 7 19 5L18 4Q16 2 14 4L3 15V20Z M12 6 17 11",
      trash:"M4 7H20 M9 7V4H15V7 M7 7L8 20H16L17 7 M10 11V17 M14 11V17",
      user:"M12 12A4 4 0 1 0 12 4A4 4 0 0 0 12 12ZM4 21V19Q4 14 12 14T20 19V21",
      lock:"M6 11V8A6 6 0 0 1 18 8V11 M5 11H19V21H5Z",
      arrow:"M8 5 15 12 8 19"
    };
    path.setAttribute("d", variants[name] || variants.user);
    svg.append(path);
    return svg;
  }
  function createButton(className, symbol, text) {
    const node = button(className);
    node.append(icon(symbol), element("span", "", text));
    return node;
  }

  let view = null;
  let dialog = null;
  let dismiss = null;
  let edit = null;
  let deleteStart = null;
  let usernameNode = null;
  let nameNode = null;
  let avatarNode = null;
  let joinedNode = null;
  let viewStatus = null;
  let confirmView = null;
  let confirmInput = null;
  let confirmSubmit = null;
  let confirmError = null;
  let confirmCancel = null;
  let lastFocus = null;
  let confirmed = false;
  let deleting = false;
  let editHandler = null;
  let accountUser = null;

  function tabbables(root) {
    return [...root.querySelectorAll("button:not([disabled]),input:not([disabled]),a[href]")].filter(n => !n.hidden && n.getAttribute("aria-hidden") !== "true");
  }
  function trap(event, root) {
    if (event.key !== "Tab") return;
    const items = tabbables(root);
    if (!items.length) {event.preventDefault();return;}
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  function closeView(returnFocus = true) {
    if (!view || view.hidden || deleting || (confirmView && !confirmView.hidden)) return;
    view.hidden = true;
    document.body.classList.remove("sl-profile-view-open");
    accountUser = null;
    const focus = lastFocus;
    lastFocus = null;
    if (returnFocus && focus?.isConnected && typeof focus.focus === "function")focus.focus();
  }
  function closeConfirm() {
    if (!confirmView || confirmView.hidden || deleting) return;
    confirmView.hidden = true;
    confirmed = false;
    confirmInput.value = "";
    confirmSubmit.disabled = true;
    confirmError.hidden = true;
    deleteStart?.focus();
  }

  function make() {
    if (view) return;
    view = element("div", "sl-pv-backdrop");
    view.id = "slProfileViewer";
    view.hidden = true;
    view.setAttribute("role", "presentation");
    dialog = element("section", "sl-pv-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "slPvHeading");
    dialog.setAttribute("aria-describedby", "slPvDescription");

    const header = element("div", "sl-pv-header");
    header.append(element("span","sl-pv-eyebrow","STUDYLAB · MY PROFILE"));
    dismiss = button("sl-pv-close", "", "Close View Profile");
    dismiss.append(icon("x"));
    header.append(dismiss);

    const identity = element("div", "sl-pv-identity");
    avatarNode = element("div", "sl-pv-avatar");
    avatarNode.setAttribute("aria-hidden", "true");
    avatarNode.append(icon("user"));
    const titleWrap = element("div", "sl-pv-titles");
    nameNode = element("h2","sl-pv-name","Student");
    nameNode.id = "slPvHeading";
    usernameNode = element("p","sl-pv-username","@student");
    titleWrap.append(nameNode,usernameNode);
    identity.append(avatarNode,titleWrap);

    const note = element("p","sl-pv-description",
      "Your StudyLab student profile.");
    note.id="slPvDescription";

    const counts = element("div","sl-pv-counts");
    for (const label of ["Followers","Following"]){
      const item = button("sl-pv-count");
      item.disabled = true;
      item.setAttribute("title",label+" · Coming soon");
      item.setAttribute("aria-label",label+" · Coming soon");
      item.append(element("strong","sl-pv-count-number","—"),element("span","sl-pv-count-label",label),
        element("small","sl-pv-count-soon","Coming soon"));
      counts.append(item);
    }
    const actions=element("div","sl-pv-actions");
    edit = createButton("sl-pv-edit","edit","Edit Profile");
    deleteStart = createButton("sl-pv-delete","trash","Delete Account");
    actions.append(edit,deleteStart);

    const joined=element("div","sl-pv-joined");
    joined.append(icon("calendar"));
    joinedNode = element("span","","Account created · —");
    joined.append(joinedNode);
    viewStatus=element("p","sl-pv-status","");
    viewStatus.setAttribute("role","status");
    viewStatus.hidden=true;

    dialog.append(header,identity,note,counts,actions,joined,viewStatus);
    view.append(dialog);
    document.body.append(view);

    // A distinct confirmation surface never deletes immediately on open.
    confirmView=element("div","sl-pv-backdrop sl-pv-confirm-backdrop");
    confirmView.id="slProfileDeleteConfirmation";
    confirmView.hidden=true;
    const confirmDialog=element("section","sl-pv-dialog sl-pv-confirm-dialog");
    confirmDialog.setAttribute("role","dialog");
    confirmDialog.setAttribute("aria-modal","true");
    confirmDialog.setAttribute("aria-labelledby","slPvDeleteTitle");
    const confirmBadge=element("span","sl-pv-danger-icon");
    confirmBadge.append(icon("trash"));
    const title=element("h2","","Delete your StudyLab account?");
    title.id="slPvDeleteTitle";
    const details=element("p","sl-pv-confirm-info",
      "This permanently removes your StudyLab account and its linked data, including profile, Study Room activity and Social content. This cannot be undone.");
    const inputLabel=element("label","sl-pv-confirm-label","Type DELETE to confirm");
    inputLabel.htmlFor="slPvDeleteInput";
    confirmInput=element("input","sl-pv-confirm-input");
    confirmInput.id="slPvDeleteInput";
    confirmInput.type="text";
    confirmInput.autocomplete="off";
    confirmInput.spellcheck=false;
    confirmInput.maxLength=8;
    confirmInput.placeholder="DELETE";
    confirmError=element("p","sl-pv-confirm-error","");
    confirmError.hidden=true;
    confirmError.setAttribute("role","alert");
    const confirmActions=element("div","sl-pv-confirm-actions");
    confirmCancel=createButton("sl-pv-cancel","x","Cancel");
    confirmSubmit=createButton("sl-pv-confirm-delete","trash","Delete account permanently");
    confirmSubmit.disabled=true;
    confirmActions.append(confirmCancel,confirmSubmit);
    confirmDialog.append(confirmBadge,title,details,inputLabel,confirmInput,confirmError,confirmActions);
    confirmView.append(confirmDialog);
    document.body.append(confirmView);

    dismiss.addEventListener("click",()=>closeView());
    view.addEventListener("pointerdown",event=>{
      if(event.target===view)closeView();
    });
    confirmView.addEventListener("pointerdown",event=>{
      if(event.target===confirmView)closeConfirm();
    });
    edit.addEventListener("click",()=>{
      const callback=editHandler;
      closeView(false);
      callback?.();
    });
    deleteStart.addEventListener("click",()=>{
      if(!accountUser || accountUser.is_anonymous) return;
      confirmView.hidden=false;
      confirmed=false;
      confirmInput.value="";
      confirmError.hidden=true;
      confirmSubmit.disabled=true;
      confirmInput.focus();
    });
    confirmCancel.addEventListener("click",closeConfirm);
    confirmInput.addEventListener("input",()=>{
      confirmed=confirmInput.value==="DELETE";
      confirmSubmit.disabled=!confirmed || deleting;
      confirmError.hidden=true;
    });
    confirmSubmit.addEventListener("click",deleteAccount);
    document.addEventListener("keydown",event=>{
      if(confirmView && !confirmView.hidden){
        if(event.key==="Escape") {event.preventDefault();closeConfirm();}
        else trap(event,confirmView);
        return;
      }
      if(view && !view.hidden){
        if(event.key==="Escape"){event.preventDefault();closeView();}
        else trap(event,view);
      }
    });
  }

  function paintAvatar(gender){
    avatarNode.replaceChildren();
    const svg=document.createElementNS(SVG_NS,"svg");
    svg.setAttribute("viewBox","0 0 24 24");
    svg.setAttribute("aria-hidden","true");
    const head=document.createElementNS(SVG_NS,"circle");
    head.setAttribute("cx","12");head.setAttribute("cy","7");head.setAttribute("r","3.2");
    const body=document.createElementNS(SVG_NS,"path");
    body.setAttribute("d", gender==="female"
      ?"M7 20 8 15.8A4.1 4.1 0 0 1 16 15.8L17 20Z"
      :"M4.5 20V18A7.5 7.5 0 0 1 19.5 18V20Z");
    svg.append(head,body);
    avatarNode.classList.toggle("sl-pv-avatar-female",gender==="female");
    avatarNode.append(svg);
  }
  function joinedDate(raw){
    if(!raw)return "Account created · Date unavailable";
    const date=new Date(raw);
    if(Number.isNaN(date.valueOf()))return "Account created · Date unavailable";
    return "Account created · "+new Intl.DateTimeFormat("en-GB",{
      year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Colombo"
    }).format(date);
  }
  async function open(options={}){
    make();
    const account=window.StudyLabAccount;
    if(!account?.getUser)return false;
    const user=account.getUser();
    if(!user || user.is_anonymous) return false;
    lastFocus=document.activeElement;
    editHandler=typeof options.openEdit==="function"?options.openEdit:null;
    accountUser=user;
    nameNode.textContent=escText(user.user_metadata?.full_name)||"Student";
    usernameNode.textContent="Loading profile…";
    joinedNode.textContent=joinedDate(user.created_at);
    paintAvatar("male");
    viewStatus.hidden=true;
    view.hidden=false;
    document.body.classList.add("sl-profile-view-open");
    requestAnimationFrame(()=>dismiss.focus());
    const openedFor=user.id;
    try{
      const profile=await account.getProfile(true);
      if(view.hidden || accountUser?.id!==openedFor)return true;
      nameNode.textContent=escText(profile?.display_name)||"Student";
      usernameNode.textContent=profile?.username?"@"+escText(profile.username):"Username not set";
      joinedNode.textContent=joinedDate(user.created_at||profile?.created_at);
      paintAvatar(profile?.gender==="female"?"female":"male");
      window.StudyLabNameMark?.decorate(nameNode,user.id);
    }catch(error){
      if(!view.hidden && accountUser?.id===openedFor){
        usernameNode.textContent="Profile temporarily unavailable";
        window.StudyLabNameMark?.decorate(nameNode,user.id);
        viewStatus.textContent="We couldn't refresh your profile details. Try again later.";
        viewStatus.hidden=false;
      }
    }
    return true;
  }

  async function deleteAccount(){
    if(deleting || !confirmed || confirmInput.value!=="DELETE" || !accountUser || accountUser.is_anonymous)return;
    const account=window.StudyLabAccount;
    if(!account?.client)return;
    deleting=true;
    confirmSubmit.disabled=true;
    confirmCancel.disabled=true;
    confirmInput.disabled=true;
    confirmSubmit.querySelector("span").textContent="Deleting…";
    confirmError.hidden=true;
    try{
      const {data,error}=await account.client.auth.getSession();
      if(error || !data?.session?.access_token || data.session.user?.id!==accountUser.id){
        throw new Error("Your session expired. Sign in again before deleting your account.");
      }
      const response=await fetch("/.netlify/functions/delete-account",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer "+data.session.access_token
        },
        body:JSON.stringify({confirmation:"DELETE"}),
        cache:"no-store"
      });
      let result={};
      try{result=await response.json();}catch(_){}
      if(!response.ok || result.deleted!==true){
        throw new Error(result.message||"Account deletion is unavailable. Your account has not been deleted.");
      }
      // Server has deleted only the authenticated account. Clear browser session
      // without depending on a now-deleted remote identity.
      try{await account.client.auth.signOut({scope:"local"});}catch(_){}
      window.location.replace("/");
    }catch(error){
      confirmError.textContent=error?.message||"Could not delete your account. Please try again.";
      confirmError.hidden=false;
      deleting=false;
      confirmCancel.disabled=false;
      confirmInput.disabled=false;
      confirmSubmit.querySelector("span").textContent="Delete account permanently";
      confirmSubmit.disabled=confirmInput.value!=="DELETE";
    }
  }
  Object.defineProperty(window,"StudyLabProfileView",{
    value:Object.freeze({open}),writable:false,configurable:false
  });
})();
