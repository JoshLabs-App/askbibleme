/**
 * YouVersion / Bible.com 章节音频解析。
 *
 * 说明：
 * - 这里不走未公开的 JSON API，而是直接解析 Bible.com 的音频章节页。
 * - 页面里会带 `audioChapterInfo`，其中包含可直接下载的 `format_mp3_32k`。
 */

const YOUVERSION_AUDIO_BASE_URL = "https://www.bible.com/audio-bible";

const YOUVERSION_AUDIO_VERSION_IDS: Record<string, string> = {
  asv: "12",
  esv: "59",
  "ccb-zh-hans": "36",
  "ccb-zh-hant": "1392",
  "cnv-zh-hant": "40",
  "cnvs-zh-hans": "41",
  "csbs-zh-hans": "43",
  "csbt-zh-hant": "312",
  "cunp-zh-hant": "46",
  "cunp-zh-hant-god": "414",
  // YouVersion 的简体 CUNPSS 文字版为 2224，但官方音频目录对应神版 48。
  "cunpss-zh-hans": "48",
  "cunpss-zh-hant": "47",
  "rcuv-zh-hant": "139",
  "rcuvss-zh-hans": "140",
  niv: "111",
  nlt: "116",
  nkjv: "114",
  kjv: "1",
};

const YOUVERSION_AUDIO_ABBREVIATIONS: Record<string, string> = {
  asv: "ASV",
  esv: "ESV",
  "ccb-zh-hans": "CCB",
  "ccb-zh-hant": "CCBT",
  "cnv-zh-hant": "CNV",
  "cnvs-zh-hans": "CNVS",
  "csbs-zh-hans": "CSBS",
  "csbt-zh-hant": "CSBT",
  "cunp-zh-hant": "CUNP-Shen",
  "cunp-zh-hant-god": "CUNP-Shangti",
  "cunpss-zh-hans": "CUNPSS-Shen",
  "cunpss-zh-hant": "CUNPSS-Shangti",
  "rcuv-zh-hant": "RCUV",
  "rcuvss-zh-hans": "RCUVSS",
  niv: "NIV11",
  nlt: "NLT",
  nkjv: "NKJV",
  kjv: "KJV",
};

const inFlightAudioResolutions = new Map<string, Promise<string | null>>();
const resolvedAudioSrcCache = new Map<string, string>();
const isDevRuntime =
  typeof globalThis !== "undefined" &&
  "__DEV__" in globalThis &&
  Boolean((globalThis as { __DEV__?: unknown }).__DEV__);

export function isYouVersionAudioWebProxyRuntime(runtime: {
  window?: unknown;
  document?: unknown;
}): boolean {
  return runtime.window !== undefined && runtime.document !== undefined;
}

export function translationUsesYouVersionChapterAudio(translationId: string): boolean {
  return Boolean(resolveYouVersionAudioVersionId(translationId));
}

export function resolveYouVersionAudioVersionId(translationId: string): string | null {
  const id = String(translationId || "").trim().toLowerCase();
  return YOUVERSION_AUDIO_VERSION_IDS[id] ?? null;
}

export function resolveYouVersionAudioAbbreviation(translationId: string): string | null {
  const id = String(translationId || "").trim().toLowerCase();
  return YOUVERSION_AUDIO_ABBREVIATIONS[id] ?? null;
}

export function buildYouVersionAudioPageUrl(args: {
  translationId: string;
  bookId: string;
  chapter: number;
}): string {
  const versionId = resolveYouVersionAudioVersionId(args.translationId);
  const abbr = resolveYouVersionAudioAbbreviation(args.translationId);
  const bookId = String(args.bookId || "").trim().toUpperCase();
  const chapter = Number(args.chapter);
  if (!versionId || !abbr || !bookId || !Number.isInteger(chapter) || chapter < 1) return "";
  return `${YOUVERSION_AUDIO_BASE_URL}/${versionId}/${bookId}.${chapter}.${abbr}`;
}

function cacheKey(args: { translationId: string; bookId: string; chapter: number }): string {
  return `${String(args.translationId || "").trim().toLowerCase()}:${String(args.bookId || "").trim().toUpperCase()}:${Number(args.chapter)}`;
}

function extractYouVersionAudioMp3Url(html: string): string | null {
  const raw = String(html || "").replace(/\\\//g, "/");
  const re = /"format_mp3_32k"\s*:\s*"((?:https?:)?\/\/(?:audio-bible-cdn|api-cdn)\.youversionapi\.com\/[^"]+?\.mp3(?:\?[^"]*)?)"/i;
  const match = raw.match(re);
  if (!match?.[1]) return null;
  return match[1].startsWith("//") ? `https:${match[1]}` : match[1];
}

async function fetchYouVersionAudioHtml(url: string): Promise<string | null> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), 12_000) : null;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0",
      },
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!res.ok) {
      if (isDevRuntime) {
        console.warn("[youversion-audio] fetch failed", url, res.status);
      }
      return null;
    }
    return await res.text();
  } catch (error) {
    if (isDevRuntime) {
      console.warn("[youversion-audio] fetch error", url, error);
    }
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function resolveYouVersionChapterAudioPlayableSrc(args: {
  translationId: string;
  bookId: string;
  chapter: number;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const key = cacheKey(args);
  const cached = resolvedAudioSrcCache.get(key);
  if (cached) return { ok: true, src: cached };

  // 浏览器不能跨域读取 Bible.com 章节页；交给同源服务端解析。
  // React Native 也提供 window 全局对象；只有真正的 DOM 浏览器才走相对 API。
  if (
    isYouVersionAudioWebProxyRuntime({
      window: typeof window === "undefined" ? undefined : window,
      document: typeof document === "undefined" ? undefined : document,
    })
  ) {
    try {
      const query = new URLSearchParams({
        translationId: args.translationId,
        bookId: args.bookId,
        chapter: String(args.chapter),
      });
      const res = await fetch(`/api/read/chapter-audio?${query.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return { ok: false };
      const json = (await res.json()) as { src?: unknown };
      const src = typeof json.src === "string" ? json.src.trim() : "";
      if (src) resolvedAudioSrcCache.set(key, src);
      return src ? { ok: true, src } : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  const pending = inFlightAudioResolutions.get(key);
  if (pending) {
    const src = await pending;
    return src ? { ok: true, src } : { ok: false };
  }

  const work = (async () => {
    const url = buildYouVersionAudioPageUrl(args);
    if (!url) return null;
    const html = await fetchYouVersionAudioHtml(url);
    if (!html) return null;
    const src = extractYouVersionAudioMp3Url(html);
    if (isDevRuntime) {
      console.warn(
        "[youversion-audio] parsed",
        JSON.stringify({
          translationId: args.translationId,
          bookId: args.bookId,
          chapter: args.chapter,
          hasHtml: Boolean(html),
          hasSrc: Boolean(src),
        }),
      );
    }
    if (src) resolvedAudioSrcCache.set(key, src);
    return src;
  })();

  inFlightAudioResolutions.set(key, work);
  try {
    const src = await work;
    return src ? { ok: true, src } : { ok: false };
  } finally {
    if (inFlightAudioResolutions.get(key) === work) {
      inFlightAudioResolutions.delete(key);
    }
  }
}
