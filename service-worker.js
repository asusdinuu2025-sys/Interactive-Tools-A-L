/* StudyLab PWA service worker v1.0.0.
   Network-only: every request goes to the live StudyLab website.
   No Cache Storage is created, so online updates remain authoritative. */
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
