/* StudyLab Social feed client.
   Uses the existing anonymous Supabase account; all user content is rendered as text.
   Posts/comments remain pending until an app_metadata admin approves them. */
(function () {
  "use strict";
  if (window.__studyLabSocialLoaded) return;
  window.__studyLabSocialLoaded = true;

  const BUCKET = "studylab-social";
  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
  const MAX_IMAGES = 4;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const panel = document.getElementById("studyLabFeedPanel");
  if (!panel) return;

  const form = panel.querySelector(".sl-feed-compose");
  let textarea = form?.querySelector("textarea");
  let postButton = form?.querySelector(".sl-feed-post-button");
  const stream = panel.querySelector(".sl-feed-stream");
  const note = panel.querySelector(".sl-feed-setup-note");
  if (!form || !textarea || !postButton || !stream) return;

  form.innerHTML = `
    <button class="sl-feed-create-trigger" type="button" aria-label="Start creating a post">
      <span aria-hidden="true">✎</span><span>Share something with students…</span>
    </button>
    <textarea maxlength="2000" placeholder="Share something with other students..." aria-label="Write a post"></textarea>
    <div class="sl-feed-file-row">
      <label class="sl-feed-file-button">
        <input class="sl-feed-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple>
        <span aria-hidden="true">＋</span> Add photos
      </label>
      <span class="sl-feed-file-count">No photos selected</span>
    </div>
    <div class="sl-feed-compose-foot">
      <span class="sl-feed-image-note">JPEG, PNG or WebP · up to 4 MB each · max 4 photos</span>
      <button class="sl-feed-post-button" type="submit">Post</button>
    </div>
    <div class="sl-feed-image-preview" aria-label="Selected photo previews"></div>
    <p class="sl-feed-compose-status" role="status" aria-live="polite"></p>`;
  textarea = form.querySelector("textarea");
  postButton = form.querySelector(".sl-feed-post-button");
  const input = form.querySelector(".sl-feed-file-input");
  const fileCount = form.querySelector(".sl-feed-file-count");
  const status = form.querySelector(".sl-feed-compose-status");
  const imagePreview = form.querySelector(".sl-feed-image-preview");
  let previewUrls = [];
  let busy = false;
  let isAdmin = false;
  let adminRefreshAttempted = false;
  let sortMode = "newest";
  let feedHasLoaded = false;
  status.hidden = true;

  function accountClient() {
    const account = window.StudyLabAccount;
    if (!account?.client || !account?.ready) throw new Error("StudyLab account is unavailable. Refresh and try again.");
    return account;
  }
  function setStatus(message, error = false) {
    status.textContent = message;
    status.dataset.state = error ? "error" : "info";
    status.hidden = !message;
  }
  function setBusy(value) {
    busy = value;
    postButton.disabled = value;
    postButton.textContent = value ? "Posting…" : "Post";
    textarea.disabled = value;
    input.disabled = value;
  }
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function emptyState(message) {
    stream.replaceChildren();
    const box = make("div", "sl-feed-empty");
    const icon = make("span", "sl-feed-empty-icon", "✦");
    icon.setAttribute("aria-hidden", "true");
    const heading = make("h3", "", message);
    const detail = make("p", "", "Be the first to share a useful question, study tip or learning moment with the StudyLab community.");
    box.append(icon, heading, detail);
    stream.append(box);
  }
  function showSkeletons() {
    stream.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const skeleton = make("div", "sl-feed-skeleton");
      skeleton.innerHTML = '<span></span><span></span><span></span>';
      stream.append(skeleton);
    }
  }
  function hashNumber(value) {
    let hash = 0;
    for (const char of String(value || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return hash;
  }
  function profileAccent(value, gender) {
    const base = gender === "female" ? 326 : 195;
    return "hsl(" + (base + (hashNumber(value) % 23) - 11) + " 92% 64%)";
  }
  function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units = [["year",31536000],["month",2592000],["week",604800],["day",86400],["hour",3600],["minute",60],["second",1]];
    const pair = units.find(([,size]) => Math.abs(seconds) >= size) || units[units.length - 1];
    return new Intl.RelativeTimeFormat(undefined,{numeric:"auto"}).format(Math.round(seconds / pair[1]),pair[0]);
  }
  function ensureFeedControls() {
    let controls = panel.querySelector(".sl-feed-sortbar");
    if (controls) return controls;
    controls = make("div", "sl-feed-sortbar");
    controls.innerHTML = '<span class="sl-feed-sort-label">Community feed</span><div role="group" aria-label="Sort posts"><button type="button" data-feed-sort="newest" aria-pressed="true">Newest</button><button type="button" data-feed-sort="popular" aria-pressed="false">Popular</button></div>';
    stream.before(controls);
    controls.querySelectorAll("[data-feed-sort]").forEach(button => button.addEventListener("click", () => {
      sortMode = button.dataset.feedSort;
      controls.querySelectorAll("[data-feed-sort]").forEach(item => {
        const active = item.dataset.feedSort === sortMode;
        item.classList.toggle("is-active",active);
        item.setAttribute("aria-pressed",String(active));
      });
      loadFeed();
    }));
    return controls;
  }
  function renderImagePreviews(files) {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = [];
    imagePreview.replaceChildren();
    for (const file of files.slice(0,MAX_IMAGES)) {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Selected image preview";
      imagePreview.append(img);
    }
    imagePreview.hidden = !files.length;
  }
  function validFiles(files) {
    if (files.length > MAX_IMAGES) throw new Error("You can attach up to 4 photos to one post.");
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Only JPEG, PNG and WebP images are allowed.");
      if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("Each photo must be 4 MB or smaller.");
    }
  }
  function fileExtension(file) {
    return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
  }
  async function signedImageUrl(client, path) {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }
  async function getPostRows(client, ownId) {
    const { data, error } = await client.from("studylab_social_posts")
      .select("id,author_id,author_display_name,author_username,body,status,created_at,studylab_social_post_images(id,bucket_path,mime_type,size_bytes)")
      .order("created_at", { ascending: false }).limit(40);
    if (error) throw error;
    return (data || []).filter(post => post.status === "approved" || post.author_id === ownId);
  }
  async function renderPost(client, post, currentUserId, likesByPost, profilesById, commentCountsByPost) {
    const card = make("article", "sl-feed-post");
    card.dataset.postId = post.id;
    card.dataset.authorId = post.author_id;
    card.dataset.authorUsername = post.author_username || "student";
    card.style.setProperty("--sl-post-accent", "hsl(" + (hashNumber(post.id) % 360) + " 82% 64%)");
    const profile = profilesById.get(post.author_id) || {};
    const gender = profile.gender === "female" ? "female" : "male";
    const top = make("div", "sl-feed-post-top");
    const identity = make("button", "sl-feed-post-identity sl-feed-profile-trigger");
    identity.type = "button";
    identity.setAttribute("aria-label", "View profile of " + (post.author_display_name || "Student"));
    const avatar = make("span", "sl-feed-avatar sl-feed-avatar-" + gender);
    avatar.style.setProperty("--sl-avatar-accent", profileAccent(post.author_id,gender));
    avatar.innerHTML = gender === "female"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"/><path d="M7 20l1-4.2a4.1 4.1 0 0 1 8 0l1 4.2z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"/><path d="M4.5 20v-2.5a7.5 7.5 0 0 1 15 0V20z"/></svg>';
    const identityCopy = make("span","sl-feed-profile-copy");
    const name = make("strong", "sl-feed-post-name", post.author_display_name || "Student");
    const username = make("span", "sl-feed-post-username", "@" + (post.author_username || "student"));
    identityCopy.append(name, username);
    identity.append(avatar,identityCopy);
    const date = make("time", "sl-feed-post-date", relativeTime(post.created_at));
    date.dateTime = post.created_at;
    date.title = new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(post.created_at));
    top.append(identity, date);
    card.append(top);
    identity.addEventListener("click",() => {
      const existing = card.querySelector(".sl-feed-profile-popover");
      if (existing) { existing.remove(); return; }
      panel.querySelectorAll(".sl-feed-profile-popover").forEach(item => item.remove());
      const popover = make("div","sl-feed-profile-popover");
      popover.append(make("strong","",post.author_display_name || "Student"));
      popover.append(make("span","", "@" + (post.author_username || "student")));
      const details = [];
      if (profile.study_stream) details.push(profile.study_stream);
      if (profile.exam_year) details.push("A/L " + profile.exam_year);
      popover.append(make("small","",details.join(" · ") || "StudyLab student"));
      card.append(popover);
    });

    if (post.status === "pending" && post.author_id === currentUserId) {
      card.append(make("span", "sl-feed-status-pending", "Pending review"));
    }
    if (post.body) card.append(make("p", "sl-feed-post-body", post.body));

    const imageRows = post.studylab_social_post_images || [];
    if (imageRows.length) {
      const gallery = make("div", "sl-feed-gallery");
      gallery.dataset.count = String(Math.min(imageRows.length, MAX_IMAGES));
      for (const imageRow of imageRows.slice(0, MAX_IMAGES)) {
        try {
          const url = await signedImageUrl(client, imageRow.bucket_path);
          const img = document.createElement("img");
          img.src = url;
          img.alt = "Photo shared in a StudyLab Social post";
          img.loading = "lazy";
          img.decoding = "async";
          gallery.append(img);
        } catch (error) {
          console.warn("Social image could not be loaded:", error);
        }
      }
      if (gallery.childElementCount) card.append(gallery);
    }

    const actions = make("div", "sl-feed-post-actions");
    if (post.status === "approved") {
      const postLikes = likesByPost.get(post.id) || [];
      const mine = postLikes.some(row => row.user_id === currentUserId);
      const count = postLikes.length;
      const like = make("button", "sl-feed-action", (mine ? "♥ Liked" : "♡ Like") + " · " + count);
      like.type = "button";
      like.setAttribute("aria-pressed", String(mine));
      like.addEventListener("click", async () => {
        like.disabled = true;
        try {
          if (mine) {
            const { error } = await client.from("studylab_social_likes").delete()
              .eq("post_id", post.id).eq("user_id", currentUserId);
            if (error) throw error;
          } else {
            const { error } = await client.from("studylab_social_likes")
              .insert({ post_id: post.id, user_id: currentUserId });
            if (error) throw error;
          }
          await loadFeed();
        } catch (error) {
          setStatus(error.message || "Could not update like.", true);
          like.disabled = false;
        }
      });
      const commentsButton = make("button", "sl-feed-action", "Comments · " + (commentCountsByPost.get(post.id) || 0));
      commentsButton.type = "button";
      commentsButton.addEventListener("click", () => toggleComments(card, post, client, currentUserId));
      actions.append(like, commentsButton);
    }
    card.append(actions);

    if (isAdmin && post.status === "pending") {
      const admin = make("div", "sl-feed-admin-actions");
      const approve = make("button", "sl-feed-admin-approve", "Approve post");
      const reject = make("button", "sl-feed-admin-reject", "Reject");
      approve.type = reject.type = "button";
      approve.addEventListener("click", () => moderate(client, "studylab_social_moderate_post", post.id, "approved"));
      reject.addEventListener("click", () => moderate(client, "studylab_social_moderate_post", post.id, "rejected"));
      admin.append(approve, reject);
      card.append(admin);
    }
    return card;
  }
  async function toggleComments(card, post, client, currentUserId) {
    let area = card.querySelector(".sl-feed-comments");
    if (area) { area.remove(); return; }
    area = make("section", "sl-feed-comments");
    area.append(make("p", "sl-feed-loading", "Loading comments…"));
    card.append(area);
    try {
      const { data, error } = await client.from("studylab_social_comments")
        .select("id,author_id,author_display_name,author_username,body,status,created_at")
        .eq("post_id", post.id).order("created_at", { ascending: true }).limit(50);
      if (error) throw error;
      area.replaceChildren();
      (data || []).forEach(comment => {
        const item = make("div", "sl-feed-comment");
        const header = make("div", "sl-feed-comment-head");
        header.append(make("strong", "", comment.author_display_name || "Student"));
        if (comment.status === "pending" && comment.author_id === currentUserId) {
          header.append(make("span", "sl-feed-status-pending", "Pending"));
        }
        item.append(header, make("p", "", comment.body));
        if (isAdmin && comment.status === "pending") {
          const controls = make("div", "sl-feed-admin-actions");
          const yes = make("button", "sl-feed-admin-approve", "Approve");
          const no = make("button", "sl-feed-admin-reject", "Reject");
          yes.type = no.type = "button";
          yes.addEventListener("click", () => moderate(client, "studylab_social_moderate_comment", comment.id, "approved"));
          no.addEventListener("click", () => moderate(client, "studylab_social_moderate_comment", comment.id, "rejected"));
          controls.append(yes, no);
          item.append(controls);
        }
        area.append(item);
      });
      if (!data?.length) area.append(make("p", "sl-feed-loading", "No comments yet."));
      const commentForm = document.createElement("form");
      commentForm.className = "sl-feed-comment-form";
      const field = document.createElement("input");
      field.type = "text";
      field.maxLength = 500;
      field.placeholder = "Write a comment…";
      field.setAttribute("aria-label", "Write a comment");
      const send = make("button", "sl-feed-action", "Send");
      send.type = "submit";
      commentForm.append(field, send);
      commentForm.addEventListener("submit", async event => {
        event.preventDefault();
        const body = field.value.trim();
        if (!body) return;
        send.disabled = true;
        try {
          const { data: newComment, error } = await client.from("studylab_social_comments")
            .insert({ post_id: post.id, author_id: currentUserId, body })
            .select("id").single();
          if (error) throw error;
          const moderation = await client.functions.invoke("studylab-social-moderate", {
            body: { content_type: "comment", content_id: newComment.id }
          });
          field.value = "";
          area.remove();
          await toggleComments(card, post, client, currentUserId);
          if (moderation.error) {
            setStatus("Comment submitted. It remains hidden until admin review.");
          } else if (moderation.data?.status === "approved") {
            setStatus("Comment approved by AI moderation.");
          } else {
            setStatus("Comment sent to the admin review queue.");
          }
        } catch (error) {
          setStatus(error.message || "Could not submit comment.", true);
          send.disabled = false;
        }
      });
      area.append(commentForm);
    } catch (error) {
      area.replaceChildren(make("p", "sl-feed-error", error.message || "Could not load comments."));
    }
  }
  async function moderate(client, rpc, id, decision) {
    try {
      const { data, error } = await client.rpc(rpc, {
        [rpc === "studylab_social_moderate_post" ? "p_post_id" : "p_comment_id"]: id,
        p_status: decision
      });
      if (error) throw error;
      if (!data) throw new Error("That item could not be updated.");
      setStatus("Moderation decision saved.");
      await loadFeed();
    } catch (error) {
      setStatus(error.message || "Moderation failed.", true);
    }
  }
  async function renderAdminQueue(client) {
    let queue = panel.querySelector(".sl-feed-admin-queue");
    if (!queue) {
      queue = make("section", "sl-feed-admin-queue");
      queue.innerHTML = '<div class="sl-feed-admin-heading"><strong>Moderation queue</strong><span>Admin</span></div><div class="sl-feed-admin-list"></div>';
      panel.querySelector(".sl-feed-head")?.after(queue);
    }
    const list = queue.querySelector(".sl-feed-admin-list");
    const [{ data: posts, error: postError }, { data: comments, error: commentError }] = await Promise.all([
      client.from("studylab_social_posts").select("id,author_display_name,author_username,body,created_at,studylab_social_post_images(bucket_path)").eq("status", "pending").order("created_at", { ascending: true }).limit(50),
      client.from("studylab_social_comments").select("id,post_id,author_display_name,body,created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(50)
    ]);
    if (postError) throw postError;
    if (commentError) throw commentError;
    list.replaceChildren();
    for (const post of posts || []) {
      const item = make("div", "sl-feed-admin-item");
      item.append(make("strong", "", "Post · " + (post.author_display_name || "Student")), make("p", "", post.body || "[Photo post]"));
      const imageRows = post.studylab_social_post_images || [];
      if (imageRows.length) {
        const preview = make("div", "sl-feed-gallery");
        preview.dataset.count = String(Math.min(imageRows.length, MAX_IMAGES));
        for (const imageRow of imageRows.slice(0, MAX_IMAGES)) {
          try {
            const url = await signedImageUrl(client, imageRow.bucket_path);
            const img = document.createElement("img");
            img.src = url;
            img.alt = "Photo awaiting moderation";
            img.loading = "lazy";
            preview.append(img);
          } catch (error) {
            console.warn("Pending Social image preview:", error);
          }
        }
        if (preview.childElementCount) item.append(preview);
      }
      const actions = make("div", "sl-feed-admin-actions");
      const yes = make("button", "sl-feed-admin-approve", "Approve");
      const no = make("button", "sl-feed-admin-reject", "Reject");
      yes.type = no.type = "button";
      yes.addEventListener("click", () => moderate(client, "studylab_social_moderate_post", post.id, "approved"));
      no.addEventListener("click", () => moderate(client, "studylab_social_moderate_post", post.id, "rejected"));
      actions.append(yes, no); item.append(actions); list.append(item);
    }
    for (const comment of comments || []) {
      const item = make("div", "sl-feed-admin-item");
      item.append(make("strong", "", "Comment · " + (comment.author_display_name || "Student")), make("p", "", comment.body));
      const actions = make("div", "sl-feed-admin-actions");
      const yes = make("button", "sl-feed-admin-approve", "Approve");
      const no = make("button", "sl-feed-admin-reject", "Reject");
      yes.type = no.type = "button";
      yes.addEventListener("click", () => moderate(client, "studylab_social_moderate_comment", comment.id, "approved"));
      no.addEventListener("click", () => moderate(client, "studylab_social_moderate_comment", comment.id, "rejected"));
      actions.append(yes, no); item.append(actions); list.append(item);
    }
    if (!list.childElementCount) list.append(make("p", "sl-feed-loading", "Nothing is waiting for review."));
  }
  async function loadFeed() {
    if (!feedHasLoaded) showSkeletons();
    try {
      const account = accountClient();
      await account.ready;
      let user = account.getUser();
      // Refresh once per page load so newly granted app_metadata admin privileges
      // appear without signing out and losing the anonymous student identity.
      if (!adminRefreshAttempted) {
        adminRefreshAttempted = true;
        const { data: refreshedSession, error: refreshError } = await account.client.auth.refreshSession();
        if (refreshError) console.warn("StudyLab admin session refresh:", refreshError);
        user = refreshedSession?.user || account.getUser();
      }
      if (!user?.id) throw new Error("Student account not ready.");
      isAdmin = user.app_metadata?.role === "admin";
      const heading = panel.querySelector(".sl-feed-heading");
      let adminBadge = panel.querySelector(".sl-feed-admin-mode");
      if (isAdmin && !adminBadge) {
        adminBadge = make("span", "sl-feed-admin-mode", "ADMIN");
        adminBadge.setAttribute("aria-label", "Administrator mode enabled");
        heading?.append(adminBadge);
      } else if (!isAdmin) {
        adminBadge?.remove();
      }
      const posts = await getPostRows(account.client, user.id);
      const approvedIds = posts.filter(post => post.status === "approved").map(post => post.id);
      const likesByPost = new Map();
      if (approvedIds.length) {
        const { data: likeRows, error: likesError } = await account.client.from("studylab_social_likes")
          .select("post_id,user_id").in("post_id", approvedIds);
        if (likesError) throw likesError;
        for (const row of likeRows || []) {
          if (!likesByPost.has(row.post_id)) likesByPost.set(row.post_id, []);
          likesByPost.get(row.post_id).push(row);
        }
      }
      const authorIds = [...new Set(posts.map(post => post.author_id).filter(Boolean))];
      const profilesById = new Map();
      if (authorIds.length) {
        try {
          const { data: profileRows, error: profileError } = await account.client.from("studylab_profiles")
            .select("id,gender,exam_year,study_stream").in("id",authorIds);
          if (profileError) throw profileError;
          for (const profile of profileRows || []) profilesById.set(profile.id,profile);
        } catch (profileError) {
          console.info("Social public profile details are unavailable:",profileError);
        }
      }
      const commentCountsByPost = new Map();
      if (approvedIds.length) {
        try {
          const { data: commentRows, error: commentsError } = await account.client.from("studylab_social_comments")
            .select("post_id").in("post_id",approvedIds).eq("status","approved");
          if (commentsError) throw commentsError;
          for (const row of commentRows || []) commentCountsByPost.set(row.post_id,(commentCountsByPost.get(row.post_id)||0)+1);
        } catch (commentsError) {
          console.info("Social comment counts are unavailable:",commentsError);
        }
      }
      if (sortMode === "popular") {
        posts.sort((a,b) => ((likesByPost.get(b.id)||[]).length - (likesByPost.get(a.id)||[]).length) ||
          (new Date(b.created_at)-new Date(a.created_at)));
      } else {
        posts.sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
      }
      ensureFeedControls();
      stream.replaceChildren();
      if (!posts.length) emptyState("No approved posts yet");
      for (const post of posts) {
        const card = await renderPost(account.client, post, user.id, likesByPost, profilesById, commentCountsByPost);
        stream.append(card);
      }
      if (isAdmin) await renderAdminQueue(account.client);
      else panel.querySelector(".sl-feed-admin-queue")?.remove();
      if (note) note.hidden = true;
      feedHasLoaded = true;
    } catch (error) {
      console.error("StudyLab Social:", error);
      emptyState("Social is temporarily unavailable");
      if (note) {
        note.hidden = false;
        note.textContent = error.message || "Could not connect to StudyLab Social. Please try again.";
      }
      feedHasLoaded = true;
    }
  }

  form.querySelector(".sl-feed-create-trigger")?.addEventListener("click",() => {
    textarea.focus();
    textarea.scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    try {
      const account = accountClient();
      await account.ready;
      const user = account.getUser();
      const profile = await account.getProfile(true);
      if (!user?.id) throw new Error("Student account not ready.");
      if (!profile?.display_name || /^Student\d{4}$/.test(profile.display_name) ||
          !profile?.username || !profile?.exam_year || !profile?.study_stream) {
        throw new Error("Complete your basic StudyLab profile before posting.");
      }
      const files = [...(input.files || [])];
      validFiles(files);
      const body = textarea.value.trim();
      if (!body && !files.length) throw new Error("Write something or attach a photo.");
      setBusy(true);
      setStatus("Submitting your post…");
      const { data: post, error: postError } = await account.client.from("studylab_social_posts")
        .insert({ author_id: user.id, body }).select("id").single();
      if (postError) throw postError;

      const uploaded = [];
      try {
        for (const file of files) {
          const path = user.id + "/" + post.id + "/" + crypto.randomUUID() + "." + fileExtension(file);
          const { error: uploadError } = await account.client.storage.from(BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
          if (uploadError) throw uploadError;
          uploaded.push(path);
          const { error: metaError } = await account.client.from("studylab_social_post_images").insert({
            post_id: post.id, author_id: user.id, bucket_path: path,
            mime_type: file.type, size_bytes: file.size
          });
          if (metaError) throw metaError;
        }
      } catch (uploadError) {
        if (uploaded.length) await account.client.storage.from(BUCKET).remove(uploaded).catch(() => {});
        try {
          await account.client.rpc("studylab_social_delete_own_pending_post", { p_post_id: post.id });
        } catch (cleanupError) {
          console.warn("Could not remove the failed pending Social post:",cleanupError);
        }
        throw uploadError;
      }
      const moderation = await account.client.functions.invoke("studylab-social-moderate", {
        body: { content_type: "post", content_id: post.id }
      });
      textarea.value = "";
      input.value = "";
      fileCount.textContent = "No photos selected";
      renderImagePreviews([]);
      if (moderation.error) {
        setStatus("Post submitted. It remains hidden until admin review.");
      } else if (moderation.data?.status === "approved") {
        setStatus("Your text post was approved by AI moderation.");
      } else if (moderation.data?.image_review_required) {
        setStatus("Post submitted. Photos require admin approval before appearing.");
      } else {
        setStatus("Post sent to the admin review queue.");
      }
      await loadFeed();
    } catch (error) {
      setStatus(error.message || "Could not submit your post.", true);
    } finally {
      setBusy(false);
    }
  });

  input.addEventListener("change", () => {
    try {
      validFiles([...(input.files || [])]);
      fileCount.textContent = input.files.length ? input.files.length + " photo(s) selected" : "No photos selected";
      renderImagePreviews([...(input.files || [])]);
      setStatus("");
    } catch (error) {
      input.value = "";
      fileCount.textContent = "No photos selected";
      renderImagePreviews([]);
      setStatus(error.message, true);
    }
  });

  document.addEventListener("click", event => {
    const toggle = event.target.closest(".sl-feed-toggle");
    if (toggle?.getAttribute("aria-expanded") === "true") loadFeed();
  });
  panel.querySelector("[data-feed-close]")?.addEventListener("click", () => {});
  window.addEventListener("focus", () => {
    if (document.visibilityState === "visible" && panel.getAttribute("aria-hidden") === "false") loadFeed();
  });
})();