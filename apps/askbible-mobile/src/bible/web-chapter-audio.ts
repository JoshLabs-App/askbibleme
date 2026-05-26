import { resolveBundledChapterAudioUri } from "./bundled-chapter-audio";
import { absoluteSelfHostedChapterAudioUrl } from "./chapter-audio-url";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";

export const WEB_CHAPTER_AUDIO_REMOTE_NT = "https://theaudiopower.org/WEB/Recordings";
export const WEB_CHAPTER_AUDIO_REMOTE_OT = "https://theaudiopower.org/WEB2/Recordings";
export const WEB_CHAPTER_AUDIO_SUBDIR = "web-en";

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
  return id === "web-en" || id === "bbe-en";
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

export function buildLocalWebChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return `/audio/${WEB_CHAPTER_AUDIO_SUBDIR}/${id}-${chapter}.mp3`;
}

export function buildExternalWebChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  const name = webAudioBookNameEn(id);
  return `${webRemoteBase(id)}/${encodeURIComponent(`${name} ${chapter}`)}.mp3`;
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

export async function resolveWebChapterAudioPlayableSrc(args: {
  baseUrl: string;
  bookId: string;
  chapter: number;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const bundled = isMobileBundledOnly()
    ? resolveBundledChapterAudioUri({
        translationId: "web-en",
        bookId: args.bookId,
        chapter: args.chapter,
      })
    : null;
  if (bundled) return { ok: true, src: bundled };
  const remote = buildExternalWebChapterAudioUrl(args.bookId, args.chapter);

  const local = buildLocalWebChapterAudioUrl(args.bookId, args.chapter);
  if (!local) return { ok: false };

  const localHit = await headOk(args.baseUrl, local);
  if (localHit) return { ok: true, src: localHit };

  const trusted = absoluteSelfHostedChapterAudioUrl(args.baseUrl, local);
  if (trusted && (await probeChapterAudioUrl(trusted))) {
    return { ok: true, src: trusted };
  }

  if (!remote) return { ok: false };
  return { ok: true, src: remote };
}
