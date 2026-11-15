/* StudyLab avatars: one optional 320px WebP per account.
   Readable by signed-in students; editable only by the account owner.
   Keep existing SVGs, neon outlines and crown layers as fallbacks. */
(() => {
  "use strict";
  if (window.StudyLabAvatar) return;
  const BUCKET = "studylab-avatars";
  const MAX_UPLOAD = 1024 * 1024;
  const PHOTO_SIZE = 320;
  const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  const cache = new Map();
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
    const item = cache.get(uid);
    const url = item?.updatedAt ? publicUrl(uid, item.updatedAt) : "";
    if (node.dataset.slAvatarUrl === url) return;
    node.dataset.slAvatarUrl = url;
    node.classList.remove("sl-avatar-has-image");
    node.querySelector(":scope > img.sl-avatar-photo")?.remove();
    if (!url) return;
    const img = document.createElement("img");
    img.className = "sl-avatar-photo";
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.hidden = true;
    img.onload = () => {
      if (node.dataset.slAvatarUrl !== url) return;
      img.hidden = false;
      node.classList.add("sl-avatar-has-image");
    };
    img.onerror = () => {
      if (node.dataset.slAvatarUrl !== url) return;
      img.remove();
      node.classList.remove("sl-avatar-has-image");
    };
    node.append(img);
    img.src = url;
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
  async function readFile(file) {
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
      await image.decode();
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width > 8192 || height > 8192 ||
          width * height > 20000000) throw new Error("Image dimensions are too large.");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = PHOTO_SIZE;
      const ctx = canvas.getContext("2d",{alpha:false});
      if (!ctx) throw new Error("Your browser cannot process this image.");
      // Square center crop, then re-encode: strips camera EXIF/GPS metadata.
      const edge = Math.min(width,height);
      ctx.drawImage(image,(width-edge)/2,(height-edge)/2,edge,edge,
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
  async function save(file) {
    const value = account();
    await value.ready;
    const uid = ownId();
    const blob = await readFile(file);
    const {error:uploadError} = await value.client.storage.from(BUCKET)
      .upload(pathFor(uid),blob,{upsert:true,contentType:"image/webp",cacheControl:"3600"});
    if (uploadError) throw uploadError;
    const updatedAt = new Date().toISOString();
    const {data,error} = await value.client.from("studylab_profile_avatars")
      .upsert({user_id:uid,updated_at:updatedAt},{onConflict:"user_id"})
      .select("updated_at").single();
    if (error) throw error;
    setCache(uid,data.updated_at,Date.now()+1);
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