/* StudyLab Social feed client.
   Uses the existing anonymous Supabase account; all user content is rendered as text.
   Posts/comments remain pending until an app_metadata admin approves them. */
(function () {
  "use strict";
  if (window.__studyLabSocialLoaded) return;
  window.__studyLabSocialLoaded = true;

  const BUCKET = "studylab-social";
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const MAX_IMAGES = 3;
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
    <textarea maxlength="2000" placeholder="Share something with other students..." aria-label="Write a post"></textarea>
    <div class="sl-feed-file-row">
      <label class="sl-feed-file-button">
        <input class="sl-feed-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple>
        <span aria-hidden="true">＋</span> Add photos
      </label>
      <span class="sl-feed-file-count">No photos selected</span>
    </div>
    <div class="sl-feed-compose-foot">
      <span class="sl-feed-image-note">JPEG, PNG or WebP · up to 5 MB each · max 3 photos</span>
      <button class="sl-feed-post-button" type="submit">Post</button>
    </div>
    <p class="sl-feed-compose-status" role="status" aria-live="polite"></p>`;
  textarea = form.querySelector("textarea");
  postButton = form.querySelector(".sl-feed-post-button");
  const input = form.querySelector(".sl-feed-file-input");
  const fileCount = form.querySelector(".sl-feed-file-count");
  const status = form.querySelector(".sl-feed-compose-status");
  let busy = false;
  let isAdmin = false;
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
    const heading = make("h3", "", message);
    const detail = make("p", "", "Approved posts from StudyLab students will appear here.");
    box.append(heading, detail);
    stream.append(box);
  }
  function validFiles(files) {
    if (files.length > MAX_IMAGES) throw new Error("You can attach up to 3 photos to one post.");
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Only JPEG, PNG and WebP images are allowed.");
      if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("Each photo must be 5 MB or smaller.");
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
  function timeLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  async function renderPost(client, post, currentUserId, likesByPost) {
    const card = make("article", "sl-feed-post");
    card.dataset.postId = post.id;
    const top = make("div", "sl-feed-post-top");
    const identity = make("div", "sl-feed-post-identity");
    const name = make("strong", "sl-feed-post-name", post.author_display_name || "Student");
    const username = make("span", "sl-feed-post-username", "@" + (post.author_username || "student"));
    identity.append(name, username);
    const date = make("time", "sl-feed-post-date", timeLabel(post.created_at));
    date.dateTime = post.created_at;
    top.append(identity, date);
    card.append(top);

    if (post.status === "pending" && post.author_id === currentUserId) {
      card.append(make("span", "sl-feed-status-pending", "Pending review"));
    }
    if (post.body) card.append(make("p", "sl-feed-post-body", post.body));

    const imageRows = post.studylab_social_post_images || [];
    if (imageRows.length) {
      const gallery = make("div", "sl-feed-gallery");
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
      const commentsButton = make("button", "sl-feed-action", "Comments");
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
          const { error } = await client.from("studylab_social_comments")
            .insert({ post_id: post.id, author_id: currentUserId, body });
          if (error) throw error;
          field.value = "";
          await toggleComments(card, post, client, currentUserId);
          setStatus("Comment submitted for review.");
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
    try {
      const account = accountClient();
      await account.ready;
      const user = account.getUser();
      if (!user?.id) throw new Error("Student account not ready.");
      isAdmin = user.app_metadata?.role === "admin";
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
      stream.replaceChildren();
      if (!posts.length) emptyState("No posts yet");
      for (const post of posts) {
        const card = await renderPost(account.client, post, user.id, likesByPost);
        stream.append(card);
      }
      if (isAdmin) await renderAdminQueue(account.client);
      else panel.querySelector(".sl-feed-admin-queue")?.remove();
      if (note) note.hidden = true;
    } catch (error) {
      console.error("StudyLab Social:", error);
      emptyState("Social is temporarily unavailable");
      if (note) {
        note.hidden = false;
        note.textContent = error.message || "Could not connect to StudyLab Social. Please try again.";
      }
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    try {
      const account = accountClient();
      await account.ready;
      const user = account.getUser();
      const profile = await account.getProfile(true);
      if (!user?.id) throw new Error("Student account not ready.");
      if (!profile?.profile_completed_at || !profile?.display_name || !profile?.username ||
          !profile?.school || !profile?.phone || !profile?.gender) {
        throw new Error("Complete your StudyLab profile before posting.");
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
        await account.client.rpc("studylab_social_delete_own_pending_post", { p_post_id: post.id }).catch(() => {});
        throw uploadError;
      }
      textarea.value = "";
      input.value = "";
      fileCount.textContent = "No photos selected";
      setStatus("Post submitted. It will appear after moderation approval.");
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
      setStatus("");
    } catch (error) {
      input.value = "";
      fileCount.textContent = "No photos selected";
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