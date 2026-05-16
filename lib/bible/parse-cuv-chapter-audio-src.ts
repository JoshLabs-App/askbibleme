import { chineseBookNameToBookId } from "@/lib/bible/chinese-book-name-to-id";

const LOCAL_CHAPTER = /\/audio\/([A-Za-z0-9]{2,8})-(\d+)\.mp3(\?|#|$)/i;

const BOOK_ID_RE = /^[A-Z0-9]{2,8}$/;

/**
 * 从壳层当前播放 URL 解析「和合本整章朗读」对应的书卷与章（本地 `/audio/BOOK-章.mp3` 或 theaudiopower CUV 文件名）。
 */
export function tryParseCuvChapterAudioEffectiveSrc(src: string): { bookId: string; chapter: number } | null {
  const s = String(src || "").trim();
  if (!s) return null;

  const local = s.match(LOCAL_CHAPTER);
  if (local) {
    const bookId = local[1]!.toUpperCase();
    const chapter = Number(local[2]);
    if (BOOK_ID_RE.test(bookId) && Number.isInteger(chapter) && chapter >= 1) return { bookId, chapter };
    return null;
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
    if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
    return { bookId, chapter };
  } catch {
    return null;
  }
}

export function isCuvChapterAudioEffectiveSrc(src: string): boolean {
  return tryParseCuvChapterAudioEffectiveSrc(src) !== null;
}
