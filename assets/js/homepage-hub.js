/* Small homepage shortcuts that open the existing StudyLab panels.
   No new feature state or backend behaviour is introduced. */
(() => {
  "use strict";

  document.addEventListener("click", event => {
    const socialShortcut = event.target instanceof Element
      ? event.target.closest("[data-home-social-open]")
      : null;
    if (socialShortcut) {
      const existingSocialButton = document.querySelector(".sl-feed-toggle");
      if (existingSocialButton) existingSocialButton.click();
      return;
    }

    const aiShortcut = event.target instanceof Element
      ? event.target.closest("[data-home-ai-open]")
      : null;
    if (aiShortcut) {
      const existingAiButton = document.querySelector("[data-ai-launcher]");
      if (existingAiButton) existingAiButton.click();
    }
  });
})();
