const prefetchedMusicUrls = new Set<string>();

function absoluteMusicUrl(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (typeof window === "undefined") return trimmed;
  try {
    return new URL(trimmed, window.location.href).href;
  } catch {
    return trimmed;
  }
}

/** 播放时在后台预拉下一首（浏览器 HTTP 缓存 / link prefetch） */
export function prefetchMusicTrackSrc(src: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const href = absoluteMusicUrl(src ?? "");
  if (!href || prefetchedMusicUrls.has(href)) return;
  prefetchedMusicUrls.add(href);

  /**
   * `/music/uploads/*` 在服务端 307 跳到 R2（见 next.config.mjs），而 R2 公开桶未配 CORS。
   * 同源发起、跨域落地的预取若用默认 cors 模式会整片失败并刷 404 噪音，故：
   * - `as="audio"`：媒体预取不要求 CORS，与 `<audio>` 实际取用方式一致；
   * - `mode:"no-cors"`：跟随跨域重定向拿 opaque 响应，仍进 HTTP 缓存，达到预热目的。
   * 播放本身不受影响（媒体元素加载从来不是 CORS 请求）。
   */
  /** 同一函数也用于预取同源的 `/music/analysis/*.json`；音频与它的预热方式不同。 */
  const isAudio = /\.(mp3|m4a|aac|ogg|wav)(\?|$)/i.test(href);

  if (isAudio) {
    /**
     * 音频只用 no-cors fetch 预热：`<link rel=prefetch>` 跨域需要 CORS 配合，
     * 而 R2 公开桶未配 CORS，加了只会整片失败并在控制台刷 404。
     * opaque 响应照样进 HTTP 缓存，播放时 `<audio>` 直接命中。
     */
    void fetch(href, { cache: "force-cache", mode: "no-cors", credentials: "omit" }).catch(
      () => {},
    );
    return;
  }

  try {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    link.as = "fetch";
    document.head.appendChild(link);
  } catch {
    /* ignore */
  }

  void fetch(href, { cache: "force-cache", credentials: "same-origin" }).catch(() => {});
}

export function prefetchMusicTrackBundle(args: {
  src: string | null | undefined;
  analysisSrc?: string | null;
}): void {
  prefetchMusicTrackSrc(args.src);
  if (args.analysisSrc?.trim()) prefetchMusicTrackSrc(args.analysisSrc);
}
