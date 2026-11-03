/* StudyLab PWA service worker v7.4.
   Network-only: every same-origin page request goes to the live site.
   Cross-origin Supabase REST/Auth/Realtime traffic is left entirely to the browser. */
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Do not proxy third-party API, auth, CDN or realtime traffic through this worker.
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(fetch(request));
});
