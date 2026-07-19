// ============================================================
// AthleteOS — public/sw.js
// Mode : Workbox injectManifest
// IMPORTANT : pas d'import ES Module ici — Workbox injecte
// le manifest via self.__WB_MANIFEST directement.
// ============================================================

// Workbox injecte ici la liste des fichiers à précacher
// Ne pas toucher cette ligne — elle est remplacée au build
const WB_MANIFEST = self.__WB_MANIFEST || [];

// Précache manuel sans import ES Module
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("athleteos-v1").then((cache) => {
      const urls = WB_MANIFEST.map((entry) =>
        typeof entry === "string" ? entry : entry.url
      );
      return cache.addAll(urls).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push ──────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: "AthleteOS", body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "AthleteOS", {
      body:     payload.body  ?? "",
      icon:     "/icon-192.png",
      badge:    "/icon-192.png",
      data:     { url: payload.url ?? "/" },
      vibrate:  [200, 100, 200],
      tag:      payload.tag ?? "athleteos",
      renotify: true,
    })
  );
});

// ── Notification click ────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) { client.focus(); return; }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});