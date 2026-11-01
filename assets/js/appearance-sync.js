/* Homepage bridge to the existing Live Study Room appearance preferences.
   The Room's own controller remains the sole owner of its theme UI and behaviour. */
(() => {
  "use strict";

  if (document.body.classList.contains("study-room-page")) return;

  const KEY = "studylab-room-appearance-v1";
  const SELECTOR = "#homePaletteSelect";
  const allowed = new Set([
    "charcoal", "mint", "midnight-blue", "pinky",
    "forest-green", "lavender", "warm-sand", "ocean"
  ]);

  const select = document.querySelector(SELECTOR);
  const root = document.documentElement;

  function readPalette() {
    try {
      const saved = localStorage.getItem(KEY);
      return allowed.has(saved) ? saved : "midnight-blue";
    } catch (_) {
      return "midnight-blue";
    }
  }

  function applyPalette(value) {
    const palette = allowed.has(value) ? value : "midnight-blue";
    root.setAttribute("data-home-palette", palette);
    if (select && select.value !== palette) select.value = palette;
  }

  applyPalette(readPalette());

  if (select) {
    select.addEventListener("change", () => {
      const palette = select.value;
      if (!allowed.has(palette)) return;
      try { localStorage.setItem(KEY, palette); } catch (_) {}
      applyPalette(palette);
    });
  }

  window.addEventListener("storage", event => {
    if (event.key === KEY) applyPalette(event.newValue);
  });
})();
