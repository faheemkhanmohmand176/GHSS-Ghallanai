/**
 * GHSS Ghallanai — Service Worker (Master Plan §9.1)
 *
 * Three explicit strategies, hand-rolled and dependency-free:
 *  1. App shell + fonts + offline page: PRECACHED on install
 *     (a cold start on a dead network still opens a branded shell).
 *  2. Public pages: STALE-WHILE-REVALIDATE with a 4s network timeout
 *     (a returning visitor on weak coverage sees the last good copy instantly).
 *  3. Static assets (icons, images): CACHE-FIRST with 30-day expiry.
 *
 * API route handlers are never cached. The update flow is user-respecting:
 * the new SW activates in the background; the app shows a refresh toast
 * on next navigation (handled by SwRegister component).
 */

const VERSION = "ghss-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;

const PRECACHE_URLS = [
  "/",
  "/offline",
  "/notices",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/crest.svg",
  "/icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

const OFFLINE_FALLBACK = "/offline";
const NEVER_CACHE = [/\/api\//, /\/admin/];

async function staleWhileRevalidate(event) {
  const cache = await caches.open(PAGE_CACHE);
  const cached = await cache.match(event.request);
  const fetchAndCache = fetch(event.request)
    .then((res) => {
      if (res && res.ok) cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    // Serve last-good copy instantly; refresh happens in background
    event.waitUntil(fetchAndCache);
    return cached;
  }
  // No cache: race the network against a 4s timeout (§9.1)
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
  const res = await Promise.race([fetchAndCache, timeout]);
  return res || caches.match(OFFLINE_FALLBACK);
}

async function cacheFirst(event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(event.request);
  if (cached) {
    // 30-day expiry for Cloudinary/static images (§9.1)
    const date = cached.headers.get("date");
    if (!date || Date.now() - new Date(date).getTime() < 30 * 24 * 60 * 60 * 1000) {
      return cached;
    }
  }
  const res = await fetch(event.request);
  if (res && (res.ok || res.type === "opaque")) cache.put(event.request, res.clone());
  return res || cached || caches.match(OFFLINE_FALLBACK);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Cloudinary media and other cross-origin assets: cache-first
    if (request.destination === "image") {
      event.respondWith(cacheFirst(event));
    }
    return;
  }

  if (NEVER_CACHE.some((re) => re.test(url.pathname))) return;

  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  // Same-origin static assets
  if (/\.(png|jpg|jpeg|svg|webp|avif|woff2?|css|js|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event));
  }
});

/* Web push (§9.3) — display notifications forwarded by the server */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "GHSS Ghallanai", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "GHSS Ghallanai", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      tag: payload.tag || "ghss",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
