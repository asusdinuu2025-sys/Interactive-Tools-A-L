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
          <div><h2 class="sl-feed-title">StudyLab Social</h2><p class="sl-feed-subtitle">A shared space for A/L students</p></div>
        </div>
        <div class="sl-feed-size-controls" role="group" aria-label="Social panel size">
          <button type="button" data-feed-size="half" aria-label="Expand Social to half screen" title="Half screen">½</button>
          <button type="button" data-feed-size="full" aria-label="Open Social fullscreen" title="Fullscreen">⛶</button>
        </div>
        <button class="sl-feed-close" type="button" data-feed-close aria-label="Close Social panel">×</button>
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

  // Full-screen mode uses a centered reading column with reserved ad placements.
  const feedInner = panel.querySelector(".sl-feed-inner");
  const feedStage = document.createElement("div");
  feedStage.className = "sl-feed-stage";
  const feedCenter = document.createElement("div");
  feedCenter.className = "sl-feed-center";
  const makeAdSlot = side => {
    const slot = document.createElement("aside");
    slot.className = "sl-feed-ad-rail sl-feed-ad-rail-" + side;
    slot.setAttribute("aria-label", "Reserved banner advertisement space");
    slot.innerHTML = '<div class="sl-feed-ad-placeholder"><span>ADVERTISEMENT</span><strong>Reserved space</strong><small>Banner placement</small></div>';
    return slot;
  };
  feedInner.parentNode.replaceChild(feedStage,feedInner);
  feedCenter.append(feedInner);
  feedStage.append(makeAdSlot("left"),feedCenter,makeAdSlot("right"));

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
  const backdrop = document.createElement("button");
  backdrop.className = "sl-feed-backdrop";
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Close Social panel");
  backdrop.hidden = true;
  layout.insertBefore(backdrop, panel);

  let previousFocus = null;
  function setSize(size) {
    panel.dataset.size = size;
    panel.querySelectorAll("[data-feed-size]").forEach(button => {
      const active = button.dataset.feedSize === size;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  panel.querySelectorAll("[data-feed-size]").forEach(button => {
    button.addEventListener("click", () => setSize(button.dataset.feedSize));
  });
  setSize("compact");
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
