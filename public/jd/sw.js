/* App shell version — bumped on deploy to trigger update prompt */
const APP_VERSION = '2026-06-10T10:30:40Z';

self.addEventListener('install', () => {
  // Wait for user confirmation before activating (see install.js)
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
