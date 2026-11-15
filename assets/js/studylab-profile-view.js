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
      arrow:"M8 5 15 12 8 19",
      camera:"M3 7H7L9 4H15L17 7H21V20H3Z M12 17A4 4 0 1 0 12 9A4 4 0 0 0 12 17"
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
  let avatarEditor = null;
  let avatarToggle = null;
  let bioSummary = null;
  let bioEditToggle = null;
  let avatarPick = null;
  let avatarRemove = null;
  let avatarFile = null;
  let avatarStatus = null;
  let avatarBusy = false;
  let avatarHasPhoto = false;
  let avatarCropOverlay = null;
  let avatarCropStage = null;
  let avatarCropSquare = null;
  let avatarCropZoom = null;
  let avatarCropPreview = null;
  let avatarCropMessage = null;
  let avatarCropSave = null;
  let avatarCropCancel = null;
  let avatarCropImageElement = null;
  let avatarCropFile = null;
  let avatarCropObjectUrl = "";
  let avatarCropState = null;
  let avatarCropDrag = null;
  let avatarCropGeneration = 0;
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
  let bioNode = null;
  let bioEditor = null;
  let bioInput = null;
  let bioCount = null;
  let bioSave = null;
  let bioStatus = null;
  let bioSaving = false;
  let viewedUserId = null;
  let viewSequence = 0;
  let followAction = null;
  let countButtons = [];
  let listPanel = null;
  let listBackdrop = null;
  let listDismiss = null;

  function tabbables(root) {
    return [...root.querySelectorAll("button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href],[tabindex=\"0\"]")].filter(n => !n.hidden && n.getAttribute("aria-hidden") !== "true");
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
    if (avatarCropOverlay && !avatarCropOverlay.hidden) {closeAvatarCrop();return;}
    view.hidden = true;
    document.body.classList.remove("sl-profile-view-open");
    accountUser = null;
    viewedUserId = null;
    listPanel.hidden = true;
    if (listBackdrop) listBackdrop.hidden = true;
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


  // An opt-in manual square selection: no profile data or Storage write
  // happens until the student presses Save Photo.
  const clampCrop = (number,min,max) => Math.min(max,Math.max(min,number));
  function cropGeometry() {
    if (!avatarCropState || !avatarCropStage) return null;
    const {width,height} = avatarCropState;
    const scale = Math.min(avatarCropStage.clientWidth/width,avatarCropStage.clientHeight/height);
    if (!Number.isFinite(scale) || scale<=0) return null;
    const displayWidth=width*scale, displayHeight=height*scale;
    return {scale,displayWidth,displayHeight,
      offsetX:(avatarCropStage.clientWidth-displayWidth)/2,
      offsetY:(avatarCropStage.clientHeight-displayHeight)/2};
  }
  function redrawAvatarCrop() {
    const state=avatarCropState, geometry=cropGeometry();
    if (!state || !geometry) return;
    avatarCropSquare.style.left=(geometry.offsetX+state.x*geometry.scale)+"px";
    avatarCropSquare.style.top=(geometry.offsetY+state.y*geometry.scale)+"px";
    avatarCropSquare.style.width=(state.size*geometry.scale)+"px";
    avatarCropSquare.style.height=(state.size*geometry.scale)+"px";
    const preview=avatarCropPreview.getContext("2d",{alpha:false});
    if(preview) {
      preview.clearRect(0,0,avatarCropPreview.width,avatarCropPreview.height);
      preview.drawImage(state.image,state.x,state.y,state.size,state.size,
        0,0,avatarCropPreview.width,avatarCropPreview.height);
    }
  }
  function closeAvatarCrop(force=false) {
    if (!avatarCropOverlay || avatarCropOverlay.hidden || (avatarBusy && !force)) return;
    avatarCropGeneration++;
    avatarCropOverlay.hidden=true;
    avatarCropDrag=null;
    avatarCropState=null;
    avatarCropFile=null;
    if(avatarCropObjectUrl) URL.revokeObjectURL(avatarCropObjectUrl);
    avatarCropObjectUrl="";
    avatarCropImageElement.removeAttribute("src");
    if(view && !view.hidden && avatarPick?.isConnected) avatarPick.focus();
  }
  async function openAvatarCrop(file) {
    if (!file || avatarBusy || viewedUserId!==accountUser?.id) return;
    if (!(file instanceof File) || !["image/jpeg","image/png","image/webp"].includes(file.type)) {
      avatarStatus.hidden=false;
      avatarStatus.dataset.state="error";
      avatarStatus.textContent="Choose a JPG, PNG or WebP image.";
      return;
    }
    if(file.size<1 || file.size>1024*1024) {
      avatarStatus.hidden=false;
      avatarStatus.dataset.state="error";
      avatarStatus.textContent="The original profile picture must be 1 MB or smaller.";
      return;
    }
    const generation=++avatarCropGeneration;
    avatarStatus.hidden=false;
    avatarStatus.dataset.state="";
    avatarStatus.textContent="Opening photo editor…";
    const objectUrl=URL.createObjectURL(file);
    const image=new Image();
    try {
      await new Promise((resolve,reject)=>{
        image.onload=()=>resolve();
        image.onerror=()=>reject(new Error("Could not read this image."));
        image.src=objectUrl;
        if(image.complete && image.naturalWidth>0)resolve();
      });
      if(generation!==avatarCropGeneration) {URL.revokeObjectURL(objectUrl);return;}
      const width=image.naturalWidth,height=image.naturalHeight;
      if(!width || !height || width>8192 || height>8192 || width*height>20000000) {
        throw new Error("Image dimensions are too large.");
      }
      const size=Math.min(width,height);
      avatarCropFile=file;
      avatarCropObjectUrl=objectUrl;
      avatarCropState={image,width,height,size,x:(width-size)/2,y:(height-size)/2};
      avatarCropDrag=null;
      avatarCropZoom.value="1";
      avatarCropMessage.hidden=true;
      avatarCropMessage.textContent="";
      avatarCropSave.disabled=false;
      avatarCropCancel.disabled=false;
      avatarCropZoom.disabled=false;
      avatarCropImageElement.src=objectUrl;
      avatarCropOverlay.hidden=false;
      avatarStatus.hidden=true;
      requestAnimationFrame(redrawAvatarCrop);
      avatarCropCancel.focus();
    } catch(error) {
      URL.revokeObjectURL(objectUrl);
      if(generation!==avatarCropGeneration)return;
      avatarStatus.hidden=false;
      avatarStatus.dataset.state="error";
      avatarStatus.textContent=error?.message || "Could not open the photo editor.";
    }
  }
  function makeAvatarCrop(syncAvatarButtons) {
    avatarCropOverlay=element("div","sl-pv-crop-backdrop");
    avatarCropOverlay.hidden=true;
    const cropDialog=element("section","sl-pv-crop-dialog");
    cropDialog.setAttribute("role","dialog");
    cropDialog.setAttribute("aria-modal","true");
    cropDialog.setAttribute("aria-labelledby","slPvCropTitle");
    cropDialog.setAttribute("aria-describedby","slPvCropHint");
    const cropHeader=element("div","sl-pv-crop-header");
    const cropTitle=element("h2","","Adjust Profile Picture");
    cropTitle.id="slPvCropTitle";
    const cropClose=button("sl-pv-crop-close","","Close photo editor");
    cropClose.append(icon("x"));
    cropHeader.append(cropTitle,cropClose);
    const cropHint=element("p","sl-pv-crop-hint",
      "Drag the square to choose the area. Use Zoom to resize your selection.");
    cropHint.id="slPvCropHint";
    avatarCropStage=element("div","sl-pv-crop-stage");
    avatarCropStage.setAttribute("aria-label","Profile picture with movable square selection");
    avatarCropImageElement=element("img","sl-pv-crop-image");
    avatarCropImageElement.alt="";
    avatarCropImageElement.draggable=false;
    avatarCropSquare=element("div","sl-pv-crop-square");
    avatarCropSquare.tabIndex=0;
    avatarCropSquare.setAttribute("role","group");
    avatarCropSquare.setAttribute("aria-label","Square crop: drag, or use arrow keys to move");
    const cropGrid=element("span","sl-pv-crop-grid");
    cropGrid.setAttribute("aria-hidden","true");
    avatarCropSquare.append(cropGrid);
    avatarCropStage.append(avatarCropImageElement,avatarCropSquare);
    const cropControls=element("div","sl-pv-crop-controls");
    const cropZoomLabel=element("label","sl-pv-crop-zoom-label","Zoom");
    cropZoomLabel.htmlFor="slPvCropZoom";
    avatarCropZoom=element("input","sl-pv-crop-zoom");
    avatarCropZoom.id="slPvCropZoom";
    avatarCropZoom.type="range";
    avatarCropZoom.min="1";avatarCropZoom.max="3";avatarCropZoom.step=".05";
    avatarCropZoom.value="1";
    avatarCropZoom.setAttribute("aria-label","Zoom into selected photo area");
    const cropZoomValue=element("span","sl-pv-crop-zoom-value","1.0×");
    const previewWrap=element("div","sl-pv-crop-preview-wrap");
    avatarCropPreview=element("canvas","sl-pv-crop-preview");
    avatarCropPreview.width=avatarCropPreview.height=92;
    avatarCropPreview.setAttribute("role","img");
    avatarCropPreview.setAttribute("aria-label","Live circular preview of the selected profile picture");
    previewWrap.append(avatarCropPreview);
    cropControls.append(cropZoomLabel,avatarCropZoom,cropZoomValue,previewWrap);
    avatarCropMessage=element("p","sl-pv-crop-message","");
    avatarCropMessage.hidden=true;
    avatarCropMessage.setAttribute("role","alert");
    const cropActions=element("div","sl-pv-crop-actions");
    avatarCropCancel=button("sl-pv-crop-cancel","Cancel");
    avatarCropSave=button("sl-pv-crop-save","Save Photo");
    cropActions.append(avatarCropCancel,avatarCropSave);
    cropDialog.append(cropHeader,cropHint,avatarCropStage,cropControls,avatarCropMessage,cropActions);
    avatarCropOverlay.append(cropDialog);
    document.body.append(avatarCropOverlay);
    const finishDrag=event=>{
      if(avatarCropDrag && event.pointerId===avatarCropDrag.pointerId)avatarCropDrag=null;
    };
    avatarCropSquare.addEventListener("pointerdown",event=>{
      if(avatarBusy || !avatarCropState || event.button!==0)return;
      event.preventDefault();
      avatarCropDrag={pointerId:event.pointerId,
        clientX:event.clientX,clientY:event.clientY,
        x:avatarCropState.x,y:avatarCropState.y};
      avatarCropSquare.setPointerCapture?.(event.pointerId);
    });
    avatarCropSquare.addEventListener("pointermove",event=>{
      const drag=avatarCropDrag,state=avatarCropState,geometry=cropGeometry();
      if(!drag || drag.pointerId!==event.pointerId || !state || !geometry)return;
      state.x=clampCrop(drag.x+(event.clientX-drag.clientX)/geometry.scale,0,state.width-state.size);
      state.y=clampCrop(drag.y+(event.clientY-drag.clientY)/geometry.scale,0,state.height-state.size);
      redrawAvatarCrop();
    });
    avatarCropSquare.addEventListener("pointerup",finishDrag);
    avatarCropSquare.addEventListener("pointercancel",finishDrag);
    avatarCropSquare.addEventListener("keydown",event=>{
      const state=avatarCropState;
      if(!state || avatarBusy)return;
      const step=state.size*(event.shiftKey ? .05 : .01);
      if(event.key==="ArrowLeft")state.x=clampCrop(state.x-step,0,state.width-state.size);
      else if(event.key==="ArrowRight")state.x=clampCrop(state.x+step,0,state.width-state.size);
      else if(event.key==="ArrowUp")state.y=clampCrop(state.y-step,0,state.height-state.size);
      else if(event.key==="ArrowDown")state.y=clampCrop(state.y+step,0,state.height-state.size);
      else return;
      event.preventDefault();
      redrawAvatarCrop();
    });
    avatarCropZoom.addEventListener("input",()=>{
      const state=avatarCropState;
      if(!state || avatarBusy)return;
      const zoom=Number(avatarCropZoom.value);
      if(!Number.isFinite(zoom) || zoom<1)return;
      const centerX=state.x+state.size/2,centerY=state.y+state.size/2;
      state.size=Math.min(state.width,state.height)/zoom;
      state.x=clampCrop(centerX-state.size/2,0,state.width-state.size);
      state.y=clampCrop(centerY-state.size/2,0,state.height-state.size);
      cropZoomValue.textContent=zoom.toFixed(1)+"×";
      redrawAvatarCrop();
    });
    avatarCropCancel.addEventListener("click",()=>closeAvatarCrop());
    cropClose.addEventListener("click",()=>closeAvatarCrop());
    avatarCropOverlay.addEventListener("pointerdown",event=>{
      if(event.target===avatarCropOverlay)closeAvatarCrop();
    });
    window.addEventListener("resize",()=>{
      if(avatarCropOverlay && !avatarCropOverlay.hidden)redrawAvatarCrop();
    },{passive:true});
    avatarCropSave.addEventListener("click",async()=>{
      if(avatarBusy || !avatarCropFile || !avatarCropState ||
          !accountUser || accountUser.is_anonymous || viewedUserId!==accountUser.id)return;
      const id=viewedUserId;
      const file=avatarCropFile;
      const crop={x:avatarCropState.x,y:avatarCropState.y,size:avatarCropState.size};
      avatarBusy=true;syncAvatarButtons();
      avatarCropSave.disabled=true;
      avatarCropCancel.disabled=true;
      cropClose.disabled=true;
      avatarCropZoom.disabled=true;
      avatarCropMessage.hidden=false;
      avatarCropMessage.dataset.state="";
      avatarCropMessage.textContent="Processing and uploading photo…";
      try {
        await window.StudyLabAvatar.save(file,crop);
        if(view && !view.hidden && viewedUserId===id) {
          avatarHasPhoto=true;
          avatarStatus.hidden=false;
          avatarStatus.dataset.state="success";
          avatarStatus.textContent="Profile picture saved.";
        }
        closeAvatarCrop(true);
      } catch(error) {
        avatarCropMessage.hidden=false;
        avatarCropMessage.dataset.state="error";
        avatarCropMessage.textContent=error?.message||"Could not save photo. Try again.";
      } finally {
        avatarBusy=false;
        avatarCropSave.disabled=false;
        avatarCropCancel.disabled=false;
        cropClose.disabled=false;
        avatarCropZoom.disabled=false;
        if(viewedUserId===id)syncAvatarButtons();
      }
    });
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
    const avatarWrap=element("div","sl-pv-avatar-wrap");
    avatarToggle=button("sl-pv-avatar-toggle","","Edit profile picture");
    avatarToggle.append(icon("camera"));
    avatarToggle.hidden=true;
    avatarToggle.setAttribute("aria-expanded","false");
    avatarToggle.setAttribute("aria-controls","slPvAvatarEditor");
    avatarWrap.append(avatarNode,avatarToggle);
    identity.append(avatarWrap,titleWrap);

    // Profile picture editing lives ONLY in this View Profile card.
    // The normal Edit Profile forms never receive upload controls.
    avatarEditor = element("section","sl-pv-avatar-editor");
    avatarEditor.id="slPvAvatarEditor";
    avatarEditor.hidden = true;
    avatarToggle.addEventListener("click",()=>{
      if(avatarBusy || !accountUser || viewedUserId!==accountUser.id)return;
      avatarEditor.hidden=!avatarEditor.hidden;
      avatarToggle.setAttribute("aria-expanded",String(!avatarEditor.hidden));
      if(!avatarEditor.hidden)avatarPick.focus();
    });
    const avatarActions = element("div","sl-pv-avatar-actions");
    // Native input inside a label: mobile/Edge browsers can open the picker
    // without relying on a scripted click against a display:none input.
    avatarPick = element("label","sl-pv-avatar-upload","Upload photo");
    avatarPick.tabIndex = 0;
    avatarRemove = button("sl-pv-avatar-remove","Use default avatar");
    avatarRemove.disabled = true;
    avatarFile = element("input","sl-pv-avatar-input");
    avatarFile.type = "file";
    avatarFile.accept = "image/jpeg,image/png,image/webp";
    avatarFile.setAttribute("aria-label","Choose JPG, PNG or WebP profile picture");
    avatarPick.append(avatarFile);
    avatarActions.append(avatarPick,avatarRemove);
    const photoNote = element("p","sl-pv-avatar-note",
      "JPG, PNG or WebP · up to 1 MB · choose your crop · saved as 320 px WebP. Photos are visible to other students.");
    avatarStatus = element("p","sl-pv-avatar-message","");
    avatarStatus.hidden = true;
    avatarStatus.setAttribute("role","status");
    avatarEditor.append(avatarActions,photoNote,avatarStatus);
    const syncAvatarButtons = () => {
      avatarPick.classList.toggle("is-disabled",avatarBusy);
      avatarPick.setAttribute("aria-disabled",String(avatarBusy));
      avatarFile.disabled = avatarBusy;
      avatarRemove.disabled = avatarBusy || !avatarHasPhoto;
      avatarPick.firstChild.textContent = avatarHasPhoto ? "Change photo" : "Upload photo";
    };
    makeAvatarCrop(syncAvatarButtons);
    avatarPick.addEventListener("keydown",event=>{
      if (avatarBusy) return;
      if (event.key==="Enter" || event.key===" ") {
        event.preventDefault();
        avatarFile.click();
      }
    });
    avatarFile.addEventListener("change",()=>{
      const file=avatarFile.files?.[0];
      avatarFile.value="";
      if(!file || avatarBusy || viewedUserId!==accountUser?.id)return;
      // Open the crop editor first. Only its Save Photo button uploads.
      openAvatarCrop(file);
    });
    avatarRemove.addEventListener("click",async()=>{
      if (avatarBusy || !avatarHasPhoto || viewedUserId!==accountUser?.id) return;
      if (!window.confirm("Remove your profile picture and use the original profile icon?")) return;
      const id = viewedUserId;
      avatarBusy = true;syncAvatarButtons();
      avatarStatus.hidden = false;avatarStatus.textContent = "Removing photo…";
      avatarStatus.dataset.state = "";
      try {
        await window.StudyLabAvatar.remove();
        if (view.hidden || viewedUserId!==id) return;
        avatarHasPhoto = false;
        avatarStatus.textContent = "Original profile icon restored.";
        avatarStatus.dataset.state = "success";
      } catch (error) {
        if (view.hidden || viewedUserId!==id) return;
        avatarStatus.textContent = error?.message || "Could not remove photo.";
        avatarStatus.dataset.state = "error";
      } finally {
        avatarBusy = false;
        if (viewedUserId===id) syncAvatarButtons();
      }
    });

    bioNode = element("p","sl-pv-description","No bio added yet.");
    bioNode.id="slPvDescription";
    bioSummary=element("section","sl-pv-bio-summary");
    const bioSummaryHeading=element("div","sl-pv-bio-summary-heading");
    bioSummaryHeading.append(element("strong","","Bio"));
    bioEditToggle=button("sl-pv-bio-edit-toggle","","Edit Bio");
    bioEditToggle.append(icon("edit"),element("span","","Edit"));
    bioEditToggle.hidden=true;
    bioEditToggle.setAttribute("aria-controls","slPvBioEditor");
    bioEditToggle.setAttribute("aria-expanded","false");
    bioSummaryHeading.append(bioEditToggle);
    bioSummary.append(bioSummaryHeading,bioNode);
    const resizeBioInput=()=>{
      if(bioEditor.hidden)return;
      bioInput.style.height="auto";
      bioInput.style.height=Math.min(146,Math.max(45,bioInput.scrollHeight))+"px";
      bioInput.style.overflowY=bioInput.scrollHeight>146?"auto":"hidden";
    };
    bioEditToggle.addEventListener("click",()=>{
      if(bioSaving || !accountUser || viewedUserId!==accountUser.id)return;
      const opening=bioEditor.hidden;
      bioEditor.hidden=!opening;
      bioNode.hidden=opening;
      bioEditToggle.setAttribute("aria-expanded",String(opening));
      bioEditToggle.querySelector("span").textContent=opening?"Cancel":"Edit";
      if(opening){
        bioInput.value=bioNode.textContent==="No bio added yet."?"":bioNode.textContent;
        updateBioWords();
        resizeBioInput();
        bioInput.focus();
      }else{
        bioInput.value=bioNode.textContent==="No bio added yet."?"":bioNode.textContent;
        bioStatus.hidden=true;
      }
    });

    // The owner edits the bio here, not in the general profile form.
    // Other students only ever see the safe, read-only public text.
    bioEditor = element("div","sl-pv-bio-editor");
    bioEditor.id="slPvBioEditor";
    bioEditor.hidden = true;
    const bioLabel = element("label","sl-pv-bio-label","My Bio");
    bioLabel.htmlFor = "slPvBioInput";
    bioLabel.id = "slPvBioLabel";
    bioInput = element("textarea","sl-pv-bio-input");
    bioInput.id = "slPvBioInput";
    bioInput.rows = 1;
    bioInput.maxLength = 240; // Existing longer bios stay readable until edited.
    bioInput.placeholder = "A little about your studies…";
    bioInput.setAttribute("aria-describedby","slPvBioCount");
    const bioControls = element("div","sl-pv-bio-controls");
    bioCount = element("span","sl-pv-bio-count","0 / 35 characters");
    bioCount.id="slPvBioCount";
    bioSave = createButton("sl-pv-bio-save","edit","Save Bio");
    bioSave.disabled = true;
    bioControls.append(bioCount,bioSave);
    bioStatus = element("p","sl-pv-bio-status","");
    bioStatus.hidden = true;
    bioStatus.setAttribute("role","status");
    bioEditor.append(bioLabel,bioInput,bioControls,bioStatus);
    // Edit in the same Bio card: no duplicate editing section below it.
    bioSummary.append(bioEditor);

    const updateBioWords=()=>{
      const count=Array.from(bioInput.value.trim()).length;
      bioCount.textContent=count+" / 35 characters";
      bioCount.classList.toggle("is-over-limit",count>35);
      bioInput.setAttribute("aria-invalid",String(count>35));
      bioSave.disabled=count>35 || bioSaving || !accountUser ||
        viewedUserId!==accountUser.id;
      if(!bioStatus.hidden)bioStatus.hidden=true;
    };
    bioInput.addEventListener("input",()=>{
      resizeBioInput();
      updateBioWords();
    });
    bioSave.addEventListener("click",async()=>{
      if(bioSaving || !accountUser || viewedUserId!==accountUser.id)return;
      const id=viewedUserId;
      const account=window.StudyLabAccount;
      if(!account?.saveBio)return;
      bioSaving=true;
      bioSave.disabled=true;
      bioInput.disabled=true;
      bioStatus.hidden=true;
      try{
        const profile=await account.saveBio(bioInput.value);
        if(view.hidden || viewedUserId!==id)return;
        const saved=escText(profile?.bio);
        bioInput.value=saved;
        bioNode.textContent=saved||"No bio added yet.";
        bioCount.textContent=Array.from(saved).length+" / 35 characters";
        bioEditor.hidden=true;
        bioNode.hidden=false;
        bioEditToggle.setAttribute("aria-expanded","false");
        bioEditToggle.querySelector("span").textContent="Edit";
        bioStatus.textContent="Bio saved.";
        bioStatus.dataset.state="success";
        bioStatus.hidden=false;
        window.dispatchEvent(new CustomEvent("studylab-profile-updated",{detail:profile}));
      }catch(error){
        if(view.hidden||viewedUserId!==id)return;
        bioStatus.textContent=error?.message || "Could not save bio. Please try again.";
        bioStatus.dataset.state="error";
        bioStatus.hidden=false;
      }finally{
        bioSaving=false;
        bioInput.disabled=false;
        if(viewedUserId===id){
          bioSave.disabled=Array.from(bioInput.value.trim()).length>35;
        }
      }
    });

    const counts = element("div","sl-pv-counts");
    for (const label of ["Followers","Following"]){
      const item = button("sl-pv-count");
      item.dataset.listType = label.toLowerCase();
      item.setAttribute("aria-label","View "+label);
      item.append(element("strong","sl-pv-count-number","—"),element("span","sl-pv-count-label",label));
      item.addEventListener("click",()=>openList(item.dataset.listType));
      countButtons.push(item);
      counts.append(item);
    }
    const actions=element("div","sl-pv-actions");
    edit = createButton("sl-pv-edit","edit","Edit Profile");
    deleteStart = createButton("sl-pv-delete","trash","Delete Account");
    actions.append(edit,deleteStart);
    followAction=element("div","sl-pv-follow-action");
    followAction.hidden=true;

    const joined=element("div","sl-pv-joined");
    joined.append(icon("calendar"));
    joinedNode = element("span","","Account created · —");
    joined.append(joinedNode);
    viewStatus=element("p","sl-pv-status","");
    viewStatus.setAttribute("role","status");
    viewStatus.hidden=true;

    // Followers and Following open as a separate glass popup, never expanding
    // the profile card itself.
    listBackdrop=element("div","sl-pv-list-backdrop");
    listBackdrop.hidden=true;
    listPanel=element("section","sl-pv-student-list sl-pv-list-dialog");
    listPanel.setAttribute("role","dialog");
    listPanel.setAttribute("aria-modal","true");
    listPanel.setAttribute("aria-label","Student connections");
    listPanel.hidden=true;
    listBackdrop.append(listPanel);
    dialog.append(header,identity,avatarEditor,bioSummary,counts,actions,followAction,joined,viewStatus);
    view.append(dialog);
    document.body.append(view,listBackdrop);
    listBackdrop.addEventListener("pointerdown",event=>{
      if(event.target===listBackdrop)closeList();
    });

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
      "This permanently deletes your sign-in, posts, likes, comments, follows and Study Room history. Only one anonymized profile record remains, without your name, username, phone, school or bio. This cannot be undone.");
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
      if(avatarCropOverlay && !avatarCropOverlay.hidden){
        if(event.key==="Escape"){event.preventDefault();closeAvatarCrop();}
        else trap(event,avatarCropOverlay);
        return;
      }
      if(confirmView && !confirmView.hidden){
        if(event.key==="Escape") {event.preventDefault();closeConfirm();}
        else trap(event,confirmView);
        return;
      }
      if(listBackdrop && !listBackdrop.hidden){
        if(event.key==="Escape"){event.preventDefault();closeList();}
        else trap(event,listPanel);
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
    delete avatarNode.dataset.slAvatarUrl;
    avatarNode.classList.remove("sl-avatar-has-image");
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
  function closeList(){
    if (!listPanel || listBackdrop?.hidden) return;
    listBackdrop.hidden=true;
    listPanel.hidden=true;
    listPanel.replaceChildren();
    countButtons.find(b=>b.dataset.listType===listBackdrop.dataset.type)?.focus();
  }
  async function openList(type){
    const follow=window.StudyLabFollow;
    if(!viewedUserId||!follow||!listPanel)return;
    listBackdrop.dataset.type=type;
    listBackdrop.hidden=false;
    listPanel.hidden=false;
    listPanel.replaceChildren();
    const heading=element("div","sl-pv-list-heading");
    const title=element("strong","",type==="followers"?"Followers":"Following");
    const dismissList=button("sl-pv-list-close","×","Close connections");
    listDismiss=dismissList;
    dismissList.addEventListener("click",closeList);
    heading.append(title,dismissList);
    const container=element("div","sl-pv-list-rows");
    container.append(element("p","sl-pv-list-empty","Loading students…"));
    listPanel.append(heading,container);
    dismissList.focus();
    const id=viewedUserId;
    try{
      const profiles=await follow.list(type,id);
      if(viewedUserId!==id||listPanel.hidden)return;
      container.replaceChildren();
      if(!profiles.length){
        container.append(element("p","sl-pv-list-empty","No students here yet."));
        return;
      }
      await window.StudyLabAvatar?.prefetch(profiles.map(p=>p.user_id)).catch(()=>{});
      for(const profile of profiles){
        const row=button("sl-pv-list-user");
        const gender=profile.gender==="female"?"female":"male";
        const avatar=element("span","sl-pv-list-avatar sl-pv-list-avatar-"+gender);
        const fallback=document.createElementNS(SVG_NS,"svg");
        fallback.setAttribute("viewBox","0 0 24 24");
        fallback.setAttribute("aria-hidden","true");
        const head=document.createElementNS(SVG_NS,"circle");
        head.setAttribute("cx","12");head.setAttribute("cy","7");head.setAttribute("r","3.2");
        const shoulders=document.createElementNS(SVG_NS,"path");
        shoulders.setAttribute("d",gender==="female"
          ?"M7 20 8 15.8A4.1 4.1 0 0 1 16 15.8L17 20Z"
          :"M4.5 20V18A7.5 7.5 0 0 1 19.5 18V20Z");
        fallback.append(head,shoulders);
        avatar.append(fallback);
        window.StudyLabAvatar?.decorate(avatar,profile.user_id);
        const identity=element("span","sl-pv-list-identity");
        const name=element("strong","",profile.display_name||"Student");
        window.StudyLabNameMark?.decorate(name,profile.user_id);
        identity.append(name,element("small","","@"+profile.username));
        row.append(avatar,identity,icon("arrow"));
        row.addEventListener("click",()=>{
          closeList();
          open({userId:profile.user_id});
        });
        container.append(row);
      }
    }catch(error){
      container.replaceChildren(element("p","sl-pv-list-empty","Could not load this list."));
    }
  }
  async function updateCounts(id,serial){
    const follow=window.StudyLabFollow;
    if(!follow)return;
    try{
      const counts=await follow.stats(id);
      if(serial!==viewSequence||view.hidden||viewedUserId!==id)return;
      countButtons[0].querySelector(".sl-pv-count-number").textContent=String(counts.followers);
      countButtons[1].querySelector(".sl-pv-count-number").textContent=String(counts.following);
    }catch(error){
      console.warn("StudyLab profile follower counts:",error);
    }
  }
  async function open(options={}){
    make();
    const account=window.StudyLabAccount;
    if(!account?.getUser)return false;
    const user=account.getUser();
    if(!user || (user.is_anonymous && (!options.userId || options.userId===user.id)))return false;
    const id=options.userId||user.id;
    if (avatarCropOverlay && !avatarCropOverlay.hidden) {
      if(avatarBusy)return false;
      closeAvatarCrop();
    }
    const own=id===user.id;
    const serial=++viewSequence;
    lastFocus=document.activeElement;
    editHandler=typeof options.openEdit==="function"
      ?options.openEdit
      :()=>document.querySelector('.profile-account-menu [data-account-action="profile"]')?.click();
    accountUser=user;
    viewedUserId=id;
    nameNode.textContent=own?(escText(user.user_metadata?.full_name)||"Student"):"Student";
    usernameNode.textContent="Loading profile…";
    joinedNode.textContent=own?joinedDate(user.created_at):"Account created · —";
    paintAvatar("male");
    window.StudyLabAvatar?.decorate(avatarNode,id);
    window.StudyLabNameMark?.decorate(nameNode,null);
    viewStatus.hidden=true;
    listPanel.hidden=true;
    listBackdrop.hidden=true;
    countButtons.forEach(node=>{node.querySelector(".sl-pv-count-number").textContent="—";});
    dialog.querySelector(".sl-pv-eyebrow").textContent=own?"STUDYLAB · MY PROFILE":"STUDYLAB · STUDENT PROFILE";
    bioNode.hidden=false;
    bioNode.textContent="Loading bio…";
    bioSummary.hidden=false;
    bioEditToggle.hidden=!own;
    bioEditToggle.setAttribute("aria-expanded","false");
    bioEditToggle.querySelector("span").textContent="Edit";
    bioEditor.hidden=true;
    avatarToggle.hidden=!own;
    avatarToggle.setAttribute("aria-expanded","false");
    avatarEditor.hidden=true;
    avatarHasPhoto=false;
    avatarBusy=false;
    avatarPick.firstChild.textContent="Upload photo";
    avatarPick.classList.remove("is-disabled");
    avatarPick.setAttribute("aria-disabled","false");
    avatarFile.disabled=false;
    avatarRemove.disabled=true;
    avatarFile.value="";
    avatarStatus.hidden=true;
    bioInput.value="";
    bioInput.disabled=false;
    bioSave.disabled=true;
    bioCount.textContent="0 / 35 characters";
    bioCount.classList.remove("is-over-limit");
    bioStatus.hidden=true;
    bioNode.textContent="Loading bio…";
    dialog.setAttribute("aria-describedby","slPvDescription");
    dialog.querySelector(".sl-pv-actions").hidden=!own;
    followAction.hidden=own;
    followAction.replaceChildren();
    if(!own){
      const followButton=window.StudyLabFollow?.makeButton(id);
      if(followButton)followAction.append(followButton);
      else followAction.append(element("p","sl-pv-status","Follow is temporarily unavailable."));
    }
    view.hidden=false;
    document.body.classList.add("sl-profile-view-open");
    requestAnimationFrame(()=>dismiss.focus());
    updateCounts(id,serial);
    try{
      const profile=own
        ?await account.getProfile(true)
        :await window.StudyLabFollow?.getProfile(id);
      if(serial!==viewSequence||view.hidden||viewedUserId!==id)return true;
      if(!profile)throw new Error("This student's profile is unavailable.");
      nameNode.textContent=escText(profile.display_name)||"Student";
      if(own){
        const saved=escText(profile.bio);
        bioNode.textContent=saved||"No bio added yet.";
        bioInput.value=saved;
        const chars=Array.from(saved).length;
        bioCount.textContent=chars+" / 35 characters";
        bioCount.classList.toggle("is-over-limit",chars>35);
        bioSave.disabled=chars>35;
      }else{
        bioNode.textContent=escText(profile.bio)||"No bio added yet.";
      }
      usernameNode.textContent=profile.username?"@"+escText(profile.username):"Username not set";
      joinedNode.textContent=joinedDate((own?user.created_at:null)||profile.joined_at||profile.created_at);
      paintAvatar(profile.gender==="female"?"female":"male");
      window.StudyLabAvatar?.decorate(avatarNode,id);
      try {
        const hasPhoto = await window.StudyLabAvatar?.get(id,true);
        if (serial===viewSequence && !view.hidden && viewedUserId===id && own) {
          avatarHasPhoto=Boolean(hasPhoto);
          avatarRemove.disabled=!avatarHasPhoto;
          avatarPick.firstChild.textContent=avatarHasPhoto?"Change photo":"Upload photo";
        }
      }catch(error){console.warn("Profile picture lookup unavailable:",error);}
      window.StudyLabNameMark?.decorate(nameNode,id);
    }catch(error){
      if(serial===viewSequence&&!view.hidden&&viewedUserId===id){
        usernameNode.textContent="Profile temporarily unavailable";
        if(own){
          bioInput.disabled=true;
          bioSave.disabled=true;
        }else bioNode.textContent="Bio unavailable.";
        window.StudyLabNameMark?.decorate(nameNode,id);
        viewStatus.textContent=error?.message||"Could not refresh this student profile.";
        viewStatus.hidden=false;
      }
    }
    return true;
  }

  async function deleteAccount(){
    if(deleting || !confirmed || confirmInput.value!=="DELETE" || !accountUser ||
       viewedUserId!==accountUser.id || accountUser.is_anonymous)return;
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
      // The dedicated Supabase Edge Function has the private service role
      // available server-side, with no separate Netlify key configuration.
      const {data:result,error:deleteError}=await account.client.functions.invoke(
        "studylab-delete-account",{body:{confirmation:"DELETE"}}
      );
      if(deleteError){
        let detail="";
        try{detail=(await deleteError.context?.json?.())?.message||"";}catch(_){}
        throw new Error(detail||deleteError.message||
          "Account deletion is unavailable. Please try again.");
      }
      if(result?.deleted!==true){
        throw new Error(result?.message||"Account deletion could not be verified.");
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
  window.addEventListener("studylab:follow-error",event=>{
    if(view && !view.hidden){
      viewStatus.textContent=event.detail?.message||"Could not update following.";
      viewStatus.hidden=false;
    }
  });
  window.addEventListener("studylab:follow-changed",event=>{
    if(view?.hidden||!viewedUserId)return;
    if(event.detail?.targetId===viewedUserId || viewedUserId===window.StudyLabFollow?.currentId()){
      updateCounts(viewedUserId,viewSequence);
    }
  });
  Object.defineProperty(window,"StudyLabProfileView",{
    value:Object.freeze({open}),writable:false,configurable:false
  });
})();
