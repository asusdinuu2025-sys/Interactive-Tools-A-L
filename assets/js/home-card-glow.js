/* Subtle pointer-following ambient glow for StudyLab glass cards.
   It wakes quickly on movement and slowly fades after the pointer rests. */
(() => {
  "use strict";

  const isRoom = document.body.classList.contains("study-room-page");
  const selector = isRoom
    ? ".room-hero, .room-panel, .room-stat, .room-person-card, .room-session, .room-goal, .slr-toolbar, .slr-focus-card, .slr-badge, .live-card"
    : ".subject-card, .study-tools-card, .telegram-card, .mcq-practice-card, .chemistry-resources-card";
  const glowClass = isRoom ? "room-pointer-glow" : "home-pointer-glow";
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let activeCard = null;
  let activeGlow = null;
  let idleTimer = 0;
  let leaveTimer = 0;

  function clearTimers() {
    window.clearTimeout(idleTimer);
    window.clearTimeout(leaveTimer);
    idleTimer = 0;
    leaveTimer = 0;
  }

  function fadeCard(card, glow, clearActive) {
    if (!glow) return;
    glow.classList.add("is-idle");
    const timeout = window.setTimeout(() => {
      glow.classList.remove("is-visible", "is-idle");
      if (clearActive && activeCard === card && activeGlow === glow) {
        activeCard = null;
        activeGlow = null;
      }
    }, 1080);
    return timeout;
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

  function onPointerMove(event) {
    if (event.pointerType !== "mouse" || !finePointer.matches || reducedMotion.matches) {
      if (activeCard && activeGlow) {
        clearTimers();
        const oldCard = activeCard, oldGlow = activeGlow;
        activeCard = null;
        activeGlow = null;
        fadeCard(oldCard, oldGlow, false);
      }
      return;
    }

    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const card = hit instanceof Element ? hit.closest(selector) : null;
    if (!card) {
      if (activeCard && activeGlow) {
        clearTimers();
        const oldCard = activeCard, oldGlow = activeGlow;
        activeCard = null;
        activeGlow = null;
        leaveTimer = fadeCard(oldCard, oldGlow, false);
      }
      return;
    }

    if (card !== activeCard) {
      clearTimers();
      if (activeGlow) {
        const previousCard = activeCard, previousGlow = activeGlow;
        fadeCard(previousCard, previousGlow, false);
      }
      activeCard = card;
      activeGlow = getGlow(card);
    }

    clearTimers();
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    activeGlow.style.setProperty("--pointer-glow-x", x + "%");
    activeGlow.style.setProperty("--pointer-glow-y", y + "%");
    activeGlow.style.setProperty("--home-glow-x", x + "%");
    activeGlow.style.setProperty("--home-glow-y", y + "%");
    activeGlow.classList.remove("is-idle");
    activeGlow.classList.add("is-visible");

    idleTimer = window.setTimeout(() => {
      activeGlow?.classList.add("is-idle");
    }, 1550);
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });

  document.addEventListener("pointerout", event => {
    if (!activeCard || !(event.target instanceof Element) || !activeCard.contains(event.target)) return;
    if (event.relatedTarget instanceof Node && activeCard.contains(event.relatedTarget)) return;
    clearTimers();
    const oldCard = activeCard, oldGlow = activeGlow;
    activeCard = null;
    activeGlow = null;
    leaveTimer = fadeCard(oldCard, oldGlow, false);
  }, { passive: true });

  window.addEventListener("blur", () => {
    clearTimers();
    if (!activeCard || !activeGlow) return;
    const oldCard = activeCard, oldGlow = activeGlow;
    activeCard = null;
    activeGlow = null;
    fadeCard(oldCard, oldGlow, false);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || !activeCard || !activeGlow) return;
    clearTimers();
    const oldCard = activeCard, oldGlow = activeGlow;
    activeCard = null;
    activeGlow = null;
    fadeCard(oldCard, oldGlow, false);
  });
})();
