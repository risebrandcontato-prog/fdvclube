const CACHE_NAME = "fdv-v3";
const STATIC_ASSETS = [
  "/",
  "/app",
  "/admin",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // During local development, don't intercept app navigation.
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // API Supabase → sempre rede
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(fetch(request));
    return;
  }

  // Server Functions TanStack Start → sempre rede
  if (url.pathname.startsWith("/_server")) {
    event.respondWith(fetch(request));
    return;
  }

  // JS/CSS chunks → NetworkFirst
  if (request.destination === "script" || request.destination === "style" || url.pathname.match(/\/assets\/.*\.(js|css)$/)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || new Response("Chunk missing", { status: 404 })))
    );
    return;
  }

  // Imagens/Storage → CacheFirst
  if (request.destination === "image" || url.hostname.includes("supabase")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Navegação (HTML) → Network First com SPA fallback somente para páginas app
  if (request.mode === "navigate") {
    const isAppRoute = url.pathname === "/" || url.pathname.startsWith("/app") || url.pathname.startsWith("/admin");
    if (!isAppRoute) return;

    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => {
          // Fallback para SPA: serve o / para qualquer rota dinâmica
          return caches.match("/").then((cached) => {
            if (cached) return cached;
            return new Response(
              `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/"></head></html>`,
              { headers: { "Content-Type": "text/html" } }
            );
          });
        })
    );
    return;
  }

  // Default → cache ou rede
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Nova notificação", body: "Você recebeu uma atualização." };
  }

  const title = payload.title || "FDV Clube";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192x192.png",
    badge: payload.badge || "/icon-96x96.png",
    tag: payload.tag || "fdv-general",
    requireInteraction: false,
    sound: payload.sound || "/notification-sound.mp3",
    data: {
      url: payload.url || "/app",
      gameId: payload.gameId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl || clientUrl.href.includes(targetUrl)) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});