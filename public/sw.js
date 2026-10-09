/* Beans PWA service worker — never pin a stale Next bundle forever.
 *
 * Strategy:
 * - Navigations / HTML: network-only (fallback to cache only if offline)
 * - JS/CSS: network-first, then cache
 * - Icons/images: stale-while-revalidate
 * - /api/version: never cache
 * - skipWaiting + clients.claim on activate; wipe old cache buckets
 */

/* Bump when shipping compositor/CSS fixes so installed PWAs drop old bundles. */
const CACHE = "beans-shell-v4";

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
          void cache.put(request, copy);
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw new Error("offline");
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
            void cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw new Error("offline");
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
          if (res.ok) void cache.put(request, res.clone());
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
