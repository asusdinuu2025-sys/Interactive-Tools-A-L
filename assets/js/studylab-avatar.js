/* StudyLab avatars: one optional 320px WebP per account.
   Readable by signed-in students; editable only by the account owner.
   Keep existing SVGs, neon outlines and crown layers as fallbacks. */
(() => {
  "use strict";
  if (window.StudyLabAvatar) return;
  const BUCKET = "studylab-avatars";
  const MAX_UPLOAD = 1024 * 1024;
  const PHOTO_SIZE = 320;
  const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  const cache = new Map();
  // Store each original icon separately so real photos can REPLACE the icon
  // instead of sitting behind or in front of it. Never discard the fallback.
  const originalIcons = new WeakMap();
  function rememberIcon(node) {
    const originals=[...node.childNodes].filter(child=>
      !(child.nodeType===1 && child.classList?.contains("sl-avatar-photo")));
    if(originals.length)originalIcons.set(node,originals.map(child=>child.cloneNode(true)));
  }
  function restoreIcon(node) {
    const saved=originalIcons.get(node);
    if(saved?.length)node.replaceChildren(...saved.map(child=>child.cloneNode(true)));
    else node.querySelector(":scope > img.sl-avatar-photo")?.remove();
    node.classList.remove("sl-avatar-has-image");
  }

  const queue = new Set();
  const CACHE_MS = 90000;
  let queueTimer = null;

  function account() {
    const value = window.StudyLabAccount;
    if (!value?.client || !value?.getUser) throw new Error("StudyLab account is unavailable.");
    return value;
  }
  function pathFor(uid) { return uid + "/avatar.webp"; }
  function valid(uid) { return typeof uid === "string" && UUID.test(uid); }
  function ownId() {
    const user = account().getUser();
    if (!user?.id || user.is_anonymous) throw new Error("Sign in to upload a profile picture.");
    return user.id;
  }
  function publicUrl(uid, updatedAt) {
    const { data } = account().client.storage.from(BUCKET).getPublicUrl(pathFor(uid));
    // Replacements never get stuck behind a browser's previous image cache.
    return data.publicUrl + "?v=" + encodeURIComponent(updatedAt);
  }
  function render(node, uid) {
    if (!node || !valid(uid)) return;
    // Gender SVGs can be rebuilt on profile refresh; remember the most recent
    // fallback before loading any image.
    if (!node.classList.contains("sl-avatar-has-image")) rememberIcon(node);
    const item=cache.get(uid);
    const url=item?.updatedAt ? publicUrl(uid,item.updatedAt) : "";
    const previous=node.dataset.slAvatarUrl;
    if(previous===url) return;
    node.dataset.slAvatarUrl=url;
    if(!url){
      restoreIcon(node);
      return;
    }
    // Do NOT append an invisible image next to the original SVG. Once decoded,
    // make the actual photo the sole avatar child. This avoids stacking,
    // opacity and fallback-visibility conflicts across StudyLab themes.
    const img=new Image();
    img.className="sl-avatar-photo";
    img.alt="";
    img.decoding="async";
    img.loading="eager";
    img.referrerPolicy="no-referrer";
    img.setAttribute("aria-hidden","true");
    img.onload=()=>{
      if(node.dataset.slAvatarUrl!==url)return;
      if(!img.naturalWidth || !img.naturalHeight) return;
      img.style.opacity="1";
      img.style.visibility="visible";
      img.style.display="block";
      node.replaceChildren(img);
      node.classList.add("sl-avatar-has-image");
    };
    img.onerror=()=>{
      if(node.dataset.slAvatarUrl!==url)return;
      // Keep the original icon, not a blank circle, after a broken upload.
      restoreIcon(node);
    };
    img.src=url;
    if(img.complete && img.naturalWidth>0)img.onload();
  }
  // Successful Storage writes are not proof that a browser can display
  // the public image. Decode the actual public URL before confirming success.
  function verifyPublicImage(url, timeoutMs = 9000) {
    return new Promise((resolve,reject)=>{
      const photo = new Image();
      let finished = false;
      const timeout = setTimeout(()=>finish(false,"Image request timed out."),timeoutMs);
      function finish(ok,reason) {
        if(finished)return;
        finished=true;clearTimeout(timeout);
        photo.onload=null;photo.onerror=null;
        if(ok)resolve(true);
        else reject(new Error(reason || "The stored picture could not be displayed."));
      }
      photo.onload=()=>finish(photo.naturalWidth>0&&photo.naturalHeight>0,
        "The uploaded picture could not be decoded.");
      photo.onerror=()=>finish(false,"The stored image URL failed to load. Please try again.");
      photo.src=url;
      if(photo.complete&&photo.naturalWidth>0)finish(true);
    });
  }
  function waitForVisibleProfile(uid, url) {
    const viewer=document.getElementById("slProfileViewer");
    if(!viewer || viewer.hidden)return Promise.resolve(true);
    const node=viewer.querySelector(".sl-pv-avatar");
    if(!node || node.dataset.slAvatarUser!==uid){
      return Promise.reject(new Error("The profile picture couldn't attach to your profile. Reopen View Profile."));
    }
    return new Promise((resolve,reject)=>{
      const begun=Date.now();
      function check(){
        if(!node.isConnected || viewer.hidden)return resolve(true);
        const photo=node.querySelector(":scope > img.sl-avatar-photo");
        const shown=node.dataset.slAvatarUrl===url &&
          node.classList.contains("sl-avatar-has-image") &&
          photo && photo.naturalWidth>0 && photo.naturalHeight>0 &&
          !node.querySelector(":scope > svg");
        if(shown){
          const styles=getComputedStyle(photo);
          const dimensions=photo.getBoundingClientRect();
          if(styles.display!=="none" && styles.visibility!=="hidden" &&
             Number(styles.opacity)>0 && dimensions.width>=12 &&
             dimensions.height>=12){
            return resolve(true);
          }
        }
        if(Date.now()-begun>=5500)
          return reject(new Error("Your photo uploaded but the preview did not display. Please reopen View Profile."));
        requestAnimationFrame(check);
      }
      check();
    });
  }

  function paintAll(uid) {
    document.querySelectorAll('[data-sl-avatar-user="' + uid + '"]').forEach(node => render(node,uid));
  }
  function setCache(uid, updatedAt, checkedAt = Date.now()) {
    const old = cache.get(uid);
    // A slower older request must not undo a freshly uploaded/deleted image.
    if (old && old.checkedAt > checkedAt) return;
    cache.set(uid, {updatedAt:updatedAt || null, checkedAt});
    paintAll(uid);
  }
  async function prefetch(ids, options = {}) {
    const requested = [...new Set((ids || []).filter(valid))];
    if (!requested.length) return;
    const now = Date.now();
    const selected = requested.filter(uid =>
      options.force || !cache.has(uid) || now - cache.get(uid).checkedAt >= CACHE_MS);
    if (!selected.length) return;
    const value = account();
    await value.ready;
    if (!value.getUser()?.id) return;
    for (let i = 0; i < selected.length; i += 80) {
      const block = selected.slice(i,i+80);
      const started = Date.now();
      const {data,error} = await value.client.from("studylab_profile_avatars")
        .select("user_id,updated_at").in("user_id",block);
      if (error) throw error;
      const byId = new Map((data || []).map(row => [row.user_id,row.updated_at]));
      block.forEach(uid => setCache(uid,byId.get(uid) || null,started));
    }
  }
  function enqueue(uid) {
    queue.add(uid);
    if (queueTimer !== null) return;
    queueTimer = setTimeout(() => {
      queueTimer = null;
      const ids = [...queue];queue.clear();
      prefetch(ids).catch(error => console.warn("StudyLab avatars unavailable:",error));
    },0);
  }
  function decorate(node, uid) {
    if (!node || !valid(uid)) return;
    node.dataset.slAvatarUser = uid;
    render(node,uid);
    if (!cache.has(uid) || Date.now()-cache.get(uid).checkedAt>=CACHE_MS) enqueue(uid);
  }
  async function readFile(file,crop) {
    if (!(file instanceof File) ||
      !["image/jpeg","image/png","image/webp"].includes(file.type)) {
      throw new Error("Choose a JPG, PNG or WebP image.");
    }
    if (file.size < 1 || file.size > MAX_UPLOAD) {
      throw new Error("The original profile picture must be 1 MB or smaller.");
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    try {
      image.src = objectUrl;
      // Some browsers cannot decode through Image.decode() reliably.
      if (typeof image.decode === "function") {
        try { await image.decode(); }
        catch (_) {
          await new Promise((resolve,reject)=>{
            if (image.complete && image.naturalWidth) return resolve();
            image.onload=resolve;
            image.onerror=()=>reject(new Error("Could not read this image."));
          });
        }
      } else {
        await new Promise((resolve,reject)=>{
          image.onload=resolve;image.onerror=()=>reject(new Error("Could not read this image."));
        });
      }
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width > 8192 || height > 8192 ||
          width * height > 20000000) throw new Error("Image dimensions are too large.");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = PHOTO_SIZE;
      const ctx = canvas.getContext("2d",{alpha:false});
      if (!ctx) throw new Error("Your browser cannot process this image.");
      // Use the confirmed, manually positioned square when provided.
      // Keep centre crop as the legacy fallback for direct save() callers.
      // Re-encoding continues to strip original EXIF/GPS metadata.
      const edge = Math.min(width,height);
      let sourceX = (width-edge)/2, sourceY = (height-edge)/2, sourceSize = edge;
      if (crop !== undefined && crop !== null) {
        const {x,y,size} = crop;
        if (![x,y,size].every(Number.isFinite) || size < 1 ||
            size > edge || x < 0 || y < 0 ||
            x + size > width + .01 || y + size > height + .01) {
          throw new Error("Invalid photo selection. Adjust the square and try again.");
        }
        sourceX = x; sourceY = y; sourceSize = size;
      }
      ctx.drawImage(image,sourceX,sourceY,sourceSize,sourceSize,
        0,0,PHOTO_SIZE,PHOTO_SIZE);
      for (const quality of [0.82,0.70,0.58,0.45]) {
        const blob = await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
        if (!blob || blob.type !== "image/webp") throw new Error("WebP conversion failed.");
        if (blob.size <= 160 * 1024) return blob;
      }
      throw new Error("The image could not be compressed to a safe storage size.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  async function save(file,crop) {
    const value = account();
    await value.ready;
    const uid = ownId();
    const blob = await readFile(file,crop);
    // Explicit create/update is more reliable than a single upsert across
    // Storage policy versions. Do not remove the old photo until replacement succeeds.
    const bucket = value.client.storage.from(BUCKET);
    const path = pathFor(uid);
    let {error:uploadError} = await bucket.upload(path,blob,{
      upsert:false,contentType:"image/webp",cacheControl:"3600"
    });
    if (uploadError && (uploadError.statusCode === "409" ||
        uploadError.status === 409 || /already exists|duplicate/i.test(uploadError.message||""))) {
      const result = await bucket.update(path,blob,{contentType:"image/webp",cacheControl:"3600",upsert:true});
      uploadError = result.error;
    }
    if (uploadError) {
      const code = String(uploadError.statusCode || uploadError.status || "");
      const detail = uploadError.message || "Storage rejected the upload.";
      throw new Error("Photo upload failed" + (code ? " (" + code + ")" : "") + ": " + detail);
    }
    const updatedAt = new Date().toISOString();
    const {data,error} = await value.client.from("studylab_profile_avatars")
      .upsert({user_id:uid,updated_at:updatedAt},{onConflict:"user_id"})
      .select("updated_at").single();
    if (error) throw error;
    const photoUrl=publicUrl(uid,data.updated_at);
    // Verify before swapping SVG fallback: never announce success on an
    // unrenderable photo, even when Supabase accepted the upload.
    let verified=false;
    try {await verifyPublicImage(photoUrl);verified=true;}
    finally {
      setCache(uid,data.updated_at,Date.now()+1);
    }
    if(verified)await waitForVisibleProfile(uid,photoUrl);
    window.dispatchEvent(new CustomEvent("studylab-avatar-updated",{detail:{userId:uid,hasPhoto:true}}));
    return true;
  }
  async function remove() {
    const value = account();
    await value.ready;
    const uid = ownId();
    const {error:storageError} = await value.client.storage.from(BUCKET).remove([pathFor(uid)]);
    if (storageError) throw storageError;
    const {error} = await value.client.from("studylab_profile_avatars").delete().eq("user_id",uid);
    if (error) throw error;
    setCache(uid,null,Date.now()+1);
    window.dispatchEvent(new CustomEvent("studylab-avatar-updated",{detail:{userId:uid,hasPhoto:false}}));
  }
  async function get(uid, force = false) {
    if (!valid(uid)) return false;
    await prefetch([uid],{force});
    return Boolean(cache.get(uid)?.updatedAt);
  }
  document.addEventListener("visibilitychange",()=>{
    if (!document.hidden) {
      const ids = [...new Set([...document.querySelectorAll("[data-sl-avatar-user]")]
        .map(node=>node.dataset.slAvatarUser).filter(valid))];
      prefetch(ids).catch(()=>{});
    }
  });
  // Open tabs eventually see changes made on other devices, without polling
  // each card independently or adding queries to Study Room heartbeats.
  setInterval(()=>{
    if (document.hidden) return;
    const ids = [...new Set([...document.querySelectorAll("[data-sl-avatar-user]")]
      .map(node=>node.dataset.slAvatarUser).filter(valid))];
    prefetch(ids).catch(()=>{});
  },CACHE_MS);
  window.StudyLabAvatar = Object.freeze({decorate,prefetch,get,save,remove});
})();