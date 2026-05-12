/** 各浏览器全屏 API 兼容。注意：iOS / iPadOS 上对 `documentElement` 自动全屏易触发 WebKit 异常与整页重载，调用方应先用 `isIosLikeUserAgent()` 跳过。 */
export function requestFullscreenCompat(el: Element): Promise<void> {
  const t = el as Element & {
    requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
    webkitRequestFullscreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  if (typeof t.requestFullscreen === "function") {
    return t.requestFullscreen().catch(() => {});
  }
  if (typeof t.webkitRequestFullscreen === "function") {
    try {
      t.webkitRequestFullscreen();
      return Promise.resolve();
    } catch {
      return Promise.reject(new Error("webkit fullscreen rejected"));
    }
  }
  if (typeof t.msRequestFullscreen === "function") {
    try {
      t.msRequestFullscreen();
      return Promise.resolve();
    } catch {
      return Promise.reject(new Error("ms fullscreen rejected"));
    }
  }
  return Promise.reject(new Error("fullscreen unavailable"));
}

export function exitFullscreenCompat(): Promise<void> {
  const d = document as Document & {
    webkitExitFullscreen?: () => void;
    msExitFullscreen?: () => void;
  };
  if (document.fullscreenElement == null) return Promise.resolve();
  if (typeof document.exitFullscreen === "function") {
    return document.exitFullscreen().catch(() => {});
  }
  if (typeof d.webkitExitFullscreen === "function") {
    try {
      d.webkitExitFullscreen();
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  }
  if (typeof d.msExitFullscreen === "function") {
    try {
      d.msExitFullscreen();
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  }
  return Promise.resolve();
}
