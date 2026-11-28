/* AskBible.me Pure Kernel Service Worker (Web/PWA only; never registered in native shell) */
/* eslint-disable no-restricted-globals */

const CACHE_PREFIX = "askbible-pack-";
const DEFAULT_BUCKET = `${CACHE_PREFIX}shell`;
const SCRIPTURE_BUCKET = "askbible-scripture-v1";
const MANIFEST_URL = "/pack-manifest.json";

let activeCacheName = DEFAULT_BUCKET;

async function resolveManifest() {
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.bundleId === "string" && data.files) {
      return data;
    }
  } catch {
    // Offline or unavailable
  }
  return null;
}

async function precacheFromManifest(manifest) {
  if (!manifest) {
    const cache = await caches.open(DEFAULT_BUCKET);
    await cache.addAll(["/", "/index.html", "/manifest.webmanifest"]).catch(() => {});
    return;
  }

  activeCacheName = `${CACHE_PREFIX}${manifest.bundleId}`;
  const cache = await caches.open(activeCacheName);
  const paths = ["/", "/manifest.webmanifest", ...Object.keys(manifest.files).map((p) => `/${p.replace(/^\/+/, "")}`)];

  await Promise.all(
    paths.map(async (path) => {
      try {
        const hit = await cache.match(path);
        if (hit) return;
        const res = await fetch(path, { cache: "no-cache" });
        if (res.ok) await cache.put(path, res);
      } catch {
        // Skip failed file; silent updater retries later
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const manifest = await resolveManifest();
      await precacheFromManifest(manifest);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const manifest = await resolveManifest();
      const targetName = manifest ? `${CACHE_PREFIX}${manifest.bundleId}` : activeCacheName;
      activeCacheName = targetName;
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith(CACHE_PREFIX) && key !== targetName) {
            return caches.delete(key);
          }
          return Promise.resolve();
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/local-db/") ||
    url.pathname === "/pack-manifest.json" ||
    url.pathname === "/app-build.json" ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(req);
          if (network.ok) return network;
        } catch {
          // Offline fallback to cached index.html
        }
        const cache = await caches.open(activeCacheName);
        return (
          (await cache.match("/index.html")) ||
          (await cache.match("/")) ||
          (await caches.match("/index.html")) ||
          Response.error()
        );
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(activeCacheName);
          cache.put(req, res.clone());
        }
        return res;
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/scripture/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SCRIPTURE_BUCKET);
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || (await networkPromise) || Response.error();
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(activeCacheName);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return Response.error();
      }
    })(),
  );
});
