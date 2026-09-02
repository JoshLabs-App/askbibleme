import { resolveBundledChapterAudioUri } from "./bundled-chapter-audio";
import { isMobileScriptureAudioStreamAllowed } from "../config/mobileBundledOnly";
import {
  buildExternalTeochewNtChapterAudioUrl,
  resolveTeochewNtChapterAudioPlayableSrc,
  teochewNtVoiceActive,
} from "./teochew-nt-audio";
import {
  effectiveVoiceForBook,
  type CuvChapterAudioVoiceId,
  voiceSupportsBook,
} from "./cuv-chapter-audio-voices";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export const CUV_CHAPTER_AUDIO_REMOTE_BASE = "https://media.fhl.net/unvdavid";

export function translationSupportsCuvChapterAudio(translationId: string): boolean {
  return String(translationId || "")
    .trim()
    .toLowerCase()
    .startsWith("cuv");
}

export function buildExternalCuvChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  const meta = scriptureBooks.find((b) => b.bookId === id);
  if (!meta) return "";
  const bid = meta.bookNumber;
  return `${CUV_CHAPTER_AUDIO_REMOTE_BASE}/${bid}/${bid}_${String(chapter).padStart(3, "0")}.mp3`;
}

export { buildExternalTeochewNtChapterAudioUrl } from "./teochew-nt-audio";

export async function resolveCuvChapterAudioPlayableSrc(args: {
  baseUrl: string;
  bookName: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);

  // 潮语：只引用 TSTSCC，跳过本站 bundled / 自托管
  if (teochewNtVoiceActive(voice)) {
    return resolveTeochewNtChapterAudioPlayableSrc({
      bookId: args.bookId,
      chapter: args.chapter,
      baseUrl: args.baseUrl,
    });
  }

  const bundled = resolveBundledChapterAudioUri({
    translationId: "cuv-simp",
    bookId: args.bookId,
    chapter: args.chapter,
    voiceId: args.voiceId,
  });
  if (bundled) return { ok: true, src: bundled };

  if (!voiceSupportsBook(voice, args.bookId)) return { ok: false };

  if (!isMobileScriptureAudioStreamAllowed()) return { ok: false };

  // 与 Web 一致：中文默认 FHL 闫大卫（unvdavid），不经 askbible.me 转发。
  const remote = buildExternalCuvChapterAudioUrl(args.bookId, args.chapter);
  return remote ? { ok: true, src: remote } : { ok: false };
}

export function scriptureAudioUrlsEqual(a: string, b: string): boolean {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  return left === right;
}
