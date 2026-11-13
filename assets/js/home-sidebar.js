/* StudyLab Home sidebar: fixed glass navigation with click + scroll tracking. */
(function () {
  "use strict";
  if (window.__studyLabHomeSidebarLoaded) return;
  window.__studyLabHomeSidebarLoaded = true;

  const layout = document.getElementById("studyLabHomeLayout");
  const content = layout?.querySelector(".sl-home-content");
  const main = content?.querySelector("main.container");
  if (!layout || !content || !main) return;

  const sidebar = document.createElement("aside");
  sidebar.className = "sl-home-sidebar";
  sidebar.setAttribute("aria-label", "StudyLab home navigation");
  sidebar.innerHTML = `
    <div class="sl-home-sidebar-head">
      <span class="sl-home-sidebar-brand-mark" aria-label="StudyLab"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3.5 3 8.5 3 12 0v-5M22 9v6"/></svg></span>
      <button class="sl-home-sidebar-collapse" type="button" aria-label="Collapse navigation" aria-expanded="true" title="Collapse navigation">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>
      </button>
    </div>
    <nav class="sl-home-sidebar-nav" aria-label="Home sections">
      <span class="sl-home-nav-indicator" aria-hidden="true"></span>
      <a class="sl-home-nav-item is-active" href="#home-top" data-nav-id="home" aria-current="location" title="Home">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/></svg></span><span class="sl-home-nav-label">Home</span>
      </a>
      <a class="sl-home-nav-item" href="#practical-simulations" data-nav-id="practical-simulations" title="Practical Simulations">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M8 15h8M10 12h4"/></svg></span><span class="sl-home-nav-label">Practical Simulations</span>
      </a>
      <a class="sl-home-nav-item" href="study-room.html?completeProfile=1&amp;returnTo=%2Fstudy-room.html" data-nav-id="live-study-room" title="Live Study Room">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="8" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2.5 19v-1.5A4.5 4.5 0 0 1 7 13h2a4.5 4.5 0 0 1 4.5 4.5V19M13 13.5a4.5 4.5 0 0 1 8.5 2V19"/></svg></span><span class="sl-home-nav-label">Live Study Room</span>
      </a>
      <button class="sl-home-nav-item" type="button" data-nav-id="social" title="Social" aria-label="Open StudyLab Social">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 13h5"/></svg></span><span class="sl-home-nav-label">Social</span>
      </button>
      <a class="sl-home-nav-item" href="#past-papers" data-nav-id="past-papers" title="Past Papers">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 12h7M9 16h7"/></svg></span><span class="sl-home-nav-label">Past Papers</span>
      </a>
      <a class="sl-home-nav-item" href="Telegram_Channels.html" data-nav-id="telegram-links" title="A/L Telegram Channel Links">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m21 3-7.2 18-3.7-7.1L3 10.2 21 3Z"/><path d="m10.1 13.9 4.6-4.6"/></svg></span><span class="sl-home-nav-label">A/L Telegram Channel Links</span>
      </a>
      <a class="sl-home-nav-item" href="#other-al-resources" data-nav-id="other-al-resources" title="Other A/L Resources">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h6l2 2h8v12H4z"/><path d="M4 9h16"/></svg></span><span class="sl-home-nav-label">Other A/L Resources</span>
      </a>
      <a class="sl-home-nav-item" href="#free-lesson-packs" data-nav-id="free-lesson-packs" title="Free Lesson Packs">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22z"/><path d="M4 5.5v16.5M8 6h8M8 10h8"/></svg></span><span class="sl-home-nav-label">Free Lesson Packs</span>
      </a>
      <a class="sl-home-nav-item" href="#productivity" data-nav-id="productivity" title="Productivity">
        <span class="sl-home-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8.5"/><path d="M12 8v5l3 2M9 2h6M19 5l1.5-1.5"/></svg></span><span class="sl-home-nav-label">Productivity</span>
      </a>
    </nav>
    <div class="sl-home-sidebar-hint">Navigate your A/L workspace</div>
    <div class="sl-home-quick-actions" aria-label="StudyLab quick tools"></div>`;

  layout.insertBefore(sidebar, content);
  const quickActions = sidebar.querySelector(".sl-home-quick-actions");
  const dockItems = [document.getElementById("studylabPetLauncher"), document.querySelector(".studylab-ai-tools-row [data-ai-launcher]"), document.querySelector("[data-study-chat] [data-chat-button]")].filter(Boolean);
  const dockPlaceholders = dockItems.map(element => {
    const marker = document.createComment("StudyLab quick action position");
    element.parentNode.insertBefore(marker, element);
    return { element, marker };
  });
  const desktopDock = window.matchMedia("(min-width: 1180px)");
  function syncQuickActionDock() {
    dockPlaceholders.forEach(({ element, marker }) => {
      if (desktopDock.matches) quickActions.appendChild(element);
      else if (marker.parentNode) marker.parentNode.insertBefore(element, marker);
    });
  }
  syncQuickActionDock();
  desktopDock.addEventListener?.("change", syncQuickActionDock);
  const nav = sidebar.querySelector(".sl-home-sidebar-nav");
  const indicator = sidebar.querySelector(".sl-home-nav-indicator");
  const collapseButton = sidebar.querySelector(".sl-home-sidebar-collapse");
  const navItems = [...sidebar.querySelectorAll(".sl-home-nav-item")];
  const scrollTargets = [
    ["practical-simulations", "practical-simulations"],
    ["other-al-resources", "other-al-resources"],
    ["past-papers", "past-papers"],
    ["free-lesson-packs", "free-lesson-packs"],
    ["productivity", "productivity"],
    ["telegram-links", "telegram-links"]
  ].map(([navId, targetId]) => ({
    navId,
    element: document.getElementById(targetId)
  })).filter(item => item.element);

  let activeId = "home";
  let scrollFrame = 0;

  function setActive(id) {
    const item = navItems.find(element => element.dataset.navId === id);
    if (!item) return;
    activeId = id;
    navItems.forEach(element => {
      const active = element === item;
      element.classList.toggle("is-active", active);
      if (active) element.setAttribute("aria-current", "location");
      else element.removeAttribute("aria-current");
    });
    indicator.style.opacity = "1";
    indicator.style.height = item.offsetHeight + "px";
    indicator.style.transform = "translate3d(0," + item.offsetTop + "px,0)";
    if (item.offsetTop < nav.scrollTop || item.offsetTop + item.offsetHeight > nav.scrollTop + nav.clientHeight) {
      const targetTop = Math.max(0, item.offsetTop - nav.offsetTop - (nav.clientHeight - item.offsetHeight) / 2);
      nav.scrollTo({ top: targetTop, behavior: "smooth" });
    }
  }

  function syncFromScroll() {
    scrollFrame = 0;
    if (document.body.classList.contains("sl-community-open")) {
      setActive("social");
      return;
    }
    const markerLine = Math.min(window.innerHeight * 0.36, 300);
    let current = null;
    scrollTargets.forEach(target => {
      if (target.element.getBoundingClientRect().top <= markerLine) current = target;
    });
    setActive(current ? current.navId : "home");
  }

  function scheduleScrollSync() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(syncFromScroll);
  }

  navItems.forEach(item => {
    item.addEventListener("click", event => {
      const id = item.dataset.navId;
      setActive(id);
      if (id === "social") {
        event.preventDefault();
        document.querySelector(".sl-feed-toggle")?.click();
      }
    });
  });

  collapseButton.addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("is-collapsed");
    collapseButton.setAttribute("aria-expanded", String(!collapsed));
    collapseButton.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
    collapseButton.title = collapsed ? "Expand navigation" : "Collapse navigation";
    collapseButton.innerHTML = collapsed
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>';
  });

  const socialToggle = document.querySelector(".sl-feed-toggle");
  if (socialToggle) {
    const socialObserver = new MutationObserver(() => {
      if (socialToggle.getAttribute("aria-expanded") === "true") setActive("social");
      else scheduleScrollSync();
    });
    socialObserver.observe(socialToggle, { attributes: true, attributeFilter: ["aria-expanded"] });
  }

  window.addEventListener("scroll", scheduleScrollSync, { passive: true });
  window.addEventListener("resize", scheduleScrollSync);
  requestAnimationFrame(() => {
    setActive(activeId);
    scheduleScrollSync();
  });
})();