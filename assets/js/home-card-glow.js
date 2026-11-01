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
  }

  function fadeCurrentCard(quickly) {
    clearTimers();
    if (activeGlow) {
      activeGlow.classList.add("is-idle");
      if (quickly) {
        leaveTimer = window.setTimeout(() => {
          activeGlow?.classList.remove("is-visible", "is-idle");
          activeCard = null;
          activeGlow = null;
        }, 320);
      }
    } else {
      activeCard = null;
    }
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
      fadeCurrentCard(true);
      return;
    }

    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const card = hit instanceof Element ? hit.closest(selector) : null;
    if (!card) {
      if (activeCard) fadeCurrentCard(true);
      return;
    }

    if (card !== activeCard) {
      fadeCurrentCard(true);
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
    fadeCurrentCard(true);
  }, { passive: true });

  window.addEventListener("blur", () => fadeCurrentCard(true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) fadeCurrentCard(true);
  });
})();
