import fs from "node:fs";
import type { Database } from "sql.js";
import {
  invalidateReaderVerseThemesDbCache,
  readerVerseThemesSqlitePath,
} from "@/lib/scripture/reader-verse-themes-db";
import { invalidateVerseRepeatRankMetaCache } from "@/lib/scripture/reader-verse-repeat-rank";
import {
  parseVerseRepeatRankRowKey,
  verseRepeatRankRowKey,
  type VerseCoord,
} from "@/lib/scripture/verse-repeat-rank-keys";

export type { VerseCoord } from "@/lib/scripture/verse-repeat-rank-keys";
export { parseVerseRepeatRankRowKey, verseRepeatRankRowKey };

function uniqueCoords(coords: VerseCoord[]): VerseCoord[] {
  const seen = new Set<string>();
  const out: VerseCoord[] = [];
  for (const c of coords) {
    const key = verseRepeatRankRowKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** 删除主题库中所有包含该节的陈列行（同节跨标签一并移除）。 */
export function deleteVersesFromReaderThemeLibrary(
  db: Database,
  coords: VerseCoord[],
): { deletedRows: number; deletedVerses: number } {
  const unique = uniqueCoords(coords);
  if (unique.length === 0) return { deletedRows: 0, deletedVerses: 0 };

  const stmt = db.prepare(`
    DELETE FROM verse
    WHERE UPPER(TRIM(book_id)) = ?
      AND chapter_start = ?
      AND chapter_end = ?
      AND verse_start <= ?
      AND verse_end >= ?
  `);

  let deletedRows = 0;
  for (const c of unique) {
    stmt.bind([c.bookId, c.chapter, c.chapter, c.verse, c.verse]);
    stmt.step();
    deletedRows += db.getRowsModified();
    stmt.reset();
  }
  stmt.free();

  return { deletedRows, deletedVerses: unique.length };
}

export function persistReaderVerseThemesDatabase(cwd: string, db: Database): void {
  const abs = readerVerseThemesSqlitePath(cwd);
  fs.writeFileSync(abs, Buffer.from(db.export()));
  invalidateReaderVerseThemesDbCache();
  invalidateVerseRepeatRankMetaCache();
}
