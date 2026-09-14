/* =========================================================
   E-tools for G.C.E A/L Sri Lanka — Shared JavaScript
   Handles: theme toggle + localStorage persistence
   ========================================================= */

(function () {
  const STORAGE_KEY = "etools-theme";

  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    const btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      btn.textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
    }
  }

  // Apply theme as early as possible
  applyTheme(getPreferredTheme());

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;

    // Set correct label on load
    const current = document.documentElement.getAttribute("data-theme") || getPreferredTheme();
    btn.textContent = current === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";

    btn.addEventListener("click", function () {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      applyTheme(isDark ? "light" : "dark");
    });
  });
})();
