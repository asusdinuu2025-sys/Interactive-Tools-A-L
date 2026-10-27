/* Unifies access to the existing StudyLab Pet and AI panels. */
(function () {
  "use strict";
  function init() {
    const tray = document.querySelector("[data-assistant-tray]");
    if (!tray) return;
    const toggle = tray.querySelector("[data-assistant-tray-toggle]");
    const menu = tray.querySelector("[data-assistant-tray-menu]");
    const options = [...tray.querySelectorAll("[data-assistant-open]")];
    const petLauncher = () => document.getElementById("studylabPetLauncher");
    const petPanel = () => document.getElementById("studylabPetPanel");
    const aiLauncher = () => document.querySelector("[data-ai-launcher]");
    const aiPanel = () => document.querySelector("[data-ai-panel]");

    function closeMenu() {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
    function closePet() {
      const panel = petPanel();
      const button = petLauncher();
      if (panel && !panel.hidden) {
        const close = panel.querySelector("[data-pet-close]");
        if (close) close.click();
        else panel.hidden = true;
      }
      if (button) {
        button.setAttribute("aria-expanded", "false");
        button.classList.remove("is-open");
      }
    }
    function closeAI() {
      const panel = aiPanel();
      if (panel && panel.classList.contains("is-open")) {
        const close = panel.querySelector("[data-ai-close]");
        if (close) close.click();
      }
    }
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = menu.hidden;
      menu.hidden = !opening;
      toggle.setAttribute("aria-expanded", String(opening));
    });
    options.forEach((option) => {
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        const target = option.dataset.assistantOpen;
        closeMenu();
        if (target === "pet") {
          closeAI();
          const button = petLauncher();
          const panel = petPanel();
          if (button && panel && panel.hidden) button.click();
          else if (panel && !panel.hidden) closePet();
        } else if (target === "ai") {
          closePet();
          const button = aiLauncher();
          const panel = aiPanel();
          if (button && panel && !panel.classList.contains("is-open")) button.click();
          else if (panel && panel.classList.contains("is-open")) closeAI();
        }
      });
    });
    document.addEventListener("click", (event) => {
      if (!tray.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
