/* Inlined before page styles. First-visit intro and loading must never replay on refresh, history or internal navigation. */
(function () {
  'use strict';
  const root = document.documentElement;
  const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const valid = value => ['dark', 'light', 'system'].includes(value);
  const mode = read('studylab-room-mode-v1') || read('etools-theme');
  const choice = valid(mode) ? mode : 'dark';
  root.dataset.theme = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  root.dataset.themeMode = choice;

  const home = /(?:\/|\/index\.html)$/i.test(location.pathname);
  const INTRO_KEY = 'studylab-first-welcome-intro-v2';
  const ENTRY_KEY = 'studylab-first-entry-in-tab-v2';
  const nav = (typeof performance.getEntriesByType === 'function' &&
    performance.getEntriesByType('navigation')[0]) || null;
  const navigation = nav?.type || 'navigate';
  const isNewNavigation = navigation === 'navigate';
  let showFlask = false;
  let showRings = false;

  // A first-time visitor gets the chemistry introduction before the auth welcome.
  // Returning students get the fast four-arc loader on the initial Home entry in
  // a fresh browser tab, but NEVER on reload, browser Back/Forward or subpages.
  // Reserve the first-visit flag synchronously, so refresh mid-intro cannot replay it.
  try {
    const firstInTab = sessionStorage.getItem(ENTRY_KEY) !== '1';
    const introPlayed = localStorage.getItem(INTRO_KEY) === '1';
    if (home && isNewNavigation && firstInTab) {
      showFlask = !introPlayed;
      showRings = introPlayed;
    }
    sessionStorage.setItem(ENTRY_KEY, '1');
    if (showFlask) localStorage.setItem(INTRO_KEY, '1');
  } catch (_) {
    // Without persistent storage, avoid any repeating or stuck animation.
    showFlask = false;
    showRings = false;
  }

  if (showFlask) root.classList.add('sl-first-intro');
  if (showRings) root.classList.add('sl-booting');
  let finished = false;
  function reveal() {
    if (finished) return;
    finished = true;
    clearTimeout(failsafe);
    root.classList.remove('sl-booting');
    root.classList.add('sl-page-ready');
  }
  // A failed CDN, auth or network request must not trap students behind a loader.
  const failsafe = setTimeout(reveal, 12000);
  document.addEventListener('DOMContentLoaded', function () {
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

  // BFCache navigation can restore previous DOM/CSS classes. Never replay the intro.
  function leavePage() {
    root.classList.remove('sl-booting', 'sl-first-intro');
    const intro = document.getElementById('studylabLoader');
    if (intro) intro.remove();
  }
  window.addEventListener('pagehide', leavePage);
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    leavePage();
    reveal();
  });
})();
