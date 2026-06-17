import { Platform } from "react-native";
import { scriptureBooks, testamentForBookNumber } from "../bible/scripture-books";
import type { ScriptureCanonCatalogSection } from "./canonCatalog";

export const READ_CHAPTER_SCROLL_TOP_PAD = 72;
export const READ_VERSE_NUM_BODY_GAP = Platform.OS === "android" ? "\u2003" : "\u2002";
export const READ_SETTINGS_TOP_OFFSET = 6;
export const READ_TOP_ACTION_SIZE = 44;
export const READ_TOP_ACTION_GAP = 1;
export const READ_TOP_ACTION_IDLE_OPACITY = Platform.OS === "android" ? 0.72 : 0.5;
export const READ_TOP_ACTION_PRESSED_OPACITY = Platform.OS === "android" ? 0.88 : 0.68;
export const INFO_EDITION_V1_EN_ROLE_ID = "info_edition_v1_en";
export const INFO_EDITION_GUIDE_V2_EN_ROLE_ID = "role_guide_v2_en";
export const JUMP_CATALOG_VIEWPORT_H = 460;

export function parseChapterParam(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function parseBookIdParam(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return String(s || "").trim().toUpperCase();
}

export function buildFallbackCatalogSections(tx: (key: string) => string): ScriptureCanonCatalogSection[] {
  const oldBooks = scriptureBooks
    .filter((book) => testamentForBookNumber(book.bookNumber) === "old")
    .map((book) => ({
      bookId: book.bookId,
      bookNumber: book.bookNumber,
      bookName: book.bookName,
      divine: "",
      summary: "",
    }));
  const newBooks = scriptureBooks
    .filter((book) => testamentForBookNumber(book.bookNumber) === "new")
    .map((book) => ({
      bookId: book.bookId,
      bookNumber: book.bookNumber,
      bookName: book.bookName,
      divine: "",
      summary: "",
    }));
  return [
    {
      sectionId: "fallback-old-testament",
      order: 1,
      title: tx("pages.read.catalogTestamentOld"),
      taglines: [],
      books: oldBooks,
    },
    {
      sectionId: "fallback-new-testament",
      order: 2,
      title: tx("pages.read.catalogTestamentNew"),
      taglines: [],
      books: newBooks,
    },
  ];
}

export type VerseActionMenuState = { verse: number; text: string } | null;
export type VerseHighlightMap = Map<number, string>;
export type ChapterHighlightMap = Map<number, VerseHighlightMap>;

export function cloneHighlightMap(input: ChapterHighlightMap): ChapterHighlightMap {
  const out = new Map<number, VerseHighlightMap>();
  for (const [verse, set] of input.entries()) {
    out.set(verse, new Map(set));
  }
  return out;
}

export type ContrastVerseLine = { translationId: string; text: string };
