/* Inlined in the page head: apply theme and select the correct StudyLab loading scene. */
(function () {
  'use strict';
  const root = document.documentElement;
  const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const valid = value => ['dark', 'light', 'system'].includes(value);
  const mode = read('studylab-room-mode-v1') || read('etools-theme');
  const choice = valid(mode) ? mode : 'dark';
  root.dataset.theme = choice === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  root.dataset.themeMode = choice;

  const home = /(?:\/|\/index\.html)$/i.test(location.pathname);
  const ENTRY_KEY = 'studylab-first-entry-in-tab-v2';
  const nav = (typeof performance.getEntriesByType === 'function' &&
    performance.getEntriesByType('navigation')[0]) || null;
  const navigation = nav?.type || 'navigate';

  // Flask: the first *new navigation to Home* in this tab, even for returning
  // users. Rings: every other navigation, including reloads, links and history.
  // Reserve entry before rendering, so a refresh in the middle shows rings.
  let showFlask = false;
  try {
    showFlask = home && navigation === 'navigate' &&
      sessionStorage.getItem(ENTRY_KEY) !== '1';
    sessionStorage.setItem(ENTRY_KEY, '1');
  } catch (_) {
    // No session storage: safely use the normal rings instead of replaying intro.
  }

  root.classList.add(showFlask ? 'sl-first-intro' : 'sl-booting');
  let ready = false;
  let failsafe;
  let restoreTimer;

  function reveal() {
    if (ready) return;
    ready = true;
    clearTimeout(failsafe);
    root.classList.remove('sl-booting');
    root.classList.add('sl-page-ready');
  }

  // A failed script, CDN, auth service or connection may not trap the page.
  failsafe = setTimeout(reveal, 12000);
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

  // On BFCache restores no new document is loaded and the boot script isn't run
  // again. Briefly replay the same four arcs and then release them safely.
  window.addEventListener('pagehide', function () {
    clearTimeout(restoreTimer);
    root.classList.remove('sl-booting', 'sl-first-intro');
    const flask = document.getElementById('studylabLoader');
    if (flask) flask.remove();
  });
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    clearTimeout(restoreTimer);
    root.classList.remove('sl-first-intro');
    root.classList.add('sl-booting');
    // A restored history page is already ready: a short arc reveal, not a
    // fabricated three-second load or another chemistry introduction.
    restoreTimer = setTimeout(function () {
      root.classList.remove('sl-booting');
      root.classList.add('sl-page-ready');
    }, 300);
  });
})();
