/* Pointer-following ambient glow for StudyLab homepage and Live Study Room.
   Uses the existing card surfaces; no glass transforms, shadows or reflections are replaced. */
(() => {
  "use strict";

  const isRoom = document.body.classList.contains("study-room-page");
  const selector = isRoom
    ? ".room-hero, .room-panel, .room-stat, .room-person-card, .room-session, .slr-toolbar, .slr-focus-card, .slr-badge, .live-card"
    : ".subject-card, .study-tools-card, .telegram-card, .mcq-practice-card, .chemistry-resources-card";
  const glowClass = isRoom ? "room-pointer-glow" : "home-pointer-glow";
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let activeCard = null;
  let activeGlow = null;
  let idleTimer = 0;

  function hideActive() {
    window.clearTimeout(idleTimer);
    if (activeGlow) activeGlow.classList.remove("is-visible", "is-idle");
    activeCard = null;
    activeGlow = null;
  }

  function getGlow(card) {
    let glow = card.querySelector(":scope > ." + glowClass);
    if (!glow) {
      glow = document.createElement("span");
      glow.className = glowClass;
      glow.setAttribute("aria-hidden", "true");
      card.prepend(glow);
    }
    return glow;
  }

  document.addEventListener("pointermove", event => {
    if (!finePointer.matches || reducedMotion.matches || event.pointerType !== "mouse") {
      hideActive();
      return;
    }

    const card = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!card) {
      hideActive();
      return;
    }

    if (card !== activeCard) {
      if (activeGlow) activeGlow.classList.remove("is-visible", "is-idle");
      activeCard = card;
      activeGlow = getGlow(card);
    }

    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));

    activeGlow.style.setProperty("--home-glow-x", x + "%");
    activeGlow.style.setProperty("--home-glow-y", y + "%");
    activeGlow.style.setProperty("--room-glow-x", x + "%");
    activeGlow.style.setProperty("--room-glow-y", y + "%");
    activeGlow.classList.remove("is-idle");
    activeGlow.classList.add("is-visible");

    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (activeGlow) activeGlow.classList.add("is-idle");
    }, 1550);
  }, { passive: true });

  document.addEventListener("pointerout", event => {
    if (!activeCard || !(event.target instanceof Element) || !activeCard.contains(event.target)) return;
    if (event.relatedTarget instanceof Node && activeCard.contains(event.relatedTarget)) return;
    hideActive();
  }, { passive: true });

  window.addEventListener("blur", hideActive);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hideActive();
  });
})();
