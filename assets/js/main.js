/* =========================================================
   StudyLab shared theme controller
   Modes: dark, light, system
   New visitors start in dark mode. Saved choices persist.
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "studylab-room-mode-v1";
  const LEGACY_STORAGE_KEY = "etools-theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const validModes = ["dark", "light", "system"];

  function readSavedMode() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      return validModes.includes(saved) ? saved : null;
    } catch (_) {
      return null;
    }
  }

  // A first-time visitor gets dark mode. System mode is opt-in.
  let themeMode = readSavedMode() || "dark";

  function resolveTheme(mode) {
    if (mode === "system") return media.matches ? "dark" : "light";
    return mode === "light" ? "light" : "dark";
  }

  function iconFor(mode) {
    if (mode === "system") {
      return '<span class="theme-toggle-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span>';
    }
    if (mode === "dark") {
      return '<span class="theme-toggle-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg></span>';
    }
    return '<span class="theme-toggle-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.7 8.7 0 1 0 20.5 14.5Z"/></svg></span>';
  }

  function updateToggle() {
    const btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;

    const labels = {
      dark: "Dark Mode",
      light: "Light Mode",
      system: "System Theme"
    };
    btn.innerHTML = iconFor(themeMode) + '<span class="theme-toggle-label">' + labels[themeMode] + "</span>";
    btn.setAttribute("aria-label", "Theme mode: " + labels[themeMode] + ". Click to cycle between dark, light, and system themes.");
    btn.setAttribute("title", "Theme: " + labels[themeMode] + " (click to change)");
    btn.setAttribute("aria-pressed", themeMode !== "dark" ? "true" : "false");
  }

  function applyTheme(mode, persist) {
    themeMode = validModes.includes(mode) ? mode : "dark";
    root.setAttribute("data-theme", resolveTheme(themeMode));
    root.setAttribute("data-theme-mode", themeMode);

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, themeMode);
        localStorage.setItem(LEGACY_STORAGE_KEY, themeMode);
      } catch (_) {}
    }

    updateToggle();
  }

  // Optional lightweight mode for slow devices. Default styling is untouched.
  // A visitor can enable it with ?performance=lite or disable with
  // ?performance=normal. The choice persists in this browser.
  const PERF_KEY = "studylab-performance-mode";
  const requestedPerf = new URLSearchParams(window.location.search).get("performance");
  try {
    if (requestedPerf === "lite" || requestedPerf === "normal") localStorage.setItem(PERF_KEY, requestedPerf);
  } catch (_) {}
  let lite = false;
  try { lite = localStorage.getItem(PERF_KEY) === "lite"; } catch (_) {}
  // Never alter the approved appearance without an explicit opt-in.
  if (lite) {
    root.dataset.slPerformance = "lite";
    const lightStyle = document.createElement("style");
    lightStyle.id = "sl-lite-performance-rules";
    lightStyle.textContent = 'html[data-sl-performance="lite"] *,html[data-sl-performance="lite"] *::before,html[data-sl-performance="lite"] *::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}html[data-sl-performance="lite"] .sl-home-sidebar,html[data-sl-performance="lite"] .sl-home-section,html[data-sl-performance="lite"] .room-panel,html[data-sl-performance="lite"] .slr-theme-illustrations{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
    document.head.appendChild(lightStyle);
  }

  // Apply before DOMContentLoaded where possible, avoiding a light-mode flash.
  applyTheme(themeMode, false);

  document.addEventListener("DOMContentLoaded", function () {
    updateToggle();
    const btn = document.querySelector("[data-theme-toggle]");
    if (!btn || btn.dataset.themeHandlerAttached === "true") return;

    btn.dataset.themeHandlerAttached = "true";
    btn.addEventListener("click", function () {
      const nextMode = {
        dark: "light",
        light: "system",
        system: "dark"
      }[themeMode] || "dark";
      applyTheme(nextMode, true);
    });
  });

  function handleSystemThemeChange() {
    if (themeMode === "system") applyTheme("system", false);
  }

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handleSystemThemeChange);
  } else if (typeof media.addListener === "function") {
    media.addListener(handleSystemThemeChange);
  }

  // The Live Study Room keeps its own controller; this event bridges its selected mode.
  document.addEventListener("studylab:room-mode-change", function (event) {
    const mode = event.detail && event.detail.mode;
    // Study Room's theme choice is page-local; do not overwrite Home preferences.
    if (validModes.includes(mode)) applyTheme(mode, false);
  });

  // Keep theme changes made in another StudyLab tab in sync.
  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY && event.key !== LEGACY_STORAGE_KEY) return;
    const saved = validModes.includes(event.newValue) ? event.newValue : "dark";
    applyTheme(saved, false);
  });
})();
