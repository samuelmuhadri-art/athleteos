import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: "AthleteOS", body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "AthleteOS", {
      body:    payload.body ?? "",
      icon:    "/icon-192.png",
      badge:   "/icon-192.png",
      data:    { url: payload.url ?? "/" },
      vibrate: [200, 100, 200],
      tag:     payload.tag ?? "athleteos",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) { client.focus(); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});