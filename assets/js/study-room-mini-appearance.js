/* Study Room-only mini-window appearance; timer/auth logic is unchanged. */
(() => {
  "use strict";
  const root = document.documentElement;
  const themes = new Set(["charcoal","mint","midnight-blue","pinky","forest-green","lavender","warm-sand","ocean"]);
  const themeKey = "studylab-room-appearance-v1";
  const modeKey = "studylab-room-mode-v1";
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)");
  const read = (key, fallback) => {
    try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  };
  const apply = () => {
    const rawTheme = read(themeKey, "midnight-blue");
    const theme = themes.has(rawTheme) ? rawTheme
      : rawTheme === "dark" ? "charcoal" : rawTheme === "light" ? "mint" : "midnight-blue";
    const modeStored = read(modeKey, "system");
    const choice = ["light","dark","system"].includes(modeStored) ? modeStored : "system";
    const mode = choice === "system" ? (systemDark?.matches ? "dark" : "light") : choice;
    root.dataset.roomTheme = theme;
    root.dataset.roomMode = mode;
    root.dataset.roomModeChoice = choice;
  };
  apply();
  window.addEventListener("storage", event => {
    if (event.key === themeKey || event.key === modeKey || event.key === null) apply();
  });
  window.addEventListener("focus", apply);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) apply(); });
  systemDark?.addEventListener?.("change", () => {
    if (root.dataset.roomModeChoice === "system") apply();
  });
})();
