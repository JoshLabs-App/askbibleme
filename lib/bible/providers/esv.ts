import type { BibleTranslationMeta } from "@/lib/bible/translations-types";
import { parseRemoteChapterContent, type RemoteChapterVerseRow } from "@/lib/bible/providers/content-parser";

const ESV_API_BASE_URL = "https://api.esv.org/v3";
const ESV_API_KEY = process.env.ESV_API_KEY?.trim() || "";

const ESV_BOOK_NAMES: Record<string, string> = {
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
  PSA: "Psalms",
  PRO: "Proverbs",
  ECC: "Ecclesiastes",
  SNG: "Song of Solomon",
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

function esvChapterQuery(bookId: string, chapter: number): string | null {
  const name = ESV_BOOK_NAMES[String(bookId || "").trim().toUpperCase()];
  if (!name || !Number.isInteger(chapter) || chapter < 1) return null;
  return `${name} ${chapter}`;
}

async function esvFetchJson(url: string): Promise<unknown | null> {
  if (!ESV_API_KEY) return null;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Token ${ESV_API_KEY}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function decodeHtmlEntity(raw: string): string {
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(raw: string): string {
  return decodeHtmlEntity(
    String(raw || "")
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(p|div|section|article|header|footer|h[1-6]|li|tr|table)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function parseEsvHtmlChapterContent(raw: string): RemoteChapterVerseRow[] {
  const html = String(raw || "");
  const rows: RemoteChapterVerseRow[] = [];
  const verseRe =
    /<(?:span|b)[^>]*class="[^"]*(?:chapter-num|verse-num)[^"]*"[^>]*>(?:<sup[^>]*>)?(?:(?:\d+):)?(\d+)(?:<\/sup>)?[^<]*<\/(?:span|b)>([\s\S]*?)(?=<(?:span|b)[^>]*class="[^"]*(?:chapter-num|verse-num)[^"]*"|$)/gi;
  for (const match of html.matchAll(verseRe)) {
    const verse = Number(match[1]);
    const text = stripHtml(match[2] || "").replace(/\s+/g, " ").trim();
    if (Number.isInteger(verse) && verse > 0 && text) {
      rows.push({ verse, text });
    }
  }
  return rows.sort((a, b) => a.verse - b.verse);
}

export async function loadEsvChapterRows(
  _meta: BibleTranslationMeta,
  bookId: string,
  chapter: number,
): Promise<RemoteChapterVerseRow[] | null> {
  const query = esvChapterQuery(bookId, chapter);
  if (!query) return null;
  const url =
    `${ESV_API_BASE_URL}/passage/html/?q=${encodeURIComponent(query)}` +
    "&include-passage-references=false" +
    "&include-verse-numbers=true" +
    "&include-first-verse-numbers=true" +
    "&include-footnotes=false" +
    "&include-footnote-body=false" +
    "&include-headings=false" +
    "&include-short-copyright=false" +
    "&include-copyright=false";
  const json = (await esvFetchJson(url)) as { passages?: unknown } | null;
  const passages = Array.isArray(json?.passages) ? json?.passages : [];
  const html = typeof passages?.[0] === "string" ? passages[0] : "";
  if (html) {
    const rows = parseEsvHtmlChapterContent(html);
    if (rows.length > 0) return rows;
    const fallback = parseRemoteChapterContent(stripHtml(html));
    if (fallback.length > 0) return fallback;
  }
  return null;
}
