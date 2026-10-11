/* Beans PWA service worker — never pin a stale Next bundle forever.
 *
 * Strategy:
 * - Navigations / HTML: network-only (fallback to cache only if offline)
 * - JS/CSS: network-first, then cache
 * - Icons/images: stale-while-revalidate
 * - /api/version: never cache
 * - skipWaiting + clients.claim on activate; wipe old cache buckets
 * - Bound cache size so network-first JS/CSS cannot grow forever on iPhone
 */

/* Bump when shipping compositor/CSS/SW policy fixes so installed PWAs drop old bundles. */
const CACHE = "beans-shell-v5";
/** Cap shell cache entries (HTML + JS/CSS + icons). Oldest trimmed first. */
const MAX_CACHE_ENTRIES = 80;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isVersionApi(url) {
  return url.pathname === "/api/version";
}

function isNavigation(request) {
  return (
    request.mode === "navigate" ||
    (request.destination === "document" && request.method === "GET")
  );
}

function isCodeAsset(url) {
  return (
    url.pathname.startsWith("/_next/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css")
  );
}

async function putBounded(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHE_ENTRIES) return;
  const overflow = keys.length - MAX_CACHE_ENTRIES;
  for (let i = 0; i < overflow; i++) {
    const oldest = keys[i];
    if (oldest) await cache.delete(oldest);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (isVersionApi(url)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (isNavigation(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request, { cache: "no-store" });
          const copy = fresh.clone();
          const cache = await caches.open(CACHE);
          void putBounded(cache, request, copy);
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  if (isCodeAsset(url)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(CACHE);
            void putBounded(cache, request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  // Icons / misc: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res.ok) void putBounded(cache, request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
