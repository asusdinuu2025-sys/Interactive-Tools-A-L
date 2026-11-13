/* Keep Home Quick/Feedback panels clear of the floating top header.
   Presentation-only: does not change panel open/close, Quick navigation or feedback data. */
(function () {
  "use strict";
  if (!document.getElementById("studyLabHomeLayout")) return;
  const header = document.querySelector("header.site-header");
  if (!header) return;

  let frame = 0;
  function syncClearance() {
    frame = 0;
    const headerBottom = header.getBoundingClientRect().bottom;
    const clearance = Math.max(0, Math.ceil(headerBottom) + 12);
    document.documentElement.style.setProperty("--sl-home-header-clearance", clearance + "px");
  }
  function scheduleClearance() {
    if (!frame) frame = window.requestAnimationFrame(syncClearance);
  }

  scheduleClearance();
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(scheduleClearance);
    observer.observe(header);
  }
  window.addEventListener("resize", scheduleClearance, { passive: true });
  window.addEventListener("orientationchange", scheduleClearance, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleClearance, { passive: true });
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleClearance).catch(function () {});
  }
})();
