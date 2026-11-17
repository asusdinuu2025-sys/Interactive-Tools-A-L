/* Inlined by scripts/sync-page-boot.mjs before styles: no extra blocking request. */
(function () {
  'use strict';
  const root = document.documentElement;
  const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const valid = value => ['dark', 'light', 'system'].includes(value);
  const mode = read('studylab-room-mode-v1') || read('etools-theme');
  const choice = valid(mode) ? mode : 'dark';
  root.dataset.theme = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  root.dataset.themeMode = choice;
  // The existing chemistry intro is shown only once per browser session.
  // On that first Home visit, leave the scene visible instead of showing two loaders.
  let firstIntro = false;
  try {
    firstIntro = /(?:\/|\/index\.html)$/i.test(location.pathname) &&
      sessionStorage.getItem('studylabSplashSeenV1') !== '1';
  } catch (_) {
    // The first-visit intro already has its own storage fallback.
    firstIntro = /(?:\/|\/index\.html)$/i.test(location.pathname);
  }
  root.classList.add('sl-booting');
  if (firstIntro) root.classList.add('sl-boot-intro');
  let finished = false;
  function reveal() {
    if (finished) return;
    finished = true;
    clearTimeout(failsafe);
    root.classList.remove('sl-booting');
    root.classList.add('sl-page-ready');
  }
  // A failed CDN/script must never leave the site trapped behind a loader.
  const failsafe = setTimeout(reveal, 12000);
  document.addEventListener('DOMContentLoaded', function () {
    // Allow other DOMContentLoaded handlers to finish constructing the current UI.
    setTimeout(function () {
      const tasks = [window.StudyLabAccount?.startup, window.StudyLabContentReady].filter(Boolean);
      let deadline;
      Promise.race([
        Promise.allSettled(tasks),
        new Promise(resolve => { deadline = setTimeout(resolve, 3000); })
      ]).then(function () {
        clearTimeout(deadline);
        requestAnimationFrame(() => requestAnimationFrame(reveal));
      });
    }, 0);
  }, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) reveal(); });
})();
