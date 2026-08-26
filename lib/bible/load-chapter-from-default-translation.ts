import fs from "node:fs";
import { loadedChapterVerseFromRow, type LoadedChapterVerse } from "@/lib/bible/loaded-chapter-verse";
import type { ChapterSegment } from "@/lib/bible/load-chapter-segments";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { getScriptureDatabase, scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";
import { resolveBibleTranslationMeta } from "@/lib/bible/providers/registry";
import { loadApiBibleChapterRows } from "@/lib/bible/providers/api-bible";
import { loadEsvChapterRows } from "@/lib/bible/providers/esv";
import { loadYouVersionChapterRows } from "@/lib/bible/providers/youversion";
import { translationUsesYouVersionChapterAudio } from "@/lib/bible/youversion-chapter-audio";
import { readTranslationsIndexSync, resolveTranslationAbsolutePath } from "@/lib/bible/translations-store";
import { SELAH_BIBLE_FORMAT, type BibleTranslationMeta } from "@/lib/bible/translations-types";

export type { LoadedChapterVerse };

export type LoadedChapter = {
  translationId: string;
  labelZh: string;
  labelEn: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: LoadedChapterVerse[];
  segments?: ChapterSegment[] | null;
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
  verses: LoadedChapterVerse[],
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

type RemoteChapterLoadResult = {
  verses: Array<{ verse: number; text: string }>;
  segments?: ChapterSegment[] | null;
};

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
    "SELECT verse, text, speech_spans, flags, theme_repeat_count FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse ASC",
  );
  const verses: LoadedChapterVerse[] = [];
  try {
    stmt.bind([bookId, ch]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      const loaded = loadedChapterVerseFromRow({
        verse: Number(row.verse),
        text: String(row.text ?? ""),
        speech_spans: String(row.speech_spans ?? ""),
        flags: Number(row.flags ?? 0),
        theme_repeat_count: Number(row.theme_repeat_count ?? 0),
      });
      if (loaded) verses.push(loaded);
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
    .map((k) => {
      const text = chMap[k];
      if (typeof text !== "string" || !text.trim()) return null;
      return loadedChapterVerseFromRow({
        verse: Number(k),
        text,
        speech_spans: "",
        flags: 0,
        theme_repeat_count: 0,
      });
    })
    .filter((x): x is LoadedChapterVerse => x != null)
    .sort((a, b) => a.verse - b.verse);

  return loadedChapterFromParts(tid, meta, bookId, bookName, ch, verses);
}

async function loadChapterFromRemoteProvider(
  meta: BibleTranslationMeta,
  bookId: string,
  chapter: number,
): Promise<RemoteChapterLoadResult | null> {
  if (meta.provider === "youversion" || translationUsesYouVersionChapterAudio(meta.id)) {
    const verses = await loadYouVersionChapterRows(meta, bookId, chapter);
    if (verses?.length) return { verses };
  }
  if (meta.provider === "api-bible") {
    const verses = await loadApiBibleChapterRows(meta, bookId, chapter);
    if (!verses?.length) return null;
    return { verses };
  }
  if (meta.provider === "esv") {
    const verses = await loadEsvChapterRows(meta, bookId, chapter);
    if (!verses?.length) return null;
    return { verses };
  }
  return null;
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

  const meta = resolveBibleTranslationMeta(cwd, tid);
  if (!meta) return null;
  if (meta.enabled === false) return null;

  if (meta.provider && meta.provider !== "local") {
    const remote = await loadChapterFromRemoteProvider(meta, id, ch);
    if (remote?.verses?.length) {
      const verses = remote.verses
        .map((row) =>
          loadedChapterVerseFromRow({
            verse: row.verse,
            text: row.text,
            speech_spans: "",
            flags: 0,
            theme_repeat_count: 0,
          }),
        )
        .filter((row): row is LoadedChapterVerse => row != null);
      if (verses.length > 0) {
        return {
          translationId: tid,
          labelZh: meta.labelZh,
          labelEn: meta.labelEn,
          bookId: id,
          bookName: bookMeta.bookName,
          chapter: ch,
          verses,
          segments: remote.segments ?? undefined,
        };
      }
    }
  }

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
