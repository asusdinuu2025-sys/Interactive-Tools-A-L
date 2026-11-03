/* StudyLab Social feed client.
   Uses the existing anonymous Supabase account; all user content is rendered as text.
   Posts and comments publish immediately; owners and admins control deletion. */
(function () {
  "use strict";
  if (window.__studyLabSocialLoaded) return;
  window.__studyLabSocialLoaded = true;

  const BUCKET = "studylab-social";
  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
  const MAX_IMAGES = 4;
  const MAX_POST_WORDS = 1000;
  const MAX_POST_CHARS = 15000;
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
    <button class="sl-feed-create-trigger" type="button" aria-label="Click here to bigger view">
      <span aria-hidden="true">✎</span><span>Click here to bigger view</span>
    </button>
    <div class="sl-feed-compose-expanded-head">
      <strong>Create a post</strong>
      <button class="sl-feed-compose-collapse" type="button" aria-label="Close expanded composer">×</button>
    </div>
    <div class="sl-feed-format-toolbar" role="toolbar" aria-label="Text formatting">
      <button type="button" data-format="bold" title="Bold" aria-label="Bold"><strong>B</strong></button>
      <button type="button" data-format="italic" title="Italic" aria-label="Italic"><em>I</em></button>
      <button type="button" data-format="underline" title="Underline" aria-label="Underline"><u>U</u></button>
      <button type="button" data-format="strike" title="Strikethrough" aria-label="Strikethrough"><s>S</s></button>
      <span class="sl-feed-format-divider" aria-hidden="true"></span>
      <button type="button" data-format="link" title="Insert link" aria-label="Insert link">↗</button>
    </div>
    <div class="sl-feed-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Write something with other students…" aria-label="Write a post"></div>
    <div class="sl-feed-file-row">
      <label class="sl-feed-file-button">
        <input class="sl-feed-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple>
        <span aria-hidden="true">＋</span> Add photos
      </label>
      <span class="sl-feed-file-count">No photos selected</span>
    </div>
    <div class="sl-feed-compose-foot">
      <span class="sl-feed-image-note">JPEG, PNG or WebP · up to 4 MB each · max 4 photos</span>
      <span class="sl-feed-word-count" aria-live="polite">0 / 1,000 words</span>
      <button class="sl-feed-post-button" type="submit">Post</button>
    </div>
    <div class="sl-feed-image-preview" aria-label="Selected photo previews"></div>
    <p class="sl-feed-compose-status" role="status" aria-live="polite"></p>`;
  textarea = form.querySelector(".sl-feed-editor");
  postButton = form.querySelector(".sl-feed-post-button");
  const editor = textarea;
  Object.defineProperty(editor, "value", {
    configurable: true,
    get() { return serializeEditor(editor); },
    set(value) { editor.innerHTML = renderFormattedText(String(value || "")); }
  });
  Object.defineProperty(editor, "disabled", {
    configurable: true,
    get() { return editor.getAttribute("contenteditable") === "false"; },
    set(value) { editor.setAttribute("contenteditable", value ? "false" : "true"); }
  });
  const input = form.querySelector(".sl-feed-file-input");
  const fileCount = form.querySelector(".sl-feed-file-count");
  const status = form.querySelector(".sl-feed-compose-status");
  const wordCount = form.querySelector(".sl-feed-word-count");
  const imagePreview = form.querySelector(".sl-feed-image-preview");
  const collapseComposer = form.querySelector(".sl-feed-compose-collapse");
  const formatToolbar = form.querySelector(".sl-feed-format-toolbar");
  const phoneFeedMedia = window.matchMedia("(max-width: 600px)");
  const createTrigger = form.querySelector(".sl-feed-create-trigger");
  const createTriggerLabel = createTrigger?.querySelector("span:last-child");
  function syncPhoneComposerLabel() {
    const phoneLabel = "Click here to Upload / Create posts";
    if (createTriggerLabel) createTriggerLabel.textContent = phoneFeedMedia.matches ? phoneLabel : "Click here to bigger view";
    createTrigger?.setAttribute("aria-label", phoneFeedMedia.matches ? phoneLabel : "Click here to bigger view");
  }
  syncPhoneComposerLabel();
  phoneFeedMedia.addEventListener?.("change", syncPhoneComposerLabel);
  let previewUrls = [];

  function setComposerExpanded(expanded) {
    form.classList.toggle("is-expanded", expanded);
    form.setAttribute("aria-label", expanded ? "Expanded post composer" : "Create a feed post");
    if (expanded) {
      panel.classList.remove("is-feed-scrolled");
      textarea.focus({ preventScroll: true });
    }
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[char]);
  }
  function renderFormattedText(value) {
    let safe = escapeHTML(value || "");
    safe = safe.replace(/\[([^\]]{1,200})\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    safe = safe.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    safe = safe.replace(/\[u\]([^\n]+?)\[\/u\]/g, "<u>$1</u>");
    safe = safe.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
    return safe.replace(/\n/g, "<br>");
  }
  function serializeEditor(root) {
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const tag = node.tagName.toLowerCase();
      const inner = [...node.childNodes].map(visit).join("");
      if (tag === "br") return "\n";
      if (tag === "strong" || tag === "b") return "**" + inner + "**";
      if (tag === "em" || tag === "i") return "*" + inner + "*";
      if (tag === "u") return "[u]" + inner + "[/u]";
      if (tag === "s" || tag === "strike" || tag === "del") return "~~" + inner + "~~";
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        if (/^https?:\/\//i.test(href)) return "[" + inner + "](" + href + ")";
        return inner;
      }
      if (tag === "div" || tag === "p") return inner + "\n";
      return inner;
    }
    return [...root.childNodes].map(visit).join("").replace(/\n+$/,"").replace(/\u00a0/g," ");
  }
  function selectionCharacterOffset(root) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !root.contains(selection.anchorNode)) return null;
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(root);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  }
  function restoreCharacterOffset(root, offset) {
    if (offset == null) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node, remaining = offset, last = null;
    while ((node = walker.nextNode())) {
      last = node;
      const length = node.nodeValue.length;
      if (remaining <= length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= length;
    }
    if (last) {
      const range = document.createRange();
      range.setStart(last, last.nodeValue.length);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  function normalizeDetectedUrl(value) {
    const clean = String(value || "").trim().replace(/[),.!?;:]+$/, "");
    if (!clean) return null;
    const candidate = /^https?:\/\//i.test(clean) ? clean : "https://" + clean;
    try {
      const url = new URL(candidate);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }
  function linkifyEditor() {
    const caret = selectionCharacterOffset(editor);

    // Browsers can place the character typed immediately after an auto-link
    // in a sibling text node instead of keeping it inside the anchor.
    // Reattach the contiguous token before refreshing the link destination.
    editor.querySelectorAll('a[data-auto-link="true"]').forEach(anchor => {
      const next = anchor.nextSibling;
      if (next && next.nodeType === Node.TEXT_NODE && next.nodeValue && !/^\s/.test(next.nodeValue)) {
        const continuation = next.nodeValue.match(/^\S+/)?.[0] || "";
        if (continuation) {
          anchor.append(document.createTextNode(continuation));
          next.nodeValue = next.nodeValue.slice(continuation.length);
          if (!next.nodeValue) next.remove();
        }
      }
    });

    editor.querySelectorAll('a[data-auto-link="true"]').forEach(anchor => {
      // A space typed after a URL can remain inside the contenteditable link.
      // Split it out immediately so the next word is not accidentally linked.
      const original = anchor.textContent || "";
      const token = original.match(/^\S+/)?.[0] || "";
      const cleanToken = token.replace(/[),.!?;:]+$/, "");
      const suffix = token.slice(cleanToken.length) + original.slice(token.length);
      const destination = normalizeDetectedUrl(cleanToken);
      if (destination) {
        anchor.textContent = cleanToken;
        anchor.setAttribute("href", destination);
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        if (suffix) anchor.after(document.createTextNode(suffix));
      } else {
        anchor.replaceWith(document.createTextNode(original));
      }
    });
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest("a") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    // Supports explicit URLs, www links, and ordinary domains such as studylablk.netlify.app.
    const urlPattern = /https?:\/\/[^\s<>]+|www\.[^\s<>]+|(?<![@\w.-])(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>]*)?/gi;
    for (const node of nodes) {
      const value = node.nodeValue || "";
      const matches = [...value.matchAll(urlPattern)];
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const match of matches) {
        let raw = match[0];
        let trailing = "";
        while (/[),.!?;:]$/.test(raw)) {
          trailing = raw.slice(-1) + trailing;
          raw = raw.slice(0, -1);
        }
        const destination = normalizeDetectedUrl(raw);
        if (!destination) continue;
        fragment.append(document.createTextNode(value.slice(cursor, match.index)));
        const anchor = document.createElement("a");
        anchor.setAttribute("href", destination);
        anchor.textContent = raw;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.dataset.autoLink = "true";
        fragment.append(anchor);
        if (trailing) fragment.append(document.createTextNode(trailing));
        cursor = match.index + match[0].length;
      }
      if (cursor) {
        fragment.append(document.createTextNode(value.slice(cursor)));
        node.replaceWith(fragment);
      }
    }
    restoreCharacterOffset(editor, caret);
  }
  function countPostWords(value) {
    const words = String(value || "").trim().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu);
    return words ? words.length : 0;
  }
  function updateWordCount() {
    const count = countPostWords(editor.textContent);
    wordCount.textContent = count.toLocaleString() + " / 1,000 words";
    wordCount.classList.toggle("is-over-limit", count > MAX_POST_WORDS);
  }
  updateWordCount();
  formatToolbar.addEventListener("mousedown", event => event.preventDefault());
  formatToolbar.addEventListener("click", event => {
    const button = event.target.closest("[data-format]");
    if (!button || busy) return;
    const format = button.dataset.format;
    editor.focus();
    if (format === "link") {
      const selected = window.getSelection()?.toString() || "";
      const rawUrl = window.prompt("Paste a link (https://…)");
      if (!rawUrl) return;
      let url;
      try { url = new URL(rawUrl.trim()); } catch (_) { setStatus("Enter a valid https:// or http:// link.", true); return; }
      if (!["https:", "http:"].includes(url.protocol)) { setStatus("Only http:// and https:// links are supported.", true); return; }
      if (!selected) document.execCommand("insertText", false, url.href);
      else document.execCommand("createLink", false, url.href);
      linkifyEditor();
      return;
    }
    const commands = { bold:"bold", italic:"italic", underline:"underline", strike:"strikeThrough" };
    if (commands[format]) document.execCommand(commands[format], false, null);
    editor.focus();
  });
  editor.addEventListener("input", () => {
    linkifyEditor();
    updateWordCount();
    if (editor.textContent.length > MAX_POST_CHARS) {
      setStatus("Posts are limited to 15,000 characters and 1,000 words.", true);
    } else if (countPostWords(editor.textContent) > MAX_POST_WORDS) {
      setStatus("Your post is over the 1,000-word limit.", true);
    } else {
      setStatus("");
    }
  });
  editor.addEventListener("paste", event => {
    event.preventDefault();
    const plain = (event.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, plain);
  });
  editor.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && ["b","i","u"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      document.execCommand(({b:"bold",i:"italic",u:"underline"})[event.key.toLowerCase()], false, null);
    }
  });
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
    status.replaceChildren();
    status.dataset.state = error ? "error" : "info";
    status.hidden = !message;
    if (!message) return;
    if (!error && busy) {
      const spinner = make("span", "sl-feed-upload-spinner");
      spinner.setAttribute("aria-hidden", "true");
      status.append(spinner);
    }
    status.append(document.createTextNode(message));
  }

  async function requireBasicProfile() {
    const account = accountClient();
    await account.ready;
    const user = account.getUser();
    if (!user?.id) {
      const message = "Create your basic StudyLab profile before posting.";
      showPostGateToast(message);
      throw new Error(message);
    }
    const profile = await account.getProfile(true);
    if (!profile?.display_name || /^Student\\d{4}$/.test(profile.display_name) ||
        !profile?.username || !profile?.exam_year || !profile?.study_stream) {
      const message = "Complete your basic StudyLab profile before posting.";
      showPostGateToast(message);
      throw new Error(message);
    }
    return user;
  }

  function showPostGateToast(message) {
    const toastId = "studyLabSocialGateToast";
    document.getElementById(toastId)?.remove();
    const styleId = "studyLabSocialGateToastStyle";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        #studyLabSocialGateToast {
          position:fixed; z-index:1300; top:auto; right:18px; bottom:max(18px,env(safe-area-inset-bottom));
          width:max-content; max-width:min(92vw,430px); padding:13px 17px;
          border:1px solid rgba(91,205,255,.34); border-radius:14px;
          background:rgba(15,28,46,.97); color:#f3f8ff;
          box-shadow:0 14px 38px rgba(0,0,0,.3),0 0 18px rgba(65,180,255,.12);
          font:650 14px/1.45 system-ui,sans-serif; text-align:left;
          opacity:0; transform:translateY(18px); pointer-events:none;
          transition:transform .42s cubic-bezier(.2,.8,.2,1),opacity .28s ease;
        }
        #studyLabSocialGateToast.is-visible { opacity:1; transform:translateY(0); }
        #studyLabSocialGateToast.is-leaving { opacity:0; transform:translateY(18px); }
        html[data-theme="light"] #studyLabSocialGateToast {
          background:rgba(255,255,255,.98); color:#17243a; border-color:rgba(55,155,205,.3);
          box-shadow:0 14px 38px rgba(35,70,105,.18);
        }
        @media(prefers-reduced-motion:reduce) { #studyLabSocialGateToast { transition:none; } }
      `;
      document.head.appendChild(style);
    }
    const toast = document.createElement("div");
    toast.id = toastId;
    toast.setAttribute("role","alert");
    toast.setAttribute("aria-live","assertive");
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(),450);
    },2200);
  }
  function setBusy(value) {
    busy = value;
    postButton.disabled = value;
    postButton.replaceChildren();
    if (value) {
      const spinner = make("span", "sl-feed-upload-spinner");
      spinner.setAttribute("aria-hidden", "true");
      postButton.append(spinner, document.createTextNode("Posting…"));
    } else {
      postButton.textContent = "Post";
      status.querySelector(".sl-feed-upload-spinner")?.remove();
    }
    textarea.disabled = value;
    input.disabled = value;
  }
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function setButtonBusy(button, label) {
    const original = button.textContent;
    button.disabled = true;
    button.classList.add("is-action-pending");
    button.replaceChildren(make("span", "sl-feed-action-spinner"));
    button.append(document.createTextNode(label));
    return () => {
      button.disabled = false;
      button.classList.remove("is-action-pending");
      button.textContent = original;
    };
  }
  function adjustCommentCount(card, delta) {
    const counter = card.querySelector("[data-comment-count]");
    if (!counter) return;
    const count = Math.max(0, Number(counter.dataset.commentCount || 0) + delta);
    counter.dataset.commentCount = String(count);
    counter.textContent = "Comments · " + count;
  }
  function animateOut(node, className) {
    if (!node?.isConnected) return Promise.resolve();
    node.classList.add(className);
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        node.removeEventListener("animationend", finish);
        node.remove();
        resolve();
      };
      node.addEventListener("animationend", finish, { once: true });
      window.setTimeout(finish, 360);
    });
  }
  function emptyState(message) {
    stream.replaceChildren();
    const box = make("div", "sl-feed-empty");
    const icon = make("span", "sl-feed-empty-icon");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg viewBox="0 0 64 64"><path d="m5 23 27-12 27 12-27 12L5 23Z"/><path d="M16 28v13c9 8 23 8 32 0V28M58 24v17"/><path d="M55 44h6"/></svg>';
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
    files.slice(0,MAX_IMAGES).forEach((file, index) => {
      const item = make("div", "sl-feed-image-preview-item");
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Selected image preview";
      const remove = make("button", "sl-feed-image-remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove selected photo " + (index + 1));
      remove.title = "Remove photo";
      remove.addEventListener("click", () => {
        const transfer = new DataTransfer();
        [...(input.files || [])].forEach((selected, selectedIndex) => {
          if (selectedIndex !== index) transfer.items.add(selected);
        });
        input.files = transfer.files;
        const remaining = [...input.files];
        fileCount.textContent = remaining.length ? remaining.length + " photo(s) selected" : "No photos selected";
        renderImagePreviews(remaining);
      });
      item.append(img, remove);
      imagePreview.append(item);
    });
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
  async function getSignedImageUrls(client, posts) {
    const paths = [...new Set(posts.flatMap(post =>
      (post.studylab_social_post_images || []).slice(0, MAX_IMAGES)
        .map(image => image.bucket_path).filter(Boolean)
    ))];
    if (!paths.length) return new Map();
    const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (error) {
      console.warn("Social image URLs could not be prepared:", error);
      return new Map();
    }
    const urls = new Map();
    for (const item of data || []) {
      if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
    }
    return urls;
  }
  async function getPostRows(client, ownId) {
    const { data, error } = await client.from("studylab_social_posts")
      .select("id,author_id,author_display_name,author_username,author_gender,body,status,created_at,studylab_social_post_images(id,bucket_path,mime_type,size_bytes)")
      .order("created_at", { ascending: false }).limit(40);
    if (error) throw error;
    return (data || []).filter(post => post.status === "approved");
  }
  function renderPost(client, post, currentUserId, likesByPost, commentCountsByPost, signedImageUrls) {
    const card = make("article", "sl-feed-post");
    card.dataset.postId = post.id;
    card.dataset.authorId = post.author_id;
    card.dataset.currentUserId = currentUserId;
    card.dataset.authorUsername = post.author_username || "student";
    card.style.setProperty("--sl-post-accent", "hsl(" + (hashNumber(post.id) % 360) + " 82% 64%)");
    const gender = post.author_gender === "female" ? "female" : post.author_gender === "male" ? "male" : "neutral";
    const top = make("div", "sl-feed-post-top");
    const identity = make("button", "sl-feed-post-identity sl-feed-profile-trigger");
    identity.type = "button";
    identity.setAttribute("aria-label", "View profile of " + (post.author_display_name || "Student"));
    const avatar = make("span", "sl-feed-avatar sl-feed-avatar-" + gender);
    avatar.style.setProperty("--sl-avatar-accent", profileAccent(post.author_id,gender));
    avatar.innerHTML = gender === "female"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"/><path d="M7 20l1-4.2a4.1 4.1 0 0 1 8 0l1 4.2z"/></svg>'
      : gender === "male"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"/><path d="M4.5 20v-2.5a7.5 7.5 0 0 1 15 0V20z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.1"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
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
      popover.append(make("small","","StudyLab student"));
      card.append(popover);
    });

    if (post.body) {
      const body = make("p", "sl-feed-post-body");
      body.innerHTML = renderFormattedText(post.body);
      card.append(body);
      if (post.body.length > 260) {
        body.classList.add("is-collapsed");
        const readMore = make("button", "sl-feed-read-more", "Read more");
        readMore.type = "button";
        readMore.setAttribute("aria-expanded", "false");
        readMore.addEventListener("click", () => {
          const expanded = body.classList.toggle("is-expanded");
          body.classList.toggle("is-collapsed", !expanded);
          readMore.textContent = expanded ? "Show less" : "Read more";
          readMore.setAttribute("aria-expanded", String(expanded));
        });
        card.append(readMore);
      }
    }

    const imageRows = post.studylab_social_post_images || [];
    if (imageRows.length) {
      const galleryWrap = make("div", "sl-feed-gallery-wrap");
      const gallery = make("div", "sl-feed-gallery");
      gallery.dataset.count = String(Math.min(imageRows.length, MAX_IMAGES));
      galleryWrap.dataset.count = String(Math.min(imageRows.length, MAX_IMAGES));
      for (const imageRow of imageRows.slice(0, MAX_IMAGES)) {
        const url = signedImageUrls.get(imageRow.bucket_path);
        if (!url) continue;
        const img = document.createElement("img");
        img.alt = "Photo shared in a StudyLab Social post";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
        img.addEventListener("error", () => img.classList.add("is-error"), { once: true });
        img.src = url;
        if (img.complete && img.naturalWidth) img.classList.add("is-loaded");
        gallery.append(img);
      }
      gallery.dataset.count = String(gallery.childElementCount);
      galleryWrap.dataset.count = String(gallery.childElementCount);
      if (gallery.childElementCount > 1) {
        const previous = make("button", "sl-feed-gallery-arrow sl-feed-gallery-prev", "‹");
        previous.type = "button";
        previous.setAttribute("aria-label", "Previous photo");
        const next = make("button", "sl-feed-gallery-arrow sl-feed-gallery-next", "›");
        next.type = "button";
        next.setAttribute("aria-label", "Next photo");
        const dots = make("div", "sl-feed-gallery-dots");
        dots.setAttribute("role", "group");
        dots.setAttribute("aria-label", "Choose a photo");
        const dotButtons = [];
        for (let index = 0; index < gallery.childElementCount; index++) {
          const dot = make("button", "sl-feed-gallery-dot");
          dot.type = "button";
          dot.setAttribute("aria-label", "Show photo " + (index + 1));
          dot.addEventListener("click", () => {
            const target = gallery.children[index];
            gallery.scrollTo({ left: target.offsetLeft - gallery.offsetLeft, behavior: "smooth" });
          });
          dots.append(dot);
          dotButtons.push(dot);
        }
        const updateGalleryControls = () => {
          const current = [...gallery.children].reduce((best, image, index) => {
            const distance = Math.abs((image.offsetLeft - gallery.offsetLeft) - gallery.scrollLeft);
            return distance < best.distance ? { index, distance } : best;
          }, { index: 0, distance: Infinity }).index;
          dotButtons.forEach((dot, index) => {
            dot.classList.toggle("is-active", index === current);
            dot.setAttribute("aria-current", index === current ? "true" : "false");
          });
          previous.disabled = current === 0;
          next.disabled = current === gallery.childElementCount - 1;
        };
        previous.addEventListener("click", () => {
          const current = dotButtons.findIndex(dot => dot.classList.contains("is-active"));
          const target = gallery.children[Math.max(0, current - 1)];
          if (target) gallery.scrollTo({ left: target.offsetLeft - gallery.offsetLeft, behavior: "smooth" });
        });
        next.addEventListener("click", () => {
          const current = dotButtons.findIndex(dot => dot.classList.contains("is-active"));
          const target = gallery.children[Math.min(gallery.childElementCount - 1, current + 1)];
          if (target) gallery.scrollTo({ left: target.offsetLeft - gallery.offsetLeft, behavior: "smooth" });
        });
        gallery.addEventListener("scroll", updateGalleryControls, { passive: true });
        galleryWrap.append(previous, gallery, next, dots);
        requestAnimationFrame(updateGalleryControls);
      } else {
        galleryWrap.append(gallery);
      }
      if (gallery.childElementCount) card.append(galleryWrap);
    }

    const actions = make("div", "sl-feed-post-actions");
    if (post.status === "approved") {
      const postLikes = likesByPost.get(post.id) || [];
      const mine = postLikes.some(row => row.user_id === currentUserId);
      const likeState = { liked: mine, count: postLikes.length, button: null };
      const like = make("button", "sl-feed-action", (likeState.liked ? "♥ Liked" : "♡ Like") + " · " + likeState.count);
      likeState.button = like;
      card._slSocialLikeState = likeState;
      like.type = "button";
      like.setAttribute("aria-pressed", String(likeState.liked));
      like.addEventListener("click", async () => {
        if (like.disabled) return;
        const restore = setButtonBusy(like, "Updating…");
        try {
          if (likeState.liked) {
            const { error } = await client.from("studylab_social_likes").delete()
              .eq("post_id", post.id).eq("user_id", currentUserId);
            if (error) throw error;
          } else {
            const { error } = await client.from("studylab_social_likes")
              .insert({ post_id: post.id, user_id: currentUserId });
            if (error) throw error;
          }
          likeState.liked = !likeState.liked;
          likeState.count = Math.max(0, likeState.count + (likeState.liked ? 1 : -1));
          restore();
          like.textContent = (likeState.liked ? "♥ Liked" : "♡ Like") + " · " + likeState.count;
          like.setAttribute("aria-pressed", String(likeState.liked));
          like.classList.toggle("is-liked", likeState.liked);
        } catch (error) {
          restore();
          setStatus(error.message || "Could not update like.", true);
        }
      });
      const commentsButton = make("button", "sl-feed-action", "Comments · " + (commentCountsByPost.get(post.id) || 0));
      commentsButton.type = "button";
      commentsButton.dataset.commentCount = String(commentCountsByPost.get(post.id) || 0);
      commentsButton.addEventListener("click", () => toggleComments(card, post, client, currentUserId));
      actions.append(like, commentsButton);
    }
    if (post.author_id === currentUserId || isAdmin) {
      const deletingAnotherStudentPost = post.author_id !== currentUserId;
      const removePost = make("button", "sl-feed-action sl-feed-delete-post", "Delete post");
      removePost.type = "button";
      removePost.addEventListener("click", async () => {
        const confirmation = deletingAnotherStudentPost
          ? "As an admin, permanently delete this student's post? This cannot be undone."
          : "Delete this post permanently? This cannot be undone.";
        if (!window.confirm(confirmation)) return;
        removePost.disabled = true;
        try {
          let deletion = client.from("studylab_social_posts").delete().eq("id", post.id);
          if (!isAdmin) deletion = deletion.eq("author_id", currentUserId);
          const { data: deleted, error } = await deletion.select("id").maybeSingle();
          if (error) throw error;
          if (!deleted) throw new Error("This post could not be deleted. Check your permissions and try again.");
          const imagePaths = imageRows.map(row => row.bucket_path).filter(Boolean);
          let cleanupWarning = false;
          if (imagePaths.length) {
            const { error: storageError } = await client.storage.from(BUCKET).remove(imagePaths);
            if (storageError) {
              console.warn("Deleted Social post but could not clean up every image:", storageError);
              cleanupWarning = true;
            }
          }
          setStatus(cleanupWarning ? "Post deleted. Some image storage may need cleanup." :
            (deletingAnotherStudentPost ? "Student post deleted." : "Your post was deleted."));
          await animateOut(card, "is-removing");
          if (!stream.querySelector(".sl-feed-post")) emptyState("No posts yet");
        } catch (error) {
          setStatus(error.message || "Could not delete this post.", true);
          removePost.disabled = false;
        }
      });
      actions.append(removePost);
    }
    card.append(actions);

    return card;
  }
  function syncPostCardState(card, post, likesByPost, commentCountsByPost) {
    const likeState = card._slSocialLikeState;
    if (likeState) {
      const rows = likesByPost.get(post.id) || [];
      likeState.liked = rows.some(row => row.user_id === card.dataset.currentUserId);
      likeState.count = rows.length;
      likeState.button.textContent = (likeState.liked ? "♥ Liked" : "♡ Like") + " · " + likeState.count;
      likeState.button.setAttribute("aria-pressed", String(likeState.liked));
      likeState.button.classList.toggle("is-liked", likeState.liked);
    }
    const commentButton = card.querySelector("[data-comment-count]");
    if (commentButton) {
      const count = commentCountsByPost.get(post.id) || 0;
      commentButton.dataset.commentCount = String(count);
      commentButton.textContent = "Comments · " + count;
    }
  }
  async function toggleComments(card, post, client, currentUserId) {
    let area = card.querySelector(".sl-feed-comments");
    if (area) { area.remove(); return; }
    area = make("section", "sl-feed-comments");
    area.append(make("p", "sl-feed-loading", "Loading comments…"));
    card.append(area);
    try {
      const { data, error } = await client.from("studylab_social_comments")
        .select("id,author_id,author_display_name,author_username,author_gender,body,status,created_at")
        .eq("post_id", post.id).eq("status", "approved").order("created_at", { ascending: true }).limit(50);
      if (error) throw error;
      area.replaceChildren();
      (data || []).forEach(comment => {
        const item = make("div", "sl-feed-comment is-entering");
        const header = make("div", "sl-feed-comment-head");
        const commentGender = comment.author_gender === "female" ? "female" : comment.author_gender === "male" ? "male" : "neutral";
        const commentAvatar = make("span","sl-feed-avatar sl-feed-comment-avatar sl-feed-avatar-" + commentGender);
        const commentName = String(comment.author_display_name || "Student").trim();
        commentAvatar.textContent = Array.from(commentName)[0]?.toLocaleUpperCase() || "S";
        commentAvatar.setAttribute("aria-label", (comment.author_display_name || "Student") + " profile");
        header.append(commentAvatar,make("strong", "", comment.author_display_name || "Student"));
        item.append(header, make("p", "", comment.body));
        if (comment.author_id === currentUserId || isAdmin) {
          const commentMenu = document.createElement("details");
          commentMenu.className = "sl-feed-comment-menu";
          commentMenu.setAttribute("name", "sl-social-comment-menu");
          const menuToggle = document.createElement("summary");
          menuToggle.className = "sl-feed-comment-menu-toggle";
          menuToggle.setAttribute("aria-label", "Comment options");
          menuToggle.setAttribute("title", "Comment options");
          menuToggle.textContent = "⋯";
          const menuPanel = make("div", "sl-feed-comment-menu-panel");
          const removeComment = make("button", "sl-feed-comment-menu-delete sl-feed-delete-comment", "Delete");
          removeComment.type = "button";
          removeComment.addEventListener("click", async () => {
            if (!window.confirm("Delete this comment permanently? This cannot be undone.")) return;
            commentMenu.open = false;
            const restore = setButtonBusy(removeComment, "Deleting…");
            item.classList.add("is-action-pending");
            try {
              let deletion = client.from("studylab_social_comments").delete().eq("id", comment.id);
              if (!isAdmin) deletion = deletion.eq("author_id", currentUserId);
              const { data: deleted, error: deleteError } = await deletion.select("id").maybeSingle();
              if (deleteError) throw deleteError;
              if (!deleted) throw new Error("This comment could not be deleted. Check your permissions.");
              setStatus("Comment deleted.");
              adjustCommentCount(card, -1);
              await animateOut(item, "is-removing");
              if (!area.querySelector(".sl-feed-comment")) {
                const empty = make("p", "sl-feed-loading", "No comments yet.");
                area.insertBefore(empty, area.querySelector(".sl-feed-comment-form"));
              }
            } catch (deleteError) {
              restore();
              item.classList.remove("is-action-pending");
              setStatus(deleteError.message || "Could not delete comment.", true);
            }
          });
          menuPanel.append(removeComment);
          commentMenu.append(menuToggle, menuPanel);
          header.append(commentMenu);
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
        const restore = setButtonBusy(send, "Sending…");
        field.disabled = true;
        try {
          const commenter = await requireBasicProfile();
          const { error } = await client.from("studylab_social_comments")
            .insert({ post_id: post.id, author_id: commenter.id, body });
          if (error) throw error;
          adjustCommentCount(card, 1);
          field.value = "";
          area.remove();
          await toggleComments(card, post, client, currentUserId);
          setStatus("Comment published.");
        } catch (error) {
          restore();
          field.disabled = false;
          setStatus(error.message || "Could not submit comment.", true);
        }
      });
      area.append(commentForm);
    } catch (error) {
      area.replaceChildren(make("p", "sl-feed-error", error.message || "Could not load comments."));
    }
  }
  function renderCommunityProfiles(posts) {
    const list = panel.querySelector(".sl-feed-member-list");
    if (!list) return;
    const faces = [":)", ";D", ":D", "☺", "✦", "★", "☀", "♡", "⚡", "🌈", "✨", "☻"];
    const unique = new Map();
    for (const post of posts) {
      if (post.status !== "approved" || !post.author_id || unique.has(post.author_id)) continue;
      unique.set(post.author_id, post);
    }
    const members = [...unique.values()].slice(0, 10);
    list.replaceChildren();
    if (!members.length) {
      list.append(make("p", "sl-feed-members-empty", "Student profiles will appear here as they post."));
      return;
    }
    for (const member of members) {
      const row = make("div", "sl-feed-member");
      const avatar = make("span", "sl-feed-member-avatar", faces[hashNumber(member.author_id) % faces.length]);
      avatar.style.setProperty("--sl-member-hue", String(hashNumber(member.author_id + "profile") % 360));
      const copy = make("span", "sl-feed-member-copy");
      copy.append(make("strong", "", member.author_display_name || "Student"));
      copy.append(make("small", "", "@" + (member.author_username || "student")));
      row.append(avatar, copy);
      list.append(row);
    }
  }
  let feedLoadCount = 0;
  let lastFeedLoadedAt = 0;
  async function loadFeed() {
    if (feedLoadCount > 0) return;
    feedLoadCount++;
    const refreshButton = panel.querySelector(".sl-feed-refresh");
    refreshButton?.classList.add("is-refreshing");
    refreshButton?.setAttribute("aria-busy", "true");
    stream.classList.add("is-loading");
    stream.setAttribute("aria-busy", "true");
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
      renderCommunityProfiles(posts);
      const approvedIds = posts.filter(post => post.status === "approved").map(post => post.id);
      const likesByPost = new Map();
      const commentCountsByPost = new Map();
      // Start image signing alongside engagement queries instead of waiting
      // for one network stage to finish before starting the next.
      const signedImageUrlsPromise = getSignedImageUrls(account.client, posts);
      if (approvedIds.length) {
        const [likesResult, commentsResult] = await Promise.all([
          account.client.from("studylab_social_likes")
            .select("post_id,user_id").in("post_id", approvedIds),
          account.client.from("studylab_social_comments")
            .select("post_id").in("post_id", approvedIds).eq("status", "approved")
        ]);
        if (likesResult.error) throw likesResult.error;
        for (const row of likesResult.data || []) {
          if (!likesByPost.has(row.post_id)) likesByPost.set(row.post_id, []);
          likesByPost.get(row.post_id).push(row);
        }
        if (commentsResult.error) {
          console.info("Social comment counts are unavailable:", commentsResult.error);
        } else {
          for (const row of commentsResult.data || []) {
            commentCountsByPost.set(row.post_id, (commentCountsByPost.get(row.post_id) || 0) + 1);
          }
        }
      }
      const signedImageUrls = await signedImageUrlsPromise;
      if (sortMode === "popular") {
        posts.sort((a,b) => ((likesByPost.get(b.id)||[]).length - (likesByPost.get(a.id)||[]).length) ||
          (new Date(b.created_at)-new Date(a.created_at)));
      } else {
        posts.sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
      }
      ensureFeedControls();
      if (!posts.length) {
        emptyState("No posts yet");
      } else {
        const existingCards = new Map(
          [...stream.querySelectorAll(".sl-feed-post[data-post-id]")]
            .map(card => [card.dataset.postId, card])
        );
        const orderedCards = posts.map(post => {
          let card = existingCards.get(post.id);
          if (card) {
            existingCards.delete(post.id);
            syncPostCardState(card, post, likesByPost, commentCountsByPost);
          } else {
            card = renderPost(account.client, post, user.id, likesByPost, commentCountsByPost, signedImageUrls);
            // Animate only genuinely new cards, never the existing feed on refresh.
            if (feedHasLoaded) card.classList.add("is-entering");
          }
          return card;
        });
        // Reconcile by post ID. Existing nodes, open comment threads, image state,
        // focus and scroll position stay mounted across refreshes.
        let cursor = stream.firstElementChild;
        for (const card of orderedCards) {
          if (card !== cursor) stream.insertBefore(card, cursor);
          cursor = card.nextElementSibling;
        }
        const keep = new Set(orderedCards);
        [...stream.children].forEach(child => {
          if (!keep.has(child)) child.remove();
        });
      }
      panel.querySelector(".sl-feed-admin-queue")?.remove();
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
      lastFeedLoadedAt = Date.now();
    } finally {
      feedLoadCount = Math.max(0, feedLoadCount - 1);
      if (feedLoadCount === 0) {
        stream.classList.remove("is-loading");
        stream.removeAttribute("aria-busy");
        refreshButton?.classList.remove("is-refreshing");
        refreshButton?.removeAttribute("aria-busy");
      }
    }
  }

  let previousFeedScrollTop = stream.scrollTop;
  stream.addEventListener("scroll", () => {
    const currentFeedScrollTop = stream.scrollTop;
    // Phones keep the compact Upload/Create trigger visible while the feed scrolls.
    // The full composer still opens only when the trigger is tapped.
    if (phoneFeedMedia.matches || panel.dataset.size !== "full" || form.contains(document.activeElement)) {
      panel.classList.remove("is-feed-scrolled");
      previousFeedScrollTop = currentFeedScrollTop;
      return;
    }
    if (currentFeedScrollTop <= 4 || currentFeedScrollTop < previousFeedScrollTop - 2) {
      panel.classList.remove("is-feed-scrolled");
    } else if (currentFeedScrollTop > previousFeedScrollTop + 2) {
      panel.classList.add("is-feed-scrolled");
    }
    previousFeedScrollTop = currentFeedScrollTop;
  }, { passive: true });
  phoneFeedMedia.addEventListener?.("change", event => {
    if (!event.matches) panel.classList.remove("is-feed-scrolled");
    previousFeedScrollTop = stream.scrollTop;
  });

  form.querySelector(".sl-feed-create-trigger")?.addEventListener("click",() => setComposerExpanded(true));
  collapseComposer?.addEventListener("click",() => setComposerExpanded(false));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    try {
      const account = accountClient();
      const user = await requireBasicProfile();
      const files = [...(input.files || [])];
      validFiles(files);
      const body = textarea.value.trim();
      const words = countPostWords(editor.textContent);
      if (words > MAX_POST_WORDS) throw new Error("Your post is over the 1,000-word limit.");
      if (body.length > MAX_POST_CHARS) throw new Error("Your formatted post is too long. Keep it under 15,000 characters.");
      if (!body && !files.length) throw new Error("Write something or attach a photo.");
      setBusy(true);
      setStatus(files.length ? "Preparing your post…" : "Publishing your post…");
      const { data: post, error: postError } = await account.client.from("studylab_social_posts")
        .insert({ author_id: user.id, body }).select("id").single();
      if (postError) throw postError;

      const uploaded = [];
      try {
        for (const [fileIndex, file] of files.entries()) {
          setStatus("Uploading photo " + (fileIndex + 1) + " of " + files.length + "…");
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
          await account.client.from("studylab_social_posts").delete().eq("id", post.id).eq("author_id", user.id);
        } catch (cleanupError) {
          console.warn("Could not remove the failed Social post:",cleanupError);
        }
        throw uploadError;
      }
      setStatus("Publishing your post…");
      const { data: published, error: publishError } = await account.client.rpc(
        "studylab_social_publish_own_post",
        { p_post_id: post.id }
      );
      if (publishError || !published) {
        if (uploaded.length) {
          const { error: cleanupStorageError } = await account.client.storage.from(BUCKET).remove(uploaded);
          if (cleanupStorageError) console.warn("Could not clean up an unpublished Social upload:", cleanupStorageError);
        }
        const { error: cleanupPostError } = await account.client.from("studylab_social_posts")
          .delete().eq("id", post.id).eq("author_id", user.id);
        if (cleanupPostError) console.warn("Could not remove an unpublished Social post:", cleanupPostError);
        throw publishError || new Error("Your post could not be published. Please try again.");
      }
      textarea.value = "";
      updateWordCount();
      setComposerExpanded(false);
      input.value = "";
      fileCount.textContent = "No photos selected";
      renderImagePreviews([]);
      setStatus(files.length ? "Your photo post is live." : "Your post is live.");
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
    // Load once on first open. Reopening the panel must not rebuild or refetch
    // a feed that is already in memory; the refresh button remains explicit.
    if (toggle?.getAttribute("aria-expanded") === "true" && !feedHasLoaded) loadFeed();
  });
  window.addEventListener("studylab-social-refresh", () => loadFeed());
  panel.querySelector("[data-feed-close]")?.addEventListener("click", () => {});
})();