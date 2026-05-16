/**
 * 从 `data/bible/uploads/{translationId}.json` 生成 `data/bible/sqlite/{translationId}.sqlite`。
 * 供 `npm run build`（prebuild）与本机 `npm run build:bible-sqlite` 使用。
 */
import fs from "node:fs";
import { writeScriptureSqliteFromBooks } from "../lib/bible/build-scripture-sqlite";
import { readTranslationsIndex, resolveTranslationAbsolutePath } from "../lib/bible/translations-store";
import { parseAndValidateBiblePayload } from "../lib/bible/validate-bible-json";

async function main(): Promise<void> {
  const cwd = process.cwd();
  const index = await readTranslationsIndex(cwd);
  if (index.translations.length === 0) {
    console.error("[build-bible-sqlite] translations.json 中无译本，跳过。");
    return;
  }

  for (const t of index.translations) {
    const abs = resolveTranslationAbsolutePath(cwd, t.id);
    if (!fs.existsSync(abs)) {
      console.error(`[build-bible-sqlite] 缺少 JSON: ${abs}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
    const { books, verseCount } = parseAndValidateBiblePayload(raw);
    const { bytes, verseCount: inserted } = await writeScriptureSqliteFromBooks(cwd, t.id, books);
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
