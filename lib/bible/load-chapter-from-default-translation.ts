import fs from "node:fs";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { readTranslationsIndexSync, resolveTranslationAbsolutePath } from "@/lib/bible/translations-store";
import { SELAH_BIBLE_FORMAT } from "@/lib/bible/translations-types";

export type LoadedChapter = {
  translationId: string;
  labelZh: string;
  labelEn: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: { verse: number; text: string }[];
};

const BOOK_RE = /^[A-Z0-9]{2,8}$/;

function isSelahBiblePayload(v: unknown): v is { format?: string; books: Record<string, Record<string, Record<string, string>>> } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.books === "object" && o.books !== null && !Array.isArray(o.books);
}

/** 从默认译本 JSON 读取一章（服务端）。若无译本或缺章则返回 null。 */
export function loadChapterFromDefaultTranslation(bookId: string, chapter: number): LoadedChapter | null {
  const id = String(bookId || "").trim().toUpperCase();
  if (!BOOK_RE.test(id)) return null;
  const bookMeta = scriptureBooks.find((b) => b.bookId === id);
  if (!bookMeta) return null;
  const ch = Number(chapter);
  if (!Number.isInteger(ch) || ch < 1 || ch > bookMeta.chapters) return null;

  const cwd = process.cwd();
  const index = readTranslationsIndexSync(cwd);
  const translationId = index.defaultTranslationId ?? index.translations[0]?.id ?? null;
  if (!translationId) return null;

  const meta = index.translations.find((t) => t.id === translationId);
  if (!meta) return null;

  const abs = resolveTranslationAbsolutePath(cwd, translationId);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
  if (!isSelahBiblePayload(raw)) return null;
  if (raw.format !== undefined && raw.format !== SELAH_BIBLE_FORMAT) {
    return null;
  }
  const chMap = raw.books[id]?.[String(ch)];
  if (!chMap || typeof chMap !== "object") return null;

  const verses = Object.keys(chMap)
    .map((k) => ({ verse: Number(k), text: chMap[k] }))
    .filter((x) => Number.isInteger(x.verse) && x.verse >= 1 && typeof x.text === "string" && x.text.trim())
    .sort((a, b) => a.verse - b.verse);

  if (verses.length === 0) return null;

  return {
    translationId,
    labelZh: meta.labelZh,
    labelEn: meta.labelEn,
    bookId: id,
    bookName: bookMeta.bookName,
    chapter: ch,
    verses,
  };
}
