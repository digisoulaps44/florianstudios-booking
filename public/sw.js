/*
 * Service worker for medarbejderappen (PWA): viser push-notifikationer, også når appen er lukket,
 * og åbner den relevante booking ved tryk. Ingen offline-cache af data – kalenderen skal altid være frisk.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "Florian Studios", body: "Ny besked", url: "/app/notifikationer" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ugyldig payload – vis standardtekst */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "da",
      tag: data.url,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

/* Abonnementet kan udløbe eller blive fornyet af browseren – brugeren slår push til igen i appen. */
self.addEventListener("pushsubscriptionchange", () => {});
