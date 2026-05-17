/**
 * 最小 Service Worker：满足 Chromium「可安装 PWA」条件（manifest + SW + fetch 处理）。
 * 不做离线缓存，避免与 Next 动态路由冲突。
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});
