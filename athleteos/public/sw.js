// ============================================================
// AthleteOS — public/sw.js
// Service Worker : Web Push Notifications
//
// DÉPLOIEMENT :
// 1. Copier ce fichier dans /public/sw.js (racine du projet)
// 2. Enregistrer dans main.jsx (voir instructions en bas)
// 3. Générer une paire VAPID : npx web-push generate-vapid-keys
// 4. Stocker VITE_VAPID_PUBLIC_KEY dans .env
// ============================================================

const CACHE_NAME = "athleteos-v1";

// ── Installation ─────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// ── Activation ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Réception d'une notification push ────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "AthleteOS",
      body: event.data.text(),
      icon: "/icon-192.png",
    };
  }

  const options = {
    body:    payload.body  ?? "Tu as une nouvelle notification",
    icon:    payload.icon  ?? "/icon-192.png",
    badge:   "/icon-192.png",
    // Données passées au click handler
    data:    { url: payload.url ?? "/" },
    // Actions rapides optionnelles
    actions: payload.actions ?? [],
    // Vibration sur Android : [vibrer, pause, vibrer]
    vibrate: [200, 100, 200],
    // Regrouper les notifs du même tag
    tag:     payload.tag ?? "athleteos-default",
    // Remplacer la notif précédente du même tag
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "AthleteOS", options)
  );
});

// ── Click sur une notification ───────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si l'app est déjà ouverte, la focus et naviguer
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.postMessage({ type: "NAVIGATE", url: targetUrl });
            return;
          }
        }
        // Sinon ouvrir un nouvel onglet
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Fermeture d'une notification ─────────────────────────────
self.addEventListener("notificationclose", () => {
  // Analytique optionnel
});