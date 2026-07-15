/**
 * YouVersion / Bible.com 章节音频解析。
 *
 * 说明：
 * - 这里不走未公开的 JSON API，而是直接解析 Bible.com 的音频章节页。
 * - 页面里会带 `audioChapterInfo`，其中包含可直接下载的 `format_mp3_32k`。
 */

const YOUVERSION_AUDIO_BASE_URL = "https://www.bible.com/audio-bible";

const YOUVERSION_AUDIO_VERSION_IDS: Record<string, string> = {
  "ccb-zh-hans": "36",
  "ccb-zh-hant": "1392",
  "cccbst-zh-hant": "2361",
  "cnv-zh-hant": "40",
  "cnvs-zh-hans": "41",
  "csbs-zh-hans": "43",
  "csbt-zh-hant": "312",
  "rcuv-zh-hant": "139",
  "rcuvss-zh-hans": "140",
  niv: "111",
  nlt: "116",
  nkjv: "114",
  kjv: "1",
};

const YOUVERSION_AUDIO_ABBREVIATIONS: Record<string, string> = {
  "ccb-zh-hans": "CCB",
  "ccb-zh-hant": "CCB",
  "cccbst-zh-hant": "CCCbst",
  "cnv-zh-hant": "CNV",
  "cnvs-zh-hans": "CNVS",
  "csbs-zh-hans": "CSBS",
  "csbt-zh-hant": "CSBT",
  "rcuv-zh-hant": "RCUV",
  "rcuvss-zh-hans": "RCUVSS",
  niv: "NIV",
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
  const raw = String(html || "");
  const re = /"format_mp3_32k":"(\/\/audio-bible-cdn\.youversionapi\.com\/[^"]+?\.mp3\?version_id=\d+)"/i;
  const match = raw.match(re);
  if (!match?.[1]) return null;
  return `https:${match[1]}`;
}

async function fetchYouVersionAudioHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0",
      },
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
