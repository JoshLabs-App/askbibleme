import fs from "node:fs";
import {
  getReaderVerseThemesDatabase,
  readerVerseThemesSqlitePath,
} from "@/lib/scripture/reader-verse-themes-db";
import { verseAnnotationKey } from "@/lib/bible/verse-annotations";

export {
  MIN_GOLDEN_THEME_REPEAT_COUNT,
  verseShowsGoldenThemeMarker,
} from "@/lib/bible/golden-verse-theme-markers";

const THEME_REPEAT_COUNT_SQL = `
WITH RECURSIVE nums(n) AS (
  SELECT 0 UNION ALL SELECT n+1 FROM nums WHERE n < 250
),
hits AS (
  SELECT
    v.book_id AS book_id,
    v.chapter_start AS ch,
    v.verse_start + n.n AS verse
  FROM verse v
  JOIN nums n ON n.n <= (v.verse_end - v.verse_start)
  WHERE v.book_id IS NOT NULL AND TRIM(v.book_id) != ''
    AND v.chapter_start = v.chapter_end
    AND v.verse_start > 0
    AND v.verse_start <= v.verse_end
),
grouped AS (
  SELECT book_id, ch, verse, COUNT(*) AS repeat_count
  FROM hits
  GROUP BY book_id, ch, verse
)
SELECT book_id, ch, verse, repeat_count FROM grouped
`;

/** `GEN:1:1` → 主题库陈列次数；缺库或未收录为 0。 */
export async function loadThemeRepeatCountMap(cwd: string): Promise<Map<string, number>> {
  const abs = readerVerseThemesSqlitePath(cwd);
  if (!fs.existsSync(abs)) return new Map();

  const db = await getReaderVerseThemesDatabase(cwd);
  if (!db) return new Map();

  const map = new Map<string, number>();
  const stmt = db.prepare(THEME_REPEAT_COUNT_SQL);
  try {
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      const bookId = String(row.book_id ?? "").trim().toUpperCase();
      const ch = Number(row.ch);
      const verse = Number(row.verse);
      const repeatCount = Number(row.repeat_count);
      if (!bookId || !Number.isInteger(ch) || !Number.isInteger(verse) || verse < 1) continue;
      if (!Number.isInteger(repeatCount) || repeatCount < 1) continue;
      map.set(verseAnnotationKey(bookId, ch, verse), repeatCount);
    }
  } finally {
    stmt.free();
  }
  return map;
}
