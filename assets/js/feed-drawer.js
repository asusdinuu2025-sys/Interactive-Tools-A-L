/* StudyLab integrated homepage Community column.
   Posting stays disabled until the isolated feed database, storage and moderation
   setup is installed. This keeps the preview safe and avoids fake/demo posts. */
(function () {
  "use strict";
  if (window.__studyLabFeedDrawerLoaded) return;
  window.__studyLabFeedDrawerLoaded = true;

  const header = document.querySelector(".site-header");
  const main = document.querySelector("main.container");
  if (!header || !main) return;

  const layout = document.createElement("div");
  layout.className = "sl-home-layout";
  layout.id = "studyLabHomeLayout";

  const content = document.createElement("div");
  content.className = "sl-home-content";

  const panel = document.createElement("aside");
  panel.className = "sl-feed-panel";
  panel.id = "studyLabFeedPanel";
  panel.setAttribute("aria-label", "StudyLab Social");
  panel.setAttribute("aria-hidden", "true");
  panel.inert = true;
  panel.innerHTML = `
    <div class="sl-feed-inner">
      <div class="sl-feed-head">
        <div class="sl-feed-heading">
          <span class="sl-feed-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 13h5"/></svg>
          </span>
          <div><h2 class="sl-feed-title">StudyLab Social</h2><p class="sl-feed-subtitle">A shared space for A/L students</p></div>
        </div>
        <button class="sl-feed-close" type="button" data-feed-close aria-label="Close Social panel">×</button>
      </div>
      <form class="sl-feed-compose" aria-label="Create a feed post">
        <textarea maxlength="2000" disabled placeholder="Share something with other students..." aria-label="Write a post"></textarea>
        <div class="sl-feed-compose-foot">
          <span class="sl-feed-image-note"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg> Photos · up to 5 MB each</span>
          <button class="sl-feed-post-button" type="button" disabled>Post</button>
        </div>
      </form>
      <div class="sl-feed-stream" role="feed" aria-label="Recent Social posts">
        <div class="sl-feed-empty">
          <span class="sl-feed-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 13h5"/></svg></span>
          <h3>Your student social space starts here</h3>
          <p>Posts from StudyLab students will appear here, newest first.</p>
        </div>
      </div>
      <p class="sl-feed-setup-note" role="status">Social posting and photo uploads are being prepared. Publishing will open after security and moderation checks are in place.</p>
    </div>`;

  const actions = header.querySelector(".header-actions");
  if (!actions) return;
  const toggle = document.createElement("button");
  toggle.className = "sl-feed-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", panel.id);
  toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 13h5"/></svg><span>Social</span>';

  actions.insertBefore(toggle, actions.firstChild);
  header.parentNode.insertBefore(layout, header);
  content.append(header, main);
  layout.append(content, panel);

  let previousFocus = null;
  function closeFloatingTools() {
    ["[data-chat-close]", "[data-feedback-close]", "#studyQuickAccessPanel .study-quick-close", "#studyQuickAccessPanel [aria-label='Close Quick Access']"]
      .forEach(selector => {
        const close = document.querySelector(selector);
        if (close && close.offsetParent !== null) close.click();
      });
  }

  function setOpen(open) {
    if (open) closeFloatingTools();
    layout.classList.toggle("is-feed-open", open);
    document.body.classList.toggle("sl-community-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
    panel.inert = !open;
    if (open) {
      previousFocus = document.activeElement;
      window.setTimeout(() => panel.querySelector("[data-feed-close]")?.focus(), 80);
    } else {
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      toggle.focus({ preventScroll: true });
    }
  }
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  panel.querySelector("[data-feed-close]").addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setOpen(false);
  });
  window.addEventListener("resize", () => {
    document.body.classList.toggle("sl-community-open", toggle.getAttribute("aria-expanded") === "true");
  });
})();
