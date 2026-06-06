/**
 * AskBible PWA Service Worker：壳层静态资源 + 智能 runtime 缓存。
 * 不缓存 admin/studio、app-build、manifest；导航与 RSC 采用 NetworkFirst + 回退。
 */
/* eslint-disable no-restricted-globals */

const CACHE_PREFIX = "selah";
const FALLBACK_BUILD = "v1";
const MAX_NAV_CACHE_ENTRIES = 48;
const MAX_MEDIA_CACHE_ENTRIES = 120;
const NAV_NETWORK_TIMEOUT_MS = 5000;

const SHELL_PRECACHE = [
  "/offline.html",
  "/read/parchment-scroll-bg-wide.webp",
  "/read/parchment-scroll-bg.webp",
];

const MEDIA_PATH_PREFIXES = ["/audio/", "/verse-timings/", "/music/uploads/", "/music/analysis/"];

let activeBuildId = FALLBACK_BUILD;

function cacheNames() {
  const b = activeBuildId || FALLBACK_BUILD;
  return {
    precache: `${CACHE_PREFIX}-precache-${b}`,
    static: `${CACHE_PREFIX}-static-${b}`,
    nav: `${CACHE_PREFIX}-nav-${b}`,
    media: `${CACHE_PREFIX}-media-${b}`,
    api: `${CACHE_PREFIX}-api-${b}`,
  };
}

function isSelahCacheName(name) {
  return typeof name === "string" && name.startsWith(`${CACHE_PREFIX}-`);
}

async function fetchBuildId() {
  try {
    const res = await fetch("/app-build.json", { cache: "no-store" });
    if (!res.ok) return FALLBACK_BUILD;
    const j = await res.json();
    const id = typeof j.id === "string" ? j.id.trim() : "";
    return id && id !== "unknown" ? id : FALLBACK_BUILD;
  } catch {
    return FALLBACK_BUILD;
  }
}

async function deleteForeignCaches(keepNames) {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) => {
      if (!isSelahCacheName(key)) return Promise.resolve();
      if (keepNames.includes(key)) return Promise.resolve();
      return caches.delete(key);
    }),
  );
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  const sorted = keys.slice(0, excess);
  await Promise.all(sorted.map((req) => cache.delete(req)));
}

async function precacheShell(precacheName) {
  const cache = await caches.open(precacheName);
  await Promise.all(
    SHELL_PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) await cache.put(url, res);
      } catch {
        /* ignore missing dev assets */
      }
    }),
  );
}

async function activateWorker() {
  activeBuildId = await fetchBuildId();
  const names = cacheNames();
  await precacheShell(names.precache);
  await purgePartialMediaCache(names.media);
  await deleteForeignCaches(Object.values(names));
  await self.clients.claim();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      activeBuildId = await fetchBuildId();
      const names = cacheNames();
      await precacheShell(names.precache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(activateWorker());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data.type !== "string") return;
  if (data.type === "SELAH_SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }
  if (data.type === "SELAH_PURGE_CACHES") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(isSelahCacheName).map((k) => caches.delete(k)));
        activeBuildId = await fetchBuildId();
        const names = cacheNames();
        await precacheShell(names.precache);
      })(),
    );
  }
});

function urlFromRequest(request) {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function shouldBypassCache(url, request) {
  const host = self.location.hostname || "";
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (request.method !== "GET") return true;
  if (!isSameOrigin(url)) return true;
  const p = url.pathname;
  if (p.startsWith("/api/admin") || p.startsWith("/api/studio") || p.startsWith("/api/ai")) return true;
  if (p === "/app-build.json" || p === "/api/app-build") return true;
  if (p === "/manifest.webmanifest") return true;
  if (p.startsWith("/api/read/info-edition")) return true;
  return false;
}

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isRscRequest(request, url) {
  if (request.headers.get("RSC") === "1") return true;
  if (request.headers.get("Next-Router-Prefetch") === "1") return true;
  if (url.searchParams.has("_rsc")) return true;
  return false;
}

function isAppShellPath(pathname) {
  if (pathname === "/" || pathname === "/music" || pathname === "/offline") return true;
  if (pathname === "/read" || pathname.startsWith("/read/")) return true;
  return false;
}

function isMediaPath(pathname) {
  return MEDIA_PATH_PREFIXES.some((pre) => pathname.startsWith(pre));
}

function isNextStatic(pathname) {
  return pathname.startsWith("/_next/static/");
}

function requestHasRangeHeader(request) {
  return request.headers.has("Range");
}

/** 206 分片响应不能按 URL 写入 Cache API，否则 `<audio>` 会拿到截断 MP3 并报 Format error。 */
async function purgePartialMediaCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (req) => {
      const res = await cache.match(req);
      if (res?.status === 206) await cache.delete(req);
    }),
  );
}

async function cacheFirst(request, cacheName, trimMax) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok && res.status === 200) {
      await cache.put(request, res.clone());
      if (trimMax) await trimCache(cacheName, trimMax);
    }
    return res;
  } catch {
    if (cached) return cached;
    throw new Error("offline");
  }
}

/** 音频/视频：Range 请求直出网络；仅缓存完整 200 响应。 */
async function cacheFirstMedia(request, cacheName, trimMax) {
  if (requestHasRangeHeader(request)) {
    return fetch(request);
  }
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached && cached.status !== 206) return cached;
  try {
    const res = await fetch(request);
    if (res.ok && res.status === 200) {
      await cache.put(request, res.clone());
      if (trimMax) await trimCache(cacheName, trimMax);
    }
    return res;
  } catch {
    if (cached && cached.status !== 206) return cached;
    throw new Error("offline");
  }
}

async function staleWhileRevalidate(request, cacheName, trimMax) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(async (res) => {
      if (res.ok) {
        await cache.put(request, res.clone());
        if (trimMax) await trimCache(cacheName, trimMax);
      }
      return res;
    })
    .catch(() => null);
  if (cached) {
    void networkPromise;
    return cached;
  }
  const res = await networkPromise;
  if (res) return res;
  throw new Error("offline");
}

async function networkFirstNavigation(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAV_NETWORK_TIMEOUT_MS);
    const res = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      await cache.put(request, res.clone());
      await trimCache(cacheName, MAX_NAV_CACHE_ENTRIES);
    }
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.open(cacheNames().precache);
    const fallback = await offline.match("/offline.html");
    if (fallback) return fallback;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = urlFromRequest(request);
  if (!url || shouldBypassCache(url, request)) return;

  const names = cacheNames();
  const { pathname } = url;

  if (isNextStatic(pathname)) {
    event.respondWith(cacheFirst(request, names.static, undefined));
    return;
  }

  if (isMediaPath(pathname)) {
    event.respondWith(cacheFirstMedia(request, names.media, MAX_MEDIA_CACHE_ENTRIES));
    return;
  }

  if (pathname === "/api/music/companion") {
    event.respondWith(staleWhileRevalidate(request, names.api, 8));
    return;
  }

  if (pathname === "/api/home/bible-translations-catalog") {
    event.respondWith(staleWhileRevalidate(request, names.api, 4));
    return;
  }

  const navLike =
    isNavigationRequest(request) || (isAppShellPath(pathname) && isRscRequest(request, url));

  if (navLike && isAppShellPath(pathname)) {
    event.respondWith(networkFirstNavigation(request, names.nav));
    return;
  }

  if (isRscRequest(request, url) && isAppShellPath(pathname)) {
    event.respondWith(networkFirstNavigation(request, names.nav));
  }
});
