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
      btn.innerHTML = (theme === "dark" ? '<span class="theme-toggle-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg></span>' : '<span class="theme-toggle-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.7 8.7 0 1 0 20.5 14.5Z"/></svg></span>') + '<span class="theme-toggle-label">' + (theme === "dark" ? "Light Mode" : "Dark Mode") + "</span>";
    }
  }

  // Apply theme as early as possible
  applyTheme(getPreferredTheme());

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;

    // Set correct label on load
    const current = document.documentElement.getAttribute("data-theme") || getPreferredTheme();
    btn.innerHTML = (current === "dark" ? '<span class="theme-toggle-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg></span>' : '<span class="theme-toggle-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.7 8.7 0 1 0 20.5 14.5Z"/></svg></span>') + '<span class="theme-toggle-label">' + (current === "dark" ? "Light Mode" : "Dark Mode") + "</span>";

    btn.addEventListener("click", function () {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      applyTheme(isDark ? "light" : "dark");
    });
  });
})();
