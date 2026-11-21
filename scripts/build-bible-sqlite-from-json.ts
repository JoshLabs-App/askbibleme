/**
 * 从 `data/bible/uploads/{translationId}.json` 生成 `data/bible/sqlite/{translationId}.sqlite`。
 * 写入 `speech_spans`、`theme_repeat_count`（主题库陈列次数；≥3 次才标金句色带）。
 * 增量缓存：指纹（脚本 + 依赖库 + 译本 JSON + 主题库 + speech_spans 快照）未变且 .sqlite 存在时跳过 WASM 加载。
 * 供 `npm run build`（prebuild）与本机 `npm run build:bible-sqlite` 使用；支持 FORCE_PREBUILD=1 / FORCE_BIBLE_SQLITE_REBUILD=1。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);

type TranslationEntry = { id: string };

type CachedTranslationEntry = {
  globalFingerprint: string;
  jsonSize: number;
  jsonMtimeMs: number;
  jsonSha256: string;
  sqliteSize: number;
  sqliteMtimeMs: number;
};

type CacheFile = {
  version: 1;
  themeDb?: { size: number; mtimeMs: number; sha256: string };
  entries: Record<string, CachedTranslationEntry>;
};

function sha256File(absPath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function readCache(cachePath: string): CacheFile {
  if (!fs.existsSync(cachePath)) return { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Partial<CacheFile>;
    if (parsed?.version === 1 && parsed.entries && typeof parsed.entries === "object") {
      return {
        version: 1,
        themeDb: parsed.themeDb,
        entries: parsed.entries,
      };
    }
  } catch {
    /* ignore corrupt cache */
  }
  return { version: 1, entries: {} };
}

function writeCache(cachePath: string, cache: CacheFile): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(cache)}\n`, "utf8");
}

function computeGlobalFingerprint(
  cwd: string,
  cache: CacheFile,
): { fingerprint: string; themeDbMeta?: CacheFile["themeDb"]; cacheDirty: boolean } {
  const depRelPaths = [
    "lib/bible/build-scripture-sqlite.ts",
    "lib/bible/golden-verse-theme-repeat.ts",
    "lib/bible/speech-spans-snapshot.ts",
    "lib/bible/verse-annotations.ts",
    "lib/bible/infer-divine-speech-spans.ts",
    "lib/bible/validate-bible-json.ts",
    "lib/bible/cuv-simplified-orthography.mjs",
    "lib/bible/translations-store.ts",
    "lib/bible/scripture-sqlite-db.ts",
    "data/bible/translations.json",
    "data/bible/annotations/speech-spans-v2.json",
    "data/bible/annotations/speech-spans-v1.json",
  ];
  const hash = crypto.createHash("sha256");
  hash.update(`script:${sha256File(scriptPath)}\n`);
  for (const rel of depRelPaths) {
    const abs = path.join(cwd, rel);
    if (!fs.existsSync(abs)) {
      hash.update(`${rel}:missing\n`);
      continue;
    }
    const st = fs.statSync(abs);
    hash.update(`${rel}:${st.size}:${sha256File(abs)}\n`);
  }

  let cacheDirty = false;
  let themeDbMeta = cache.themeDb;
  const themeDbAbs = path.join(cwd, "data/scripture/reader-verse-themes.sqlite");
  if (!fs.existsSync(themeDbAbs)) {
    hash.update("themeDb:missing\n");
    if (themeDbMeta) {
      themeDbMeta = undefined;
      cacheDirty = true;
    }
  } else {
    const st = fs.statSync(themeDbAbs);
    let sha = themeDbMeta && themeDbMeta.size === st.size && themeDbMeta.mtimeMs === st.mtimeMs ? themeDbMeta.sha256 : "";
    if (!sha) {
      sha = sha256File(themeDbAbs);
      themeDbMeta = { size: st.size, mtimeMs: st.mtimeMs, sha256: sha };
      cacheDirty = true;
    }
    hash.update(`themeDb:${st.size}:${sha}\n`);
  }

  return { fingerprint: hash.digest("hex"), themeDbMeta, cacheDirty };
}

function resolveSafeUploadJsonPath(cwd: string, id: string): string {
  const dir = path.join(cwd, "data", "bible", "uploads");
  const finalPath = path.resolve(dir, `${id}.json`);
  const rel = path.relative(dir, finalPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("非法路径。");
  }
  return finalPath;
}

/**
 * 主题库 `data/scripture/reader-verse-themes.sqlite` 不入库（从桌面 BIBLE 项目导入），本机没有它时
 * `loadThemeRepeatCountMap` 是空表；重建译本会把已提交 sqlite 里的 theme_repeat_count（金句色带）全刷成 0。
 * 这时从已提交的同名 sqlite 把计数按节键接过来——节键不随正文改动，接过来就是准确值。
 */
async function readCommittedThemeRepeatCounts(cwd: string, sqliteAbs: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!fs.existsSync(sqliteAbs)) return map;
  const [{ getSqlJsStatic }, { verseAnnotationKey }] = await Promise.all([
    import("../lib/bible/sql-js-wasm"),
    import("../lib/bible/verse-annotations"),
  ]);
  const SQL = await getSqlJsStatic(cwd);
  const db = new SQL.Database(fs.readFileSync(sqliteAbs));
  try {
    const stmt = db.prepare("SELECT book_id, chapter, verse, theme_repeat_count FROM verse WHERE theme_repeat_count > 0");
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        map.set(verseAnnotationKey(String(row.book_id), Number(row.chapter), Number(row.verse)), Number(row.theme_repeat_count));
      }
    } finally {
      stmt.free();
    }
  } finally {
    db.close();
  }
  return map;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const indexAbs = path.join(cwd, "data", "bible", "translations.json");
  const rawIndex = fs.existsSync(indexAbs)
    ? (JSON.parse(fs.readFileSync(indexAbs, "utf8")) as { translations?: TranslationEntry[] })
    : { translations: [] };
  const translations = Array.isArray(rawIndex.translations)
    ? rawIndex.translations.filter((t) => Boolean(t?.id?.trim())).map((t) => ({ id: t.id.trim() }))
    : [];

  const onlyTranslationId = String(process.env.BIBLE_TRANSLATION_ID || "").trim();
  if (translations.length === 0) {
    console.error("[build-bible-sqlite] translations.json 中无译本，跳过。");
    return;
  }

  const cachePath = path.join(cwd, "node_modules", ".cache", "askbible-prebuild", "build-bible-sqlite.json");
  const cache = readCache(cachePath);
  const forceRebuild = process.env.FORCE_BIBLE_SQLITE_REBUILD === "1" || process.env.FORCE_PREBUILD === "1";
  const { fingerprint: globalFingerprint, themeDbMeta, cacheDirty: fpDirty } = computeGlobalFingerprint(cwd, cache);
  cache.themeDb = themeDbMeta;
  let cacheDirty = fpDirty;

  const toBuild: Array<{ id: string; jsonAbs: string; sqliteAbs: string; jsonSha256?: string }> = [];
  let skippedCount = 0;

  for (const t of translations) {
    if (onlyTranslationId && t.id !== onlyTranslationId) continue;
    const jsonAbs = resolveSafeUploadJsonPath(cwd, t.id);
    const sqliteAbs = path.join(cwd, "data", "bible", "sqlite", `${t.id}.sqlite`);
    const hasJson = fs.existsSync(jsonAbs);
    const hasSqlite = fs.existsSync(sqliteAbs);

    if (!hasJson) {
      if (!hasSqlite) {
        console.error(`[build-bible-sqlite] 缺少 JSON: ${jsonAbs}`);
        process.exit(1);
      }
      skippedCount++;
      continue;
    }

    const jsonStat = fs.statSync(jsonAbs);
    const sqliteStat = hasSqlite ? fs.statSync(sqliteAbs) : null;
    const prev = cache.entries[t.id];

    if (
      !forceRebuild &&
      sqliteStat &&
      prev &&
      prev.globalFingerprint === globalFingerprint &&
      prev.jsonSize === jsonStat.size &&
      prev.jsonMtimeMs === jsonStat.mtimeMs &&
      prev.sqliteSize === sqliteStat.size &&
      prev.sqliteMtimeMs === sqliteStat.mtimeMs
    ) {
      skippedCount++;
      continue;
    }

    const jsonSha256 = sha256File(jsonAbs);

    if (
      !forceRebuild &&
      sqliteStat &&
      prev &&
      prev.globalFingerprint === globalFingerprint &&
      prev.jsonSha256 === jsonSha256 &&
      prev.sqliteSize === sqliteStat.size
    ) {
      cache.entries[t.id] = {
        ...prev,
        jsonMtimeMs: jsonStat.mtimeMs,
        sqliteMtimeMs: sqliteStat.mtimeMs,
      };
      cacheDirty = true;
      skippedCount++;
      continue;
    }

    if (!forceRebuild && sqliteStat && !prev && jsonStat.mtimeMs <= sqliteStat.mtimeMs) {
      cache.entries[t.id] = {
        globalFingerprint,
        jsonSize: jsonStat.size,
        jsonMtimeMs: jsonStat.mtimeMs,
        jsonSha256,
        sqliteSize: sqliteStat.size,
        sqliteMtimeMs: sqliteStat.mtimeMs,
      };
      cacheDirty = true;
      skippedCount++;
      continue;
    }

    toBuild.push({ id: t.id, jsonAbs, sqliteAbs, jsonSha256 });
  }

  if (toBuild.length === 0) {
    if (cacheDirty) writeCache(cachePath, cache);
    console.error(`[build-bible-sqlite] all ${skippedCount} translations up to date, skipped WASM init`);
    return;
  }

  const [
    { loadThemeRepeatCountMap, MIN_GOLDEN_THEME_REPEAT_COUNT },
    { loadSpeechSpansSnapshot },
    { writeScriptureSqliteFromBooks },
    { parseAndValidateBiblePayload },
    { findLegacyCuvSimplifiedOrthography },
  ] = await Promise.all([
    import("../lib/bible/golden-verse-theme-repeat"),
    import("../lib/bible/speech-spans-snapshot"),
    import("../lib/bible/build-scripture-sqlite"),
    import("../lib/bible/validate-bible-json"),
    import("../lib/bible/cuv-simplified-orthography.mjs"),
  ]);

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

  for (const item of toBuild) {
    const raw = JSON.parse(fs.readFileSync(item.jsonAbs, "utf8")) as unknown;
    const { books, verseCount } = parseAndValidateBiblePayload(raw);
    if (item.id === "cuv-simp") {
      const findings = findLegacyCuvSimplifiedOrthography(JSON.stringify(books));
      if (findings.length > 0) {
        const summary = findings
          .map(({ legacy, modern, count }) => `${legacy}→${modern} ×${count}`)
          .join(", ");
        throw new Error(
          `[build-bible-sqlite] cuv-simp 仍含旧字/异体字：${summary}。请运行 npm run bible:normalize:cuv-simp`,
        );
      }
    }
    let themeCountsForBuild = themeRepeatCounts;
    if (themeRepeatCounts.size === 0) {
      themeCountsForBuild = await readCommittedThemeRepeatCounts(cwd, item.sqliteAbs);
      console.error(
        `[build-bible-sqlite] ${item.id}: 本机无主题库，沿用已提交 sqlite 的 theme_repeat_count（${themeCountsForBuild.size} 节）`,
      );
    }
    const { bytes, verseCount: inserted } = await writeScriptureSqliteFromBooks(cwd, item.id, books, {
      themeRepeatCounts: themeCountsForBuild,
      speechSpansByVerseKey: speechSpansSnapshot?.translations.get(item.id) ?? undefined,
    });
    if (inserted !== verseCount) {
      console.error(`[build-bible-sqlite] ${item.id}: 节数不一致 (json=${verseCount}, sqlite=${inserted})`);
      process.exit(1);
    }
    const jsonStat = fs.statSync(item.jsonAbs);
    const sqliteStat = fs.statSync(item.sqliteAbs);
    cache.entries[item.id] = {
      globalFingerprint,
      jsonSize: jsonStat.size,
      jsonMtimeMs: jsonStat.mtimeMs,
      jsonSha256: item.jsonSha256 ?? sha256File(item.jsonAbs),
      sqliteSize: sqliteStat.size,
      sqliteMtimeMs: sqliteStat.mtimeMs,
    };
    cacheDirty = true;
    console.error(`[build-bible-sqlite] ${item.id}: ${inserted} verses -> ${bytes} bytes`);
  }

  if (cacheDirty) writeCache(cachePath, cache);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
