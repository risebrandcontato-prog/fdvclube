const CACHE_NAME = "fdv-v2";
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

  // 3. JS Chunks (code splitting Vite) → NetworkFirst CRÍTICO
  // Cada deploy gera hashes novos nos chunks. Se o chunk não existe,
  // o app quebra. NetworkFirst garante que pegamos o chunk correto.
  if (request.destination === "script" || url.pathname.match(/\/assets\/.*\.js$/)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Chunk não existe mais — notifica app para reload
            self.clients.matchAll().then((clients) => {
              clients.forEach((client) => {
                client.postMessage({ type: "CHUNK_MISSING", url: request.url });
              });
            });
            return new Response("Chunk não encontrado", { status: 404 });
          });
        })
    );
    return;
  }

  // 4. CSS → NetworkFirst (também pode ter hash no Vite)
  if (request.destination === "style" || url.pathname.match(/\/assets\/.*\.css$/)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 5. Imagens do Supabase Storage → Cache First com fallback
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

  // 6. Outras imagens/fontes → Stale While Revalidate
  if (
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2?)$/)
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

  // 7. Navegação (HTML) → Network First com fallback offline
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
            return caches.match("/");
          });
        })
    );
    return;
  }

  // 8. Default → cache com fallback rede
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request);
    })
  );
});

// ── Mensagens do cliente (update + chunk missing) ──
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});