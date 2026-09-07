/**
 * ESV 章节音频（Crossway 官方 API，非抓取）。
 *
 * 说明：
 * - `GET /v3/passage/audio/?q=John+5` 带 API key 请求后返回 302，`Location` 指向
 *   `https://audio.esv.org/hw/...mp3`；该地址**不需要认证**、返回 206 且支持 Range。
 * - 因此服务端只用 key 换一次 URL（几十字节的请求，不下载音频），音频流由客户端直连
 *   Crossway CDN，不经过我们的服务器——与金句音频直连 R2 是同一策略。
 * - ESV_API_KEY 只允许留在服务端，所以浏览器和 React Native 都必须走
 *   `/api/read/chapter-audio`，不能在客户端直接请求 Crossway API。
 * - 按 Crossway 条款，这里不缓存、不转存音频本体，只在内存里记住已解析出的 URL。
 */

import { esvChapterQuery } from "@/lib/bible/providers/esv";

const ESV_AUDIO_ENDPOINT = "https://api.esv.org/v3/passage/audio/";

export function translationUsesEsvChapterAudio(translationId: string): boolean {
  return String(translationId || "").trim().toLowerCase() === "esv";
}

/** 已解析出的直链；ESV 的 CDN 地址是稳定的，同一章不必反复消耗每日配额。 */
const resolvedAudioSrcCache = new Map<string, string>();
const inFlightAudioResolutions = new Map<string, Promise<string | null>>();

function cacheKey(bookId: string, chapter: number): string {
  return `esv:${bookId.toUpperCase()}:${chapter}`;
}

/**
 * 服务端专用：带 API key 请求 Crossway，读出 302 的 Location。
 * 只在 Node 侧调用——浏览器与 RN 都没有 key。
 */
export async function resolveEsvChapterAudioDirectUrl(args: {
  bookId: string;
  chapter: number;
}): Promise<string | null> {
  const key = process.env.ESV_API_KEY?.trim() || "";
  if (!key) return null;
  const query = esvChapterQuery(args.bookId, args.chapter);
  if (!query) return null;

  try {
    const res = await fetch(`${ESV_AUDIO_ENDPOINT}?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Token ${key}` },
      redirect: "manual",
      cache: "no-store",
    });
    // 正常返回 302；跟随重定向反而会把整个 mp3 拉到我们服务器上。
    const location = res.headers.get("location")?.trim() || "";
    if (!location) return null;
    return location.startsWith("https://") ? location : null;
  } catch {
    return null;
  }
}

export async function resolveEsvChapterAudioPlayableSrc(args: {
  bookId: string;
  chapter: number;
  /** RN 需要绝对地址；网页留空走同源相对路径。 */
  apiBaseUrl?: string;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const bookId = String(args.bookId || "").trim().toUpperCase();
  if (!bookId || !Number.isInteger(args.chapter) || args.chapter < 1) return { ok: false };

  const key = cacheKey(bookId, args.chapter);
  const cached = resolvedAudioSrcCache.get(key);
  if (cached) return { ok: true, src: cached };

  const pending = inFlightAudioResolutions.get(key);
  if (pending) {
    const src = await pending;
    return src ? { ok: true, src } : { ok: false };
  }

  const work = (async (): Promise<string | null> => {
    // 有 window 就是客户端（浏览器或 RN），key 不在这一侧，必须经同源服务端换 URL。
    if (typeof window !== "undefined") {
      try {
        const query = new URLSearchParams({
          translationId: "esv",
          bookId,
          chapter: String(args.chapter),
        });
        const base = (args.apiBaseUrl || "").replace(/\/$/, "");
        const res = await fetch(`${base}/api/read/chapter-audio?${query.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { src?: unknown };
        const src = typeof json.src === "string" ? json.src.trim() : "";
        return src || null;
      } catch {
        return null;
      }
    }
    return resolveEsvChapterAudioDirectUrl({ bookId, chapter: args.chapter });
  })();

  inFlightAudioResolutions.set(key, work);
  try {
    const src = await work;
    if (src) resolvedAudioSrcCache.set(key, src);
    return src ? { ok: true, src } : { ok: false };
  } finally {
    if (inFlightAudioResolutions.get(key) === work) {
      inFlightAudioResolutions.delete(key);
    }
  }
}
