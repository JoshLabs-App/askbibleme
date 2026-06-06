/**
 * 从 `data/bible/uploads/{translationId}.json` 生成 `data/bible/sqlite/{translationId}.sqlite`。
 * 写入 `speech_spans`、`theme_repeat_count`（主题库陈列次数；≥3 次才标金句色带）。
 * 供 `npm run build`（prebuild）与本机 `npm run build:bible-sqlite` 使用。
 */
import fs from "node:fs";
import {
  loadThemeRepeatCountMap,
  MIN_GOLDEN_THEME_REPEAT_COUNT,
} from "../lib/bible/golden-verse-theme-repeat";
import { loadSpeechSpansSnapshot } from "../lib/bible/speech-spans-snapshot";
import { writeScriptureSqliteFromBooks } from "../lib/bible/build-scripture-sqlite";
import { scriptureSqlitePath } from "../lib/bible/scripture-sqlite-db";
import { readTranslationsIndex, resolveTranslationAbsolutePath } from "../lib/bible/translations-store";
import { parseAndValidateBiblePayload } from "../lib/bible/validate-bible-json";

async function main(): Promise<void> {
  const cwd = process.cwd();
  const index = await readTranslationsIndex(cwd);
  if (index.translations.length === 0) {
    console.error("[build-bible-sqlite] translations.json 中无译本，跳过。");
    return;
  }

  const themeRepeatCounts = await loadThemeRepeatCountMap(cwd);
  const speechSpansSnapshot = loadSpeechSpansSnapshot(cwd);
  let goldenMarked = 0;
  for (const c of themeRepeatCounts.values()) {
    if (c >= MIN_GOLDEN_THEME_REPEAT_COUNT) goldenMarked++;
  }
  console.error(
    `[build-bible-sqlite] theme verses: ${themeRepeatCounts.size}, golden marker (≥${MIN_GOLDEN_THEME_REPEAT_COUNT}): ${goldenMarked}`,
  );
  if (speechSpansSnapshot?.translations.size) {
    console.error(
      `[build-bible-sqlite] speech snapshot loaded (${speechSpansSnapshot.version}): ${speechSpansSnapshot.translations.size} translations from ${speechSpansSnapshot.relPath}`,
    );
  } else {
    console.error("[build-bible-sqlite] speech snapshot not found, fallback to heuristic inference");
  }

  for (const t of index.translations) {
    const abs = resolveTranslationAbsolutePath(cwd, t.id);
    const sqliteAbs = scriptureSqlitePath(cwd, t.id);
    if (!fs.existsSync(abs)) {
      if (fs.existsSync(sqliteAbs)) {
        const bytes = fs.statSync(sqliteAbs).size;
        console.error(`[build-bible-sqlite] ${t.id}: using committed sqlite (${bytes} bytes, no uploads JSON)`);
        continue;
      }
      console.error(`[build-bible-sqlite] 缺少 JSON: ${abs}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
    const { books, verseCount } = parseAndValidateBiblePayload(raw);
    const { bytes, verseCount: inserted } = await writeScriptureSqliteFromBooks(cwd, t.id, books, {
      themeRepeatCounts,
      speechSpansByVerseKey: speechSpansSnapshot?.translations.get(t.id) ?? undefined,
    });
    if (inserted !== verseCount) {
      console.error(`[build-bible-sqlite] ${t.id}: 节数不一致 (json=${verseCount}, sqlite=${inserted})`);
      process.exit(1);
    }
    console.error(`[build-bible-sqlite] ${t.id}: ${inserted} verses -> ${bytes} bytes`);
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
