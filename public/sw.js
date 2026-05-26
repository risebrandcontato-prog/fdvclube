const CACHE_NAME = "fdv-v1";
const STATIC_ASSETS = [
  "/",
  "/app",
  "/admin",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

// ── Install: pré-cache das rotas principais ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      self.skipWaiting();
    })
  );
});

// ── Activate: limpa caches antigos ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// ── Fetch: estratégias por tipo ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API do Supabase → sempre rede (não cachear dados dinâmicos)
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Server Functions do TanStack Start (/_server) → rede
  if (url.pathname.startsWith("/_server")) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Imagens do Supabase Storage → Cache First com fallback
  if (url.pathname.startsWith("/storage/") || url.hostname.includes("supabase")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Assets estáticos (JS, CSS, fontes, imagens) → Stale While Revalidate
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 5. Navegação (HTML) → Network First com fallback offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Se nem cache tem, tenta a raiz (SPA fallback)
            return caches.match("/");
          });
        })
    );
    return;
  }

  // 6. Default → cache com fallback rede
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request);
    })
  );
});

// ── Mensagens do cliente (update) ──
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});