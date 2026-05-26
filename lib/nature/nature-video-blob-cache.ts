import { fetchNatureVideoFully } from "@/lib/nature/fetch-nature-video-fully";

type ProgressCb = (received: number, totalBytes: number | null) => void;

type Inflight = {
  promise: Promise<string>;
  progressListeners: Set<ProgressCb>;
};

const objectUrlBySrc = new Map<string, string>();
const inflightBySrc = new Map<string, Inflight>();

function notifyProgress(src: string, received: number, totalBytes: number | null) {
  const row = inflightBySrc.get(src);
  if (!row) return;
  for (const fn of row.progressListeners) {
    try {
      fn(received, totalBytes);
    } catch {
      /* ignore */
    }
  }
}

/** 已就绪的 Blob object URL（仅客户端 fetch 路径） */
export function peekNatureVideoBlobObjectUrl(src: string): string | null {
  const key = src.trim();
  if (!key) return null;
  return objectUrlBySrc.get(key) ?? null;
}

/**
 * 整段下载自然影片并缓存为 Blob URL；同源并发请求合并为一次 fetch。
 * `signal` 中止时仅取消该订阅，进行中的 fetch 仍可为其它订阅方完成。
 */
export function ensureNatureVideoBlobObjectUrl(
  src: string,
  signal: AbortSignal,
  onProgress: ProgressCb,
): Promise<string> {
  const key = src.trim();
  if (!key) return Promise.reject(new Error("empty src"));

  const cached = objectUrlBySrc.get(key);
  if (cached) {
    onProgress(1, 1);
    return Promise.resolve(cached);
  }

  let inflight = inflightBySrc.get(key);
  if (!inflight) {
    const progressListeners = new Set<ProgressCb>();
    const promise = (async () => {
      try {
        const buf = await fetchNatureVideoFully(key, new AbortController().signal, (received, total) => {
          notifyProgress(key, received, total);
        });
        const blob = new Blob([buf], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        objectUrlBySrc.set(key, url);
        return url;
      } finally {
        inflightBySrc.delete(key);
      }
    })();
    inflight = { promise, progressListeners };
    inflightBySrc.set(key, inflight);
  }

  inflight.progressListeners.add(onProgress);

  const onAbort = () => {
    inflight?.progressListeners.delete(onProgress);
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });

  return inflight.promise.finally(() => {
    signal.removeEventListener("abort", onAbort);
    inflight?.progressListeners.delete(onProgress);
  });
}
