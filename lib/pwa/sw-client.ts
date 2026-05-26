/** 通知 Service Worker 清理旧版本缓存（与 app-build 更新联动） */
export async function postMessageToServiceWorker(message: Record<string, unknown>): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage(message);
    for (const sw of reg.waiting ? [reg.waiting] : []) {
      sw?.postMessage(message);
    }
  } catch {
    /* ignore */
  }
}

export async function purgeOfflineCachesForBuildUpdate(): Promise<void> {
  await postMessageToServiceWorker({ type: "SELAH_PURGE_CACHES" });
}

export async function skipWaitingServiceWorker(): Promise<void> {
  await postMessageToServiceWorker({ type: "SELAH_SKIP_WAITING" });
}

export async function refreshServiceWorkerRegistration(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    await reg?.update();
  } catch {
    /* ignore */
  }
}
