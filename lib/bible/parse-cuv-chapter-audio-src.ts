import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import { chineseBookNameToBookId } from "@/lib/bible/chinese-book-name-to-id";
import { englishBookNameToBookId } from "@/lib/bible/english-book-name-to-id";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { WEB_CHAPTER_AUDIO_SUBDIR } from "@/lib/bible/web-chapter-audio";

const LOCAL_TEOCHEW = /\/audio\/teochew-nt\/([A-Za-z0-9]{2,8})-(\d+)\.mp3(\?|#|$)/i;
const LOCAL_WEB = new RegExp(
  `/audio/${WEB_CHAPTER_AUDIO_SUBDIR}/([A-Za-z0-9]{2,8})-(\\d+)\\.mp3(\\?|#|$)`,
  "i",
);
const LOCAL_MANDARIN = /\/audio\/([A-Za-z0-9]{2,8})-(\d+)\.mp3(\?|#|$)/i;
const LOCAL_MANDARIN_V20 = /\/audio\/cuv-v20\/([A-Za-z0-9]{2,8})-(\d+)\.mp3(\?|#|$)/i;
const FHL_UNVDAVID = /media\.fhl\.net\/unvdavid\/(\d{1,2})\/\1_(\d{3})\.mp3(\?|#|$)/i;

const BOOK_ID_RE = /^[A-Z0-9]{2,8}$/;
const BID_TO_BOOK_ID = new Map(scriptureBooks.map((b) => [b.bookNumber, b.bookId]));
const KJV_AUDIOTREASURE = /audiotreasure\.com\/content\/KJV_AT\/(\d{2})_?.*?(\d{3})\.mp3(?:\?|#|$)/i;
const KJV_AUDIOTREASURE_SINGLE_CHAPTER =
  /audiotreasure\.com\/content\/KJV_AT\/(57|63|64|65)_[^/]+\.mp3(?:\?|#|$)/i;

export type ParsedCuvChapterAudioSrc = {
  bookId: string;
  chapter: number;
  voiceId: CuvChapterAudioVoiceId;
  /** 英文音轨；否则为和合本/潮州。 */
  webAudio?: boolean;
  /** 音频实际对应的译本；用于连续播放时保持同一录音版本。 */
  audioTranslationId?: string;
};

function parseLocalBookChapter(
  bookId: string,
  chapter: number,
  voiceId: CuvChapterAudioVoiceId,
  webAudio = false,
): ParsedCuvChapterAudioSrc | null {
  if (!BOOK_ID_RE.test(bookId) || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId, chapter, voiceId, webAudio };
}

/**
 * 从壳层当前播放 URL 解析整章朗读对应的书卷、章与人声（本地 `/audio/…`、FHL、或历史 theaudiopower）。
 */
export function tryParseCuvChapterAudioEffectiveSrc(src: string): ParsedCuvChapterAudioSrc | null {
  const s = String(src || "").trim();
  if (!s) return null;

  const teochew = s.match(LOCAL_TEOCHEW);
  if (teochew) {
    return parseLocalBookChapter(teochew[1]!.toUpperCase(), Number(teochew[2]), "teochew-nt");
  }

  const web = s.match(LOCAL_WEB);
  if (web) {
    return parseLocalBookChapter(web[1]!.toUpperCase(), Number(web[2]), "mandarin", true);
  }

  const mandarin = s.match(LOCAL_MANDARIN);
  if (mandarin) {
    return parseLocalBookChapter(mandarin[1]!.toUpperCase(), Number(mandarin[2]), "mandarin");
  }

  const mandarinV20 = s.match(LOCAL_MANDARIN_V20);
  if (mandarinV20) {
    return parseLocalBookChapter(mandarinV20[1]!.toUpperCase(), Number(mandarinV20[2]), "mandarin");
  }

  const fhl = s.match(FHL_UNVDAVID);
  if (fhl) {
    const bid = Number(fhl[1]);
    const chapter = Number(fhl[2]);
    const bookId = BID_TO_BOOK_ID.get(bid);
    if (!bookId) return null;
    return parseLocalBookChapter(bookId, chapter, "mandarin");
  }

  const kjv = s.match(KJV_AUDIOTREASURE);
  if (kjv) {
    const bookId = BID_TO_BOOK_ID.get(Number(kjv[1]));
    if (!bookId) return null;
    const parsed = parseLocalBookChapter(bookId, Number(kjv[2]), "mandarin", true);
    return parsed ? { ...parsed, audioTranslationId: "kjv" } : null;
  }

  const kjvSingleChapter = s.match(KJV_AUDIOTREASURE_SINGLE_CHAPTER);
  if (kjvSingleChapter) {
    const bookId = BID_TO_BOOK_ID.get(Number(kjvSingleChapter[1]));
    if (!bookId) return null;
    const parsed = parseLocalBookChapter(bookId, 1, "mandarin", true);
    return parsed ? { ...parsed, audioTranslationId: "kjv" } : null;
  }

  if (s.includes("theaudiopower.org/WEB/") || s.includes("theaudiopower.org/WEB2/")) {
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
      const bookId = englishBookNameToBookId(bookName);
      if (!bookId) return null;
      return parseLocalBookChapter(bookId, chapter, "mandarin", true);
    } catch {
      return null;
    }
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
