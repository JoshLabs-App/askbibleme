import { resolveBundledChapterAudioUri } from "./bundled-chapter-audio";
import { absoluteSelfHostedChapterAudioUrl } from "./chapter-audio-url";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import {
  effectiveVoiceForBook,
  type CuvChapterAudioVoiceId,
} from "./cuv-chapter-audio-voices";
import { scriptureBooks } from "./scripture-books";

export const CUV_CHAPTER_AUDIO_REMOTE_BASE = "https://theaudiopower.org/CUV/Recordings";

export function translationSupportsCuvChapterAudio(translationId: string): boolean {
  return String(translationId || "")
    .trim()
    .toLowerCase()
    .startsWith("cuv");
}

export function buildExternalCuvChapterAudioUrl(bookName: string, chapter: number): string {
  const name = String(bookName || "").trim();
  if (!name || !Number.isInteger(chapter) || chapter < 1) return "";
  return `${CUV_CHAPTER_AUDIO_REMOTE_BASE}/${encodeURIComponent(`${name} ${chapter}`)}.mp3`;
}

export function buildLocalCuvChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return `/audio/${id}-${chapter}.mp3`;
}

export function buildLocalTeochewNtChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return `/audio/teochew-nt/${id}-${chapter}.mp3`;
}

/** theaudiopower CUV 文件名使用中文卷名，与界面 locale 无关 */
function cuvRemoteBookName(bookId: string, bookName: string): string {
  const meta = scriptureBooks.find((b) => b.bookId === String(bookId || "").trim().toUpperCase());
  return meta?.bookName ?? bookName;
}

async function probeChapterAudioUrl(absolute: string): Promise<boolean> {
  try {
    const head = await fetch(absolute, { method: "HEAD" });
    if (head.ok) return true;
  } catch {
    /* ignore */
  }
  try {
    const ranged = await fetch(absolute, { headers: { Range: "bytes=0-1" } });
    if (ranged.ok || ranged.status === 206) return true;
  } catch {
    /* ignore */
  }
  return false;
}

async function headOk(baseUrl: string, path: string): Promise<string | null> {
  const absolute = toAbsoluteUrl(baseUrl, path);
  if (!absolute) return null;
  const ok = await probeChapterAudioUrl(absolute);
  return ok ? absolute : null;
}

export async function resolveCuvChapterAudioPlayableSrc(args: {
  baseUrl: string;
  bookName: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const bundled = isMobileBundledOnly()
    ? resolveBundledChapterAudioUri({
        translationId: "cuv-simp",
        bookId: args.bookId,
        chapter: args.chapter,
        voiceId: args.voiceId,
      })
    : null;
  if (bundled) return { ok: true, src: bundled };

  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);

  if (voice === "teochew-nt") {
    const teochewLocal = buildLocalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
    if (teochewLocal) {
      const trusted = absoluteSelfHostedChapterAudioUrl(args.baseUrl, teochewLocal);
      if (trusted) return { ok: true, src: trusted };
      const hit = await headOk(args.baseUrl, teochewLocal);
      if (hit) return { ok: true, src: hit };
      const askBibleFallback = toAbsoluteUrl("https://askbible.me", teochewLocal);
      if (askBibleFallback) return { ok: true, src: askBibleFallback };
    }
    return { ok: false };
  }

  const local = buildLocalCuvChapterAudioUrl(args.bookId, args.chapter);
  if (!local) return { ok: false };

  const trusted = absoluteSelfHostedChapterAudioUrl(args.baseUrl, local);
  if (trusted) return { ok: true, src: trusted };

  const localHit = await headOk(args.baseUrl, local);
  if (localHit) return { ok: true, src: localHit };

  const askBibleFallback = toAbsoluteUrl("https://askbible.me", local);
  if (askBibleFallback) return { ok: true, src: askBibleFallback };

  const remote = buildExternalCuvChapterAudioUrl(
    cuvRemoteBookName(args.bookId, args.bookName),
    args.chapter,
  );
  if (!remote) return { ok: false };
  return { ok: true, src: remote };
}

export function scriptureAudioUrlsEqual(a: string, b: string): boolean {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  return left === right;
}
