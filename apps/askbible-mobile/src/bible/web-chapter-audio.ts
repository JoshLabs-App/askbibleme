import { resolveBundledChapterAudioUri } from "./bundled-chapter-audio";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";

export const WEB_CHAPTER_AUDIO_REMOTE_NT = "https://theaudiopower.org/WEB/Recordings";
export const WEB_CHAPTER_AUDIO_REMOTE_OT = "https://theaudiopower.org/WEB2/Recordings";
export const WEB_CHAPTER_AUDIO_SUBDIR = "web-en";
export const BLM_ES_CHAPTER_AUDIO_REMOTE_BASE = "https://ebible.org/spablm/mp3";
export const BLM_ES_CHAPTER_AUDIO_SUBDIR = "blm-es";

const WEB_AUDIO_BOOK_NAME_OVERRIDES: Record<string, string> = {
  PSA: "Psalms",
  SNG: "Song of Solomon",
};

const BOOK_NAME_EN: Record<string, string> = {
  GEN: "Genesis",
  EXO: "Exodus",
  LEV: "Leviticus",
  NUM: "Numbers",
  DEU: "Deuteronomy",
  JOS: "Joshua",
  JDG: "Judges",
  RUT: "Ruth",
  "1SA": "1 Samuel",
  "2SA": "2 Samuel",
  "1KI": "1 Kings",
  "2KI": "2 Kings",
  "1CH": "1 Chronicles",
  "2CH": "2 Chronicles",
  EZR: "Ezra",
  NEH: "Nehemiah",
  EST: "Esther",
  JOB: "Job",
  PSA: "Psalm",
  PRO: "Proverbs",
  ECC: "Ecclesiastes",
  SNG: "Song of Songs",
  ISA: "Isaiah",
  JER: "Jeremiah",
  LAM: "Lamentations",
  EZK: "Ezekiel",
  DAN: "Daniel",
  HOS: "Hosea",
  JOL: "Joel",
  AMO: "Amos",
  OBA: "Obadiah",
  JON: "Jonah",
  MIC: "Micah",
  NAM: "Nahum",
  HAB: "Habakkuk",
  ZEP: "Zephaniah",
  HAG: "Haggai",
  ZEC: "Zechariah",
  MAL: "Malachi",
  MAT: "Matthew",
  MRK: "Mark",
  LUK: "Luke",
  JHN: "John",
  ACT: "Acts",
  ROM: "Romans",
  "1CO": "1 Corinthians",
  "2CO": "2 Corinthians",
  GAL: "Galatians",
  EPH: "Ephesians",
  PHP: "Philippians",
  COL: "Colossians",
  "1TH": "1 Thessalonians",
  "2TH": "2 Thessalonians",
  "1TI": "1 Timothy",
  "2TI": "2 Timothy",
  TIT: "Titus",
  PHM: "Philemon",
  HEB: "Hebrews",
  JAS: "James",
  "1PE": "1 Peter",
  "2PE": "2 Peter",
  "1JN": "1 John",
  "2JN": "2 John",
  "3JN": "3 John",
  JUD: "Jude",
  REV: "Revelation",
};

const OLD_TESTAMENT_MAX = 39;
const BOOK_NUMBER: Record<string, number> = {
  GEN: 1,
  EXO: 2,
  LEV: 3,
  NUM: 4,
  DEU: 5,
  JOS: 6,
  JDG: 7,
  RUT: 8,
  "1SA": 9,
  "2SA": 10,
  "1KI": 11,
  "2KI": 12,
  "1CH": 13,
  "2CH": 14,
  EZR: 15,
  NEH: 16,
  EST: 17,
  JOB: 18,
  PSA: 19,
  PRO: 20,
  ECC: 21,
  SNG: 22,
  ISA: 23,
  JER: 24,
  LAM: 25,
  EZK: 26,
  DAN: 27,
  HOS: 28,
  JOL: 29,
  AMO: 30,
  OBA: 31,
  JON: 32,
  MIC: 33,
  NAM: 34,
  HAB: 35,
  ZEP: 36,
  HAG: 37,
  ZEC: 38,
  MAL: 39,
  MAT: 40,
  MRK: 41,
  LUK: 42,
  JHN: 43,
  ACT: 44,
  ROM: 45,
  "1CO": 46,
  "2CO": 47,
  GAL: 48,
  EPH: 49,
  PHP: 50,
  COL: 51,
  "1TH": 52,
  "2TH": 53,
  "1TI": 54,
  "2TI": 55,
  TIT: 56,
  PHM: 57,
  HEB: 58,
  JAS: 59,
  "1PE": 60,
  "2PE": 61,
  "1JN": 62,
  "2JN": 63,
  "3JN": 64,
  JUD: 65,
  REV: 66,
};

export function translationUsesWebChapterAudio(translationId: string): boolean {
  const id = String(translationId || "")
    .trim()
    .toLowerCase();
  return id === "web-en" || id === "bbe-en" || id === "blm-es";
}

export function chapterAudioScopeForTranslation(translationId: string): string {
  const id = String(translationId || "")
    .trim()
    .toLowerCase();
  if (id === "web-en" || id === "bbe-en") return WEB_CHAPTER_AUDIO_SUBDIR;
  if (id === "blm-es") return BLM_ES_CHAPTER_AUDIO_SUBDIR;
  return WEB_CHAPTER_AUDIO_SUBDIR;
}

function webAudioBookNameEn(bookId: string): string {
  const id = bookId.toUpperCase();
  return WEB_AUDIO_BOOK_NAME_OVERRIDES[id] ?? BOOK_NAME_EN[id] ?? id;
}

function webRemoteBase(bookId: string): string {
  const n = BOOK_NUMBER[bookId.toUpperCase()];
  return n != null && n <= OLD_TESTAMENT_MAX
    ? WEB_CHAPTER_AUDIO_REMOTE_OT
    : WEB_CHAPTER_AUDIO_REMOTE_NT;
}

export function buildLocalWebChapterAudioUrl(
  bookId: string,
  chapter: number,
  translationId: string = "web-en",
): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  const scope = chapterAudioScopeForTranslation(translationId);
  return `/audio/${scope}/${id}-${chapter}.mp3`;
}

const BLM_ES_CANONICAL_ALIAS: Record<string, string> = {
  ECC: "ECL",
  NAM: "NAH",
  ZEC: "ZAC",
  PHM: "FLM",
};

function blmEsAudioBookOrdinal(bookId: string): number | null {
  const n = BOOK_NUMBER[bookId.toUpperCase()];
  if (!n) return null;
  // spablm 音频目录包含次经，NT 从 70 开始编号。
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
  const tid = String(translationId || "")
    .trim()
    .toLowerCase();
  if (tid === "blm-es") {
    return buildExternalBlmEsChapterAudioUrl(bookId, chapter);
  }
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  const name = webAudioBookNameEn(id);
  return `${webRemoteBase(id)}/${encodeURIComponent(`${name} ${chapter}`)}.mp3`;
}

export async function resolveWebChapterAudioPlayableSrc(args: {
  baseUrl: string;
  translationId: string;
  bookId: string;
  chapter: number;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const bundled = isMobileBundledOnly()
    ? resolveBundledChapterAudioUri({
        translationId: args.translationId,
        bookId: args.bookId,
        chapter: args.chapter,
      })
    : null;
  if (bundled) return { ok: true, src: bundled };
  return { ok: false };
}
