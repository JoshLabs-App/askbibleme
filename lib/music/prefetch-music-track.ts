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
