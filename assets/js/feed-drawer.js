/* StudyLab Social floating panel. Feed data and moderation are provided by Supabase. */
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
          <div><h2 class="sl-feed-title">StudyLab Social</h2><p class="sl-feed-subtitle">Student community</p></div>
        </div>
        <div class="sl-feed-head-brand"><span class="sl-feed-mark" aria-hidden="true">✦</span><strong>StudyLab Social Network</strong></div>
        <div class="sl-feed-head-actions">
          <button class="sl-feed-refresh" type="button" aria-label="Refresh posts" title="Refresh posts">↻</button>
          <button class="sl-feed-close" type="button" data-feed-close aria-label="Close Social panel">×</button>
        </div>
      </div>
      <form class="sl-feed-compose" aria-label="Create a feed post">
        <textarea maxlength="2000" disabled placeholder="Share something with other students..." aria-label="Write a post"></textarea>
        <div class="sl-feed-compose-foot">
          <span class="sl-feed-image-note"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg> Photos · up to 4 MB each · max 4 photos</span>
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
      <p class="sl-feed-setup-note" role="status">Connecting to StudyLab Social…</p>
    </div>`;

  // Full-screen layout: wider composer left, natural-flow feed centre, community rail right.
  const feedInner = panel.querySelector(".sl-feed-inner");
  const feedHead = feedInner.querySelector(".sl-feed-head");
  const headBrand = feedHead.querySelector(".sl-feed-head-brand");
  const headActions = feedHead.querySelector(".sl-feed-head-actions");
  const composer = feedInner.querySelector(".sl-feed-compose");
  const feedStage = document.createElement("div");
  feedStage.className = "sl-feed-stage";
  const leftRail = document.createElement("aside");
  leftRail.className = "sl-feed-left-rail";
  leftRail.setAttribute("aria-label", "Create a post");
  const center = document.createElement("main");
  center.className = "sl-feed-center";
  const rightRail = document.createElement("aside");
  rightRail.className = "sl-feed-right-rail";
  rightRail.setAttribute("aria-label", "StudyLab Social community");
  const communityIntro = document.createElement("section");
  communityIntro.className = "sl-feed-community-intro";
  communityIntro.innerHTML = '<div class="sl-feed-community-cover"></div><div class="sl-feed-community-intro-copy"><span class="sl-feed-community-kicker">STUDYLAB COMMUNITY</span><h2>StudyLab Social</h2><p>A shared space for A/L students</p></div>';
  const membersCard = document.createElement("section");
  membersCard.className = "sl-feed-members-card";
  membersCard.innerHTML = '<div class="sl-feed-members-heading"><strong>Community profiles</strong><span>From recent posts</span></div><div class="sl-feed-member-list" aria-live="polite"><p class="sl-feed-members-empty">Student profiles will appear here as they post.</p></div>';
  feedInner.parentNode.replaceChild(feedStage, feedInner);
  feedInner.removeChild(feedHead);
  panel.insertBefore(feedHead, feedStage);
  leftRail.append(composer);
  center.append(feedInner);
  rightRail.append(membersCard);
  feedStage.append(leftRail, center, rightRail);

  const actions = header.querySelector(".header-actions");
  if (!actions) return;
  const toggle = document.createElement("button");
  toggle.className = "sl-feed-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", panel.id);
  toggle.setAttribute("aria-label", "Open StudyLab Social");
  toggle.title = "StudyLab Social";
  toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 13h5"/></svg><span>Social</span>';

  actions.insertBefore(toggle, actions.firstChild);

  // Add a second, labelled shortcut to the floating utility row.
  // The existing header Social icon remains in its original position and style.
  const floatingShortcut = document.createElement("button");
  floatingShortcut.className = "sl-feed-floating-shortcut";
  floatingShortcut.type = "button";
  floatingShortcut.setAttribute("aria-label", "Open StudyLab Social");
  floatingShortcut.title = "Social";
  floatingShortcut.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 13h5"/></svg><span>Social</span>';
  floatingShortcut.addEventListener("click", () => toggle.click());
  document.body.append(floatingShortcut);
  header.parentNode.insertBefore(layout, header);
  content.append(header, main);
  layout.append(content, panel);
  const backdrop = document.createElement("button");
  backdrop.className = "sl-feed-backdrop";
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Close Social panel");
  backdrop.hidden = true;
  layout.insertBefore(backdrop, panel);

  let previousFocus = null;
  panel.dataset.size = "full";
  panel.querySelector(".sl-feed-refresh")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("studylab-social-refresh"));
  });
  function closeFloatingTools() {
    ["[data-chat-close]", "[data-feedback-close]", "#studyQuickAccessPanel .study-quick-close", "#studyQuickAccessPanel [aria-label='Close Quick Access']"]
      .forEach(selector => {
        const close = document.querySelector(selector);
        if (close && close.offsetParent !== null) close.click();
      });
  }

  function setOpen(open) {
    if (open) {
      closeFloatingTools();
      panel.dataset.size = "full";
    }
    layout.classList.toggle("is-feed-open", open);
    document.body.classList.toggle("sl-community-open", open);
    backdrop.hidden = !open;
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
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", event => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== "Tab" || !isOpen) return;
    const focusable = [...panel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(element => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) {
      event.preventDefault();
      panel.querySelector("[data-feed-close]")?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener("resize", () => {
    document.body.classList.toggle("sl-community-open", toggle.getAttribute("aria-expanded") === "true");
  });
})();
