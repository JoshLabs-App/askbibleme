import type { ScriptureVerseXrefs, ScriptureXrefTarget } from "@/lib/bible/scripture-xref-types";
import { getScriptureXrefDatabase } from "@/lib/bible/scripture-xref-db";
import {
  isSafeStaticXrefBookId,
  staticXrefsBookRelPath,
  staticXrefsBookUrlPath,
  type StaticXrefsBookFile,
} from "@/lib/bible/static-xrefs-shape";

export type ScriptureVerseXrefsSerialized = ScriptureVerseXrefs;

function rowToTarget(
  bookId: string,
  chapter: number,
  verseStart: number,
  verseEnd: number,
  priority: number,
): ScriptureXrefTarget {
  return {
    bookId,
    chapter,
    verseStart,
    verseEnd: verseEnd >= verseStart ? verseEnd : verseStart,
    priority,
  };
}

/** 一卷 xref 很小，缓存住可让同一卷连续翻章不再重复取。 */
const MAX_CACHED_XREF_BOOKS = 8;
const xrefBookCache = new Map<string, StaticXrefsBookFile | null>();

function rememberXrefBook(bookId: string, file: StaticXrefsBookFile | null): void {
  if (xrefBookCache.size >= MAX_CACHED_XREF_BOOKS) {
    const oldest = xrefBookCache.keys().next().value;
    if (oldest !== undefined) xrefBookCache.delete(oldest);
  }
  xrefBookCache.set(bookId, file);
}

function parseXrefBookFile(raw: string): StaticXrefsBookFile | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StaticXrefsBookFile>;
    if (parsed?.v !== 1 || !parsed.c || typeof parsed.c !== "object") return null;
    return { v: 1, c: parsed.c as StaticXrefsBookFile["c"] };
  } catch {
    return null;
  }
}

/**
 * 静态产物（public/xrefs/…，由 npm run build:static-xrefs 生成）。
 * 与经文同样两条取数路径：有 fs 直接读，没有则 fetch 同域资源，好让同一份代码在
 * 迁移前后都能跑。取不到返回 null，调用方自动回落 sqlite。
 */
async function loadStaticChapterXrefs(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<ScriptureVerseXrefsSerialized[] | null> {
  if (!isSafeStaticXrefBookId(bookId)) return null;

  let file = xrefBookCache.get(bookId);
  if (file === undefined) {
    let raw: string | null = null;
    try {
      const [{ default: fsp }, { default: nodePath }] = await Promise.all([
        import("node:fs/promises"),
        import("node:path"),
      ]);
      raw = await fsp.readFile(nodePath.join(cwd, staticXrefsBookRelPath(bookId)), "utf8");
    } catch {
      raw = null;
    }
    if (raw === null) {
      const origin =
        process.env.STATIC_SCRIPTURE_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
      if (origin) {
        try {
          const res = await fetch(`${origin.replace(/\/$/, "")}${staticXrefsBookUrlPath(bookId)}`, {
            cache: "force-cache",
          });
          if (res.ok) raw = await res.text();
        } catch {
          raw = null;
        }
      }
    }
    file = raw ? parseXrefBookFile(raw) : null;
    /** 只记成功结果：raw 拿不到多半是网络/文件系统抖动，下次应该重试而不是永远落回 sqlite。 */
    if (file) rememberXrefBook(bookId, file);
  }
  if (!file) return null;
  /** 该卷有产物但本章没条目 = 本章确实没有 xref，返回 []，不要回落去重查一遍 sqlite。 */
  return file.c[String(chapter)] ?? [];
}

/**
 * Load curated cross-references for one chapter (server / build-time).
 * Returns `null` when sqlite is missing; `[]` when chapter has no xrefs.
 */
export async function loadChapterXrefs(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<ScriptureVerseXrefsSerialized[] | null> {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;

  const fromStatic = await loadStaticChapterXrefs(cwd, id, ch);
  if (fromStatic) return fromStatic;

  const db = await getScriptureXrefDatabase(cwd);
  if (!db) return null;

  const byVerse = new Map<number, ScriptureVerseXrefs>();

  const outStmt = db.prepare(
    `SELECT from_verse, to_book_id, to_chapter, to_verse_start, to_verse_end, priority
     FROM xref_out
     WHERE from_book_id = ? AND from_chapter = ?
     ORDER BY from_verse, priority DESC`,
  );
  outStmt.bind([id, ch]);
  while (outStmt.step()) {
    const row = outStmt.getAsObject() as Record<string, unknown>;
    const verse = Number(row.from_verse);
    const target = rowToTarget(
      String(row.to_book_id),
      Number(row.to_chapter),
      Number(row.to_verse_start),
      Number(row.to_verse_end),
      Number(row.priority),
    );
    let bucket = byVerse.get(verse);
    if (!bucket) {
      bucket = { verse, incoming: [], outgoing: [] };
      byVerse.set(verse, bucket);
    }
    bucket.outgoing.push(target);
  }
  outStmt.free();

  const inStmt = db.prepare(
    `SELECT to_verse, from_book_id, from_chapter, from_verse, priority
     FROM xref_in
     WHERE to_book_id = ? AND to_chapter = ?
     ORDER BY to_verse, priority DESC`,
  );
  inStmt.bind([id, ch]);
  while (inStmt.step()) {
    const row = inStmt.getAsObject() as Record<string, unknown>;
    const verse = Number(row.to_verse);
    const v = Number(row.from_verse);
    const target = rowToTarget(
      String(row.from_book_id),
      Number(row.from_chapter),
      v,
      v,
      Number(row.priority),
    );
    let bucket = byVerse.get(verse);
    if (!bucket) {
      bucket = { verse, incoming: [], outgoing: [] };
      byVerse.set(verse, bucket);
    }
    bucket.incoming.push(target);
  }
  inStmt.free();

  return [...byVerse.values()].sort((a, b) => a.verse - b.verse);
}
