// ============================================================
// AthleteOS — public/sw.js
// Mode : Workbox injectManifest
// IMPORTANT : pas d'import ES Module ici — Workbox injecte
// le manifest via self.__WB_MANIFEST directement.
// ============================================================

// Workbox injecte ici la liste des fichiers à précacher
// Ne pas toucher cette ligne — elle est remplacée au build
const WB_MANIFEST = self.__WB_MANIFEST || [];
const PRECACHE_NAME = "athleteos-v2";
const RUNTIME_NAME = "athleteos-runtime-v1";

// Précache manuel sans import ES Module
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => {
      // Vite peut injecter certaines icônes deux fois (assets publics + manifeste).
      // Cache.addAll rejette alors tout le préchargement : on déduplique d'abord.
      const urls = [...new Set(WB_MANIFEST.map((entry) =>
        typeof entry === "string" ? entry : entry.url
      ))];
      // En cas d'échec, l'installation doit échouer : le navigateur conserve
      // alors l'ancien service worker fonctionnel au lieu d'activer un cache
      // neuf mais incomplet.
      return cache.addAll(urls);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("athleteos-") && ![PRECACHE_NAME, RUNTIME_NAME].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// L'interface et ses ressources restent disponibles hors connexion. Les appels
// Supabase ne sont jamais mis en cache ici afin d'éviter d'afficher des données
// métier périmées comme si elles venaient du serveur.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (
          await caches.match(request)
          || await caches.match("/index.html")
          || await caches.match("index.html")
          || Response.error()
        ))
    );
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(RUNTIME_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
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
  let url = "/";
  try {
    const target = new URL(event.notification.data?.url ?? "/", self.location.origin);
    if (target.origin === self.location.origin) url = `${target.pathname}${target.search}${target.hash}`;
  } catch { /* URL invalide : retour sûr à l'accueil */ }
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if ("navigate" in client) await client.navigate(url).catch(() => {});
          if ("focus" in client) { await client.focus(); return; }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
