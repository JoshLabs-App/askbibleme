import fs from "node:fs";
import path from "node:path";
import { getSqlJsStatic } from "@/lib/bible/sql-js-wasm";
import {
  invalidateScriptureSqliteCache,
  scriptureSqlitePath,
  SCRIPTURE_SQLITE_SCHEMA_SQL,
  SELAH_SCRIPTURE_SQLITE_FORMAT,
} from "@/lib/bible/scripture-sqlite-db";

export async function writeScriptureSqliteFromBooks(
  cwd: string,
  translationId: string,
  books: Record<string, Record<string, Record<string, string>>>,
): Promise<{ bytes: number; verseCount: number }> {
  const id = String(translationId || "").trim();
  if (!id) throw new Error("缺少 translationId。");

  const SQL = await getSqlJsStatic(cwd);
  const db = new SQL.Database();
  db.run(SCRIPTURE_SQLITE_SCHEMA_SQL);
  const insMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insMeta.run(["format", SELAH_SCRIPTURE_SQLITE_FORMAT]);
  insMeta.free();

  const ins = db.prepare("INSERT INTO verse (book_id, chapter, verse, text) VALUES (?, ?, ?, ?)");
  db.run("BEGIN TRANSACTION");
  let verseCount = 0;
  try {
    const bookIds = Object.keys(books).sort();
    for (const bookId of bookIds) {
      const chObj = books[bookId];
      if (!chObj || typeof chObj !== "object") continue;
      const chKeys = Object.keys(chObj).sort((a, b) => Number(a) - Number(b));
      for (const chStr of chKeys) {
        const ch = Number(chStr);
        if (!Number.isInteger(ch) || ch < 1) continue;
        const vsObj = chObj[chStr];
        if (!vsObj || typeof vsObj !== "object") continue;
        const vKeys = Object.keys(vsObj).sort((a, b) => Number(a) - Number(b));
        for (const vStr of vKeys) {
          const verse = Number(vStr);
          const text = vsObj[vStr];
          if (!Number.isInteger(verse) || verse < 1 || typeof text !== "string" || !text.trim()) continue;
          ins.run([bookId, ch, verse, text]);
          verseCount++;
        }
      }
    }
    db.run("COMMIT");
  } catch (e) {
    try {
      db.run("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    ins.free();
  }

  const outPath = scriptureSqlitePath(cwd, id);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const data = db.export();
  db.close();
  fs.writeFileSync(outPath, Buffer.from(data));
  invalidateScriptureSqliteCache(id);
  return { bytes: data.byteLength, verseCount };
}
