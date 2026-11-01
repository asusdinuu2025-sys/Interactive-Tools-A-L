/* Subtle pointer-following glow for homepage cards only. */
(() => {
  "use strict";
  const selector = ".subject-card, .study-tools-card, .telegram-card, .mcq-practice-card, .chemistry-resources-card";
  let activeCard = null;
  let activeGlow = null;

  function hideGlow() {
    if (activeGlow) activeGlow.classList.remove("is-visible");
    activeCard = null;
    activeGlow = null;
  }

  document.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hideGlow();
      return;
    }

    const card = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!card) {
      hideGlow();
      return;
    }

    if (card !== activeCard) {
      hideGlow();
      activeCard = card;
      activeGlow = card.querySelector(":scope > .home-pointer-glow");
      if (!activeGlow) {
        activeGlow = document.createElement("span");
        activeGlow.className = "home-pointer-glow";
        activeGlow.setAttribute("aria-hidden", "true");
        card.prepend(activeGlow);
      }
    }

    const rect = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    activeGlow.style.setProperty("--home-glow-x", x + "%");
    activeGlow.style.setProperty("--home-glow-y", y + "%");
    activeGlow.classList.add("is-visible");
  }, { passive: true });

  document.addEventListener("pointerout", event => {
    if (activeCard && event.target instanceof Element &&
        activeCard.contains(event.target) &&
        (!event.relatedTarget || !activeCard.contains(event.relatedTarget))) {
      hideGlow();
    }
  }, { passive: true });

  window.addEventListener("blur", hideGlow);
})();
