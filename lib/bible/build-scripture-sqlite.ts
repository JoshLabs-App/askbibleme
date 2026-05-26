import fs from "node:fs";
import path from "node:path";
import { loadThemeRepeatCountMap } from "@/lib/bible/golden-verse-theme-repeat";
import { translationSupportsSpeechHighlight } from "@/lib/bible/infer-divine-speech-spans";
import { buildChapterVerseAnnotations } from "@/lib/bible/verse-annotations";
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
  options?: {
    themeRepeatCounts?: ReadonlyMap<string, number>;
    speechSpansByVerseKey?: ReadonlyMap<string, string>;
  },
): Promise<{ bytes: number; verseCount: number }> {
  const id = String(translationId || "").trim();
  if (!id) throw new Error("缺少 translationId。");

  const SQL = await getSqlJsStatic(cwd);
  const db = new SQL.Database();
  db.run(SCRIPTURE_SQLITE_SCHEMA_SQL);
  const insMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insMeta.run(["format", SELAH_SCRIPTURE_SQLITE_FORMAT]);
  insMeta.run(["annotations", "speech-spans-v1+theme-repeat-count-v1"]);
  insMeta.free();

  const themeRepeatCounts = options?.themeRepeatCounts ?? (await loadThemeRepeatCountMap(cwd));
  const speechSpansByVerseKey = options?.speechSpansByVerseKey;
  const speechHighlight = translationSupportsSpeechHighlight(id);

  const ins = db.prepare(
    "INSERT INTO verse (book_id, chapter, verse, text, speech_spans, flags, theme_repeat_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
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
        const verses = vKeys
          .map((vStr) => {
            const verse = Number(vStr);
            const text = vsObj[vStr];
            if (!Number.isInteger(verse) || verse < 1 || typeof text !== "string" || !text.trim()) {
              return null;
            }
            return { verse, text };
          })
          .filter((v): v is { verse: number; text: string } => v != null);

        const annotations = buildChapterVerseAnnotations({
          translationId: id,
          bookId,
          chapter: ch,
          verses,
          themeRepeatCounts,
          speechHighlight,
          speechSpansByVerseKey,
        });

        for (const v of verses) {
          const ann = annotations.get(v.verse) ?? { speechSpans: "", flags: 0, themeRepeatCount: 0 };
          ins.run([
            bookId,
            ch,
            v.verse,
            v.text,
            ann.speechSpans,
            ann.flags,
            ann.themeRepeatCount,
          ]);
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
