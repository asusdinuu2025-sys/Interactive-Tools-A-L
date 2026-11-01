/* StudyLab shared appearance sync.
   The homepage and Live Study Room share one mode and one accent palette.
   Room glass/layout styling remains owned by each page's existing CSS. */
(() => {
  "use strict";

  const MODE_KEY = "etools-theme";
  const PALETTE_KEY = "studylab-room-theme";
  const VALID_MODES = ["dark", "light", "system"];
  const VALID_PALETTES = ["charcoal", "mint", "midnight-blue", "pinky", "forest-green", "lavender", "warm-sand", "ocean"];
  const root = document.documentElement;
  const body = document.body;
  const isRoom = body.classList.contains("study-room-page");
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function read(key, allowed, fallback) {
    try {
      const value = localStorage.getItem(key);
      return allowed.includes(value) ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  let mode = read(MODE_KEY, VALID_MODES, root.dataset.themeMode || "dark");
  let palette = read(PALETTE_KEY, VALID_PALETTES, body.dataset.roomTheme || "midnight-blue");

  function resolvedMode() {
    return mode === "system" ? (media.matches ? "dark" : "light") : mode;
  }

  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function updateControls() {
    document.querySelectorAll("[data-room-mode-choice]").forEach(button => {
      const selected = button.dataset.roomModeChoice === mode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    document.querySelectorAll("[data-room-theme-choice]").forEach(button => {
      const selected = button.dataset.roomThemeChoice === palette;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-checked", String(selected));
    });

    const select = document.getElementById("homePaletteSelect");
    if (select && select.value !== palette) select.value = palette;

    const current = document.getElementById("roomAppearanceCurrent");
    const selectedOption = document.querySelector('[data-room-theme-choice="' + palette + '"] strong');
    if (current && selectedOption) current.textContent = selectedOption.textContent;
  }

  function apply() {
    const resolved = resolvedMode();
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-mode", mode);
    root.setAttribute("data-home-palette", palette);

    if (isRoom) {
      body.setAttribute("data-room-theme", palette);
      body.setAttribute("data-room-mode", resolved);
    }

    updateControls();
  }

  function setMode(nextMode) {
    if (!VALID_MODES.includes(nextMode)) return;
    mode = nextMode;
    save(MODE_KEY, mode);
    apply();
  }

  function setPalette(nextPalette) {
    if (!VALID_PALETTES.includes(nextPalette)) return;
    palette = nextPalette;
    save(PALETTE_KEY, palette);
    apply();
  }

  document.querySelectorAll("[data-room-mode-choice]").forEach(button => {
    button.addEventListener("click", () => setMode(button.dataset.roomModeChoice));
  });

  document.querySelectorAll("[data-room-theme-choice]").forEach(button => {
    button.addEventListener("click", () => setPalette(button.dataset.roomThemeChoice));
  });

  const homePaletteSelect = document.getElementById("homePaletteSelect");
  if (homePaletteSelect) {
    homePaletteSelect.addEventListener("change", () => setPalette(homePaletteSelect.value));
  }

  // The existing homepage Dark / Light / System toggle remains the mode control.
  // Observe its established controller rather than replacing or duplicating it.
  const modeObserver = new MutationObserver(() => {
    const nextMode = root.dataset.themeMode;
    if (VALID_MODES.includes(nextMode) && nextMode !== mode) {
      mode = nextMode;
      save(MODE_KEY, mode);
      apply();
    }
  });
  modeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme-mode"] });

  window.addEventListener("storage", event => {
    if (event.key === MODE_KEY) {
      mode = VALID_MODES.includes(event.newValue) ? event.newValue : "dark";
      apply();
    } else if (event.key === PALETTE_KEY) {
      palette = VALID_PALETTES.includes(event.newValue) ? event.newValue : "midnight-blue";
      apply();
    }
  });

  function onSystemChange() {
    if (mode === "system") apply();
  }
  if (typeof media.addEventListener === "function") media.addEventListener("change", onSystemChange);
  else if (typeof media.addListener === "function") media.addListener(onSystemChange);

  apply();
})();
