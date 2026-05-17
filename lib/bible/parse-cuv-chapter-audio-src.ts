import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import { chineseBookNameToBookId } from "@/lib/bible/chinese-book-name-to-id";

const LOCAL_TEOCHEW = /\/audio\/teochew-nt\/([A-Za-z0-9]{2,8})-(\d+)\.mp3(\?|#|$)/i;
const LOCAL_MANDARIN = /\/audio\/([A-Za-z0-9]{2,8})-(\d+)\.mp3(\?|#|$)/i;

const BOOK_ID_RE = /^[A-Z0-9]{2,8}$/;

export type ParsedCuvChapterAudioSrc = {
  bookId: string;
  chapter: number;
  voiceId: CuvChapterAudioVoiceId;
};

function parseLocalBookChapter(
  bookId: string,
  chapter: number,
  voiceId: CuvChapterAudioVoiceId,
): ParsedCuvChapterAudioSrc | null {
  if (!BOOK_ID_RE.test(bookId) || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId, chapter, voiceId };
}

/**
 * 从壳层当前播放 URL 解析整章朗读对应的书卷、章与人声（本地 `/audio/…` 或 theaudiopower CUV）。
 */
export function tryParseCuvChapterAudioEffectiveSrc(src: string): ParsedCuvChapterAudioSrc | null {
  const s = String(src || "").trim();
  if (!s) return null;

  const teochew = s.match(LOCAL_TEOCHEW);
  if (teochew) {
    return parseLocalBookChapter(teochew[1]!.toUpperCase(), Number(teochew[2]), "teochew-nt");
  }

  const mandarin = s.match(LOCAL_MANDARIN);
  if (mandarin) {
    return parseLocalBookChapter(mandarin[1]!.toUpperCase(), Number(mandarin[2]), "mandarin");
  }

  if (!s.includes("theaudiopower.org/CUV/")) return null;
  try {
    const base = typeof window !== "undefined" ? window.location.href : "https://example.invalid";
    const u = new URL(s, base);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    if (!seg) return null;
    const decoded = decodeURIComponent(seg.replace(/\+/g, "%20"));
    const m = decoded.match(/^(.+?)\s+(\d+)\.mp3$/i);
    if (!m) return null;
    const bookName = m[1]!.trim();
    const chapter = Number(m[2]);
    const bookId = chineseBookNameToBookId(bookName);
    if (!bookId) return null;
    return parseLocalBookChapter(bookId, chapter, "mandarin");
  } catch {
    return null;
  }
}

export function isCuvChapterAudioEffectiveSrc(src: string): boolean {
  return tryParseCuvChapterAudioEffectiveSrc(src) !== null;
}
