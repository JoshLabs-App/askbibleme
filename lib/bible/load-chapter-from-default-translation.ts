import fs from "node:fs";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { getScriptureDatabase, scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";
import { readTranslationsIndexSync, resolveTranslationAbsolutePath } from "@/lib/bible/translations-store";
import { SELAH_BIBLE_FORMAT, type BibleTranslationMeta } from "@/lib/bible/translations-types";

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

function loadedChapterFromParts(
  tid: string,
  meta: BibleTranslationMeta,
  bookId: string,
  bookName: string,
  ch: number,
  verses: { verse: number; text: string }[],
): LoadedChapter | null {
  if (verses.length === 0) return null;
  return {
    translationId: tid,
    labelZh: meta.labelZh,
    labelEn: meta.labelEn,
    bookId,
    bookName,
    chapter: ch,
    verses,
  };
}

async function loadChapterFromSqlite(
  cwd: string,
  tid: string,
  bookId: string,
  ch: number,
  meta: BibleTranslationMeta,
  bookName: string,
): Promise<LoadedChapter | null> {
  if (!fs.existsSync(scriptureSqlitePath(cwd, tid))) return null;
  const db = await getScriptureDatabase(cwd, tid);
  if (!db) return null;

  const stmt = db.prepare(
    "SELECT verse, text FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse ASC",
  );
  const verses: { verse: number; text: string }[] = [];
  try {
    stmt.bind([bookId, ch]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      const verse = Number(row.verse);
      const text = String(row.text ?? "");
      if (Number.isInteger(verse) && verse >= 1 && text.trim()) verses.push({ verse, text });
    }
  } finally {
    stmt.free();
  }

  return loadedChapterFromParts(tid, meta, bookId, bookName, ch, verses);
}

function loadChapterFromJsonSync(
  cwd: string,
  tid: string,
  bookId: string,
  ch: number,
  meta: BibleTranslationMeta,
  bookName: string,
): LoadedChapter | null {
  const abs = resolveTranslationAbsolutePath(cwd, tid);
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
  const chMap = raw.books[bookId]?.[String(ch)];
  if (!chMap || typeof chMap !== "object") return null;

  const verses = Object.keys(chMap)
    .map((k) => ({ verse: Number(k), text: chMap[k] }))
    .filter((x) => Number.isInteger(x.verse) && x.verse >= 1 && typeof x.text === "string" && x.text.trim())
    .sort((a, b) => a.verse - b.verse);

  return loadedChapterFromParts(tid, meta, bookId, bookName, ch, verses);
}

/**
 * 从指定译本读取一章（服务端）：优先 `data/bible/sqlite/{id}.sqlite`，否则回退 `uploads/{id}.json`。
 */
export async function loadChapterFromTranslation(
  cwd: string,
  bookId: string,
  chapter: number,
  translationId: string,
): Promise<LoadedChapter | null> {
  const id = String(bookId || "").trim().toUpperCase();
  const tid = String(translationId || "").trim();
  if (!BOOK_RE.test(id) || !tid) return null;
  const bookMeta = scriptureBooks.find((b) => b.bookId === id);
  if (!bookMeta) return null;
  const ch = Number(chapter);
  if (!Number.isInteger(ch) || ch < 1 || ch > bookMeta.chapters) return null;

  const index = readTranslationsIndexSync(cwd);
  const meta = index.translations.find((t) => t.id === tid);
  if (!meta) return null;

  if (fs.existsSync(scriptureSqlitePath(cwd, tid))) {
    const fromSql = await loadChapterFromSqlite(cwd, tid, id, ch, meta, bookMeta.bookName);
    if (fromSql) return fromSql;
  }

  return loadChapterFromJsonSync(cwd, tid, id, ch, meta, bookMeta.bookName);
}

/** 从默认译本读取一章（服务端）。 */
export async function loadChapterFromDefaultTranslation(bookId: string, chapter: number): Promise<LoadedChapter | null> {
  const cwd = process.cwd();
  const index = readTranslationsIndexSync(cwd);
  const translationId = index.defaultTranslationId ?? index.translations[0]?.id ?? null;
  if (!translationId) return null;
  return loadChapterFromTranslation(cwd, bookId, chapter, translationId);
}
