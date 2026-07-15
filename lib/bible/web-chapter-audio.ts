/**
 * WEB / KJV / BLM-ES 整章朗读。
 * - 默认：theaudiopower.org / ebible.org 原始站点
 * - 可选自托管：`/audio/{scope}/{BOOK}-{chapter}.mp3`
 */

import {
  webpChapterAudioUrl,
} from "@/lib/bible/web-chapter-audio-book-names";
import {
  buildAudioTreasureKjvChapterUrl,
  KJV_CHAPTER_AUDIO_REMOTE_BASE,
} from "@/lib/bible/kjv-chapter-audio-url";

export const WEB_CHAPTER_AUDIO_SUBDIR = "web-en";
export const BLM_ES_CHAPTER_AUDIO_SUBDIR = "blm-es";
export const BLM_ES_CHAPTER_AUDIO_REMOTE_BASE = "https://ebible.org/spablm/mp3";
export const KJV_CHAPTER_AUDIO_SUBDIR = "kjv";
export { KJV_CHAPTER_AUDIO_REMOTE_BASE };

const BLM_ES_CANONICAL_ALIAS: Record<string, string> = {
  ECC: "ECL",
  NAM: "NAH",
  ZEC: "ZAC",
  PHM: "FLM",
};

const OLD_TESTAMENT_MAX = 39;
const BOOK_NUMBER: Record<string, number> = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8,
  "1SA": 9, "2SA": 10, "1KI": 11, "2KI": 12, "1CH": 13, "2CH": 14,
  EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19, PRO: 20, ECC: 21, SNG: 22,
  ISA: 23, JER: 24, LAM: 25, EZK: 26, DAN: 27, HOS: 28, JOL: 29, AMO: 30,
  OBA: 31, JON: 32, MIC: 33, NAM: 34, HAB: 35, ZEP: 36, HAG: 37, ZEC: 38, MAL: 39,
  MAT: 40, MRK: 41, LUK: 42, JHN: 43, ACT: 44, ROM: 45, "1CO": 46, "2CO": 47,
  GAL: 48, EPH: 49, PHP: 50, COL: 51, "1TH": 52, "2TH": 53, "1TI": 54, "2TI": 55,
  TIT: 56, PHM: 57, HEB: 58, JAS: 59, "1PE": 60, "2PE": 61, "1JN": 62, "2JN": 63,
  "3JN": 64, JUD: 65, REV: 66,
};

export function translationUsesWebChapterAudio(translationId: string): boolean {
  const id = String(translationId || "").trim().toLowerCase();
  return id === "web-en" || id === "kjv" || id === "blm-es";
}

export function translationUsesKjvChapterAudio(translationId: string): boolean {
  return String(translationId || "").trim().toLowerCase() === "kjv";
}

export function chapterAudioScopeForTranslation(translationId: string): string {
  const id = String(translationId || "").trim().toLowerCase();
  if (id === "blm-es") return BLM_ES_CHAPTER_AUDIO_SUBDIR;
  if (id === "kjv") return KJV_CHAPTER_AUDIO_SUBDIR;
  return WEB_CHAPTER_AUDIO_SUBDIR;
}

export function isWebChapterAudioSelfHosted(): boolean {
  return (
    process.env.NEXT_PUBLIC_WEB_CHAPTER_AUDIO_SELF_HOSTED === "1" ||
    process.env.WEB_CHAPTER_AUDIO_SELF_HOSTED === "1" ||
    process.env.NEXT_PUBLIC_CUV_CHAPTER_AUDIO_SELF_HOSTED === "1" ||
    process.env.CUV_CHAPTER_AUDIO_SELF_HOSTED === "1"
  );
}

function blmEsAudioBookOrdinal(bookId: string): number | null {
  const n = BOOK_NUMBER[bookId.toUpperCase()];
  if (!n) return null;
  return n <= OLD_TESTAMENT_MAX ? n : n + 30;
}

function buildExternalBlmEsChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  const ordinal = blmEsAudioBookOrdinal(id);
  if (!ordinal || !Number.isInteger(chapter) || chapter < 1) return "";
  if (id === "PSA") return "";
  const remoteBook = BLM_ES_CANONICAL_ALIAS[id] ?? id;
  const ord = String(ordinal).padStart(2, "0");
  const ch = String(chapter).padStart(2, "0");
  return `${BLM_ES_CHAPTER_AUDIO_REMOTE_BASE}/spablm_${ord}_${remoteBook}_${ch}.mp3`;
}

export function buildExternalWebChapterAudioUrl(
  bookId: string,
  chapter: number,
  translationId: string = "web-en",
): string {
  const tid = String(translationId || "").trim().toLowerCase();
  if (tid === "blm-es") return buildExternalBlmEsChapterAudioUrl(bookId, chapter);
  if (tid === "kjv") return buildAudioTreasureKjvChapterUrl(bookId, chapter);
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return webpChapterAudioUrl(id, chapter);
}

export function buildLocalWebChapterAudioUrl(
  bookId: string,
  chapter: number,
  translationId: string = "web-en",
): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  // WEBP / KJV 均只引用原始公开站点，不在 AskBible.me 保存副本。
  const tid = String(translationId || "").trim().toLowerCase();
  if (tid === "web-en" || translationUsesKjvChapterAudio(tid)) return "";
  const scope = chapterAudioScopeForTranslation(translationId);
  return `/audio/${scope}/${id}-${chapter}.mp3`;
}

export async function resolveWebChapterAudioPlayableSrc(args: {
  bookId: string;
  chapter: number;
  translationId?: string;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const translationId = args.translationId ?? "web-en";
  if (translationId === "web-en") {
    const remote = buildExternalWebChapterAudioUrl(args.bookId, args.chapter, translationId);
    return remote ? { ok: true, src: remote } : { ok: false };
  }
  if (translationUsesKjvChapterAudio(translationId)) {
    const remote = buildAudioTreasureKjvChapterUrl(args.bookId, args.chapter);
    return remote ? { ok: true, src: remote } : { ok: false };
  }
  if (!isWebChapterAudioSelfHosted()) {
    const remote = buildExternalWebChapterAudioUrl(args.bookId, args.chapter, translationId);
    if (remote) return { ok: true, src: remote };
  }

  const local = buildLocalWebChapterAudioUrl(args.bookId, args.chapter, translationId);
  if (!local) return { ok: false };

  if (isWebChapterAudioSelfHosted()) {
    try {
      const check = await fetch(local, { method: "HEAD", cache: "no-store" });
      if (check.ok) return { ok: true, src: local };
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }

  return { ok: true, src: local };
}
