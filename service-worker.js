/* StudyLab PWA service worker v1.0.0.
   Online-only by design: no fetch handler and no offline asset cache.
   The worker exists for installability and safe update lifecycle handling. */
const STUDYLAB_PWA_VERSION = "1.0.0";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
