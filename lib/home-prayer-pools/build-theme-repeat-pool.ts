import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import {
  getReaderVerseThemesDatabase,
  readerVerseThemesSqlitePath,
} from "@/lib/scripture/reader-verse-themes-db";
import {
  listThemeRepeatPoolSourceRows,
  type VerseRepeatRankSortBy,
} from "@/lib/scripture/reader-verse-repeat-rank";
import { themeRepeatPoolScopeId } from "@/lib/scripture/theme-repeat-pool-scope-id";
import { HOME_PRAYER_POOL_CHUNK_SIZE } from "@/lib/home-prayer-pools/constants";
import type { HomePrayerChunkV1, HomePrayerManifestV1 } from "@/lib/home-prayer-pools/types";
import { verseKeyFromVerseRef } from "@/lib/home-prayer-pools/verse-key-from-ref";
import {
  readThemeRepeatAllowlistVerseKeys,
  writeThemeRepeatAllowlist,
  type ThemeRepeatAllowlistRow,
} from "@/lib/home-prayer-pools/theme-repeat-allowlist";
import { EXPLORE_HOME_VERSE_POOL_VERSE_KEYS } from "@/lib/explore/explore-home-verse-pool-verse-keys";

const HOME_POOL_ZH_TRANSLATION_IDS = ["cuv-simp", "cuv-trad"] as const;
const HOME_POOL_EN_TRANSLATION_IDS = ["web-en", "kjv", "bbe-en"] as const;
const bookNumberById = new Map(scriptureBooks.map((b) => [b.bookId, b.bookNumber]));
const CJK_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const INCOMPLETE_CJK_END_RE = /[，；：、]\s*$/;

function stripTailQuotes(text: string): string {
  return text.replace(/[」』”"\)\]）】〕〉》]+$/g, "").trimEnd();
}

function isLikelyIncompleteCjkSingleLine(entry: HomeVerseEntry): boolean {
  if (!entry.lines?.length) return true;
  if (entry.lines.length > 1) return false;
  const line = stripTailQuotes(entry.lines[0] ?? "").trim();
  if (!line || !CJK_CHAR_RE.test(line)) return false;
  return INCOMPLETE_CJK_END_RE.test(line);
}

function translationIdsPresent(
  index: ReturnType<typeof readTranslationsIndexSync>,
  ids: readonly string[],
): string[] {
  return ids.filter((id) => index.translations.some((t) => t.id === id));
}

function poolOutDir(cwd: string, scopeId: string): string {
  return path.join(cwd, "public", "data", "home-prayer-pools", scopeId);
}

export type WriteThemeRepeatPrayerPoolOptions = {
  minCount: number;
  maxCount?: number;
  cap?: number;
  /** 兼容旧行为：补入 explore 兜底经文。严格排行包可关闭。 */
  includeExploreSeeds?: boolean;
  /** 静态池条目顺序：默认 repeat（次数降序）；菜单池用 book（书卷顺序）。 */
  sortBy?: VerseRepeatRankSortBy;
};

export type WriteThemeRepeatPrayerPoolResult = {
  scopeId: string;
  minCount: number;
  verseCount: number;
  chunkCount: number;
  skippedResolve: number;
  forcedExploreAdds: number;
};

function parseVerseKey(verseKey: string): VerseRef | null {
  const m = /^([A-Z0-9]{3})\.(\d+)\.(\d+)$/.exec(verseKey.trim().toUpperCase());
  if (!m) return null;
  const chapter = Number(m[2]);
  const verse = Number(m[3]);
  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) return null;
  return {
    bookId: m[1]!,
    chapter,
    verseStart: verse,
    verseEnd: verse,
  };
}

/**
 * 依主题库收录次数生成静态祷告池：`public/data/home-prayer-pools/theme-repeat-ge{N}/`。
 * 正文仅来自圣经库（cuv-simp / kjv 等），不读主题库 verse_text。
 */
export async function writeThemeRepeatPrayerPool(
  cwd: string,
  options: WriteThemeRepeatPrayerPoolOptions,
): Promise<WriteThemeRepeatPrayerPoolResult> {
  const minCount = Math.max(1, Math.floor(options.minCount));
  const scopeId = themeRepeatPoolScopeId(minCount);
  const dbPath = readerVerseThemesSqlitePath(cwd);
  const fs = await import("node:fs");
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `未找到 ${readerVerseThemesSqlitePath(cwd)}。请先运行 npm run import:reader-verse-themes`,
    );
  }
  const db = await getReaderVerseThemesDatabase(cwd);
  if (!db) throw new Error("无法打开 reader-verse-themes.sqlite");

  const mtimeMs = fs.statSync(dbPath).mtimeMs;
  const sortBy = options.sortBy ?? "repeat";
  const sourceRows = listThemeRepeatPoolSourceRows(db, {
    minCount,
    maxCount: options.maxCount,
    cap: options.cap,
    mtimeMs,
    sortBy,
  });
  const sourceRowByVerseKey = new Map<string, (typeof sourceRows)[number]>();
  for (const row of sourceRows) {
    const key = verseKeyFromVerseRef({
      bookId: row.bookId,
      chapter: row.chapter,
      verseStart: row.verse,
      verseEnd: row.verse,
    });
    sourceRowByVerseKey.set(key, row);
  }
  const allowlistVerseKeys = readThemeRepeatAllowlistVerseKeys(cwd, scopeId);
  const sourceRowsFiltered =
    allowlistVerseKeys == null
      ? sourceRows
      : sourceRows.filter((row) =>
          allowlistVerseKeys.has(
            verseKeyFromVerseRef({
              bookId: row.bookId,
              chapter: row.chapter,
              verseStart: row.verse,
              verseEnd: row.verse,
            }),
          ),
        );
  const selectedVerseKeys = new Set(
    sourceRowsFiltered.map((row) =>
      verseKeyFromVerseRef({
        bookId: row.bookId,
        chapter: row.chapter,
        verseStart: row.verse,
        verseEnd: row.verse,
      }),
    ),
  );
  const includeExploreSeeds = options.includeExploreSeeds ?? true;
  const sourceRowsWithExplore = [...sourceRowsFiltered];
  let forcedExploreAdds = 0;
  if (includeExploreSeeds) {
    for (const exploreVerseKey of EXPLORE_HOME_VERSE_POOL_VERSE_KEYS) {
      if (selectedVerseKeys.has(exploreVerseKey)) continue;
      const fromRank = sourceRowByVerseKey.get(exploreVerseKey);
      if (fromRank) {
        sourceRowsWithExplore.push(fromRank);
        selectedVerseKeys.add(exploreVerseKey);
        forcedExploreAdds += 1;
        continue;
      }
      const parsed = parseVerseKey(exploreVerseKey);
      if (!parsed) continue;
      sourceRowsWithExplore.push({
        repeatCount: Math.max(1, minCount),
        bookId: parsed.bookId,
        chapter: parsed.chapter,
        verse: parsed.verseStart,
      });
      selectedVerseKeys.add(exploreVerseKey);
      forcedExploreAdds += 1;
    }
  }
  if (sortBy === "book") {
    sourceRowsWithExplore.sort(
      (a, b) =>
        (bookNumberById.get(a.bookId) ?? 999) - (bookNumberById.get(b.bookId) ?? 999) ||
        a.chapter - b.chapter ||
        a.verse - b.verse,
    );
  } else {
    sourceRowsWithExplore.sort(
      (a, b) =>
        b.repeatCount - a.repeatCount ||
        a.bookId.localeCompare(b.bookId, "en") ||
        a.chapter - b.chapter ||
        a.verse - b.verse,
    );
  }

  const metaPath = path.join(cwd, "data", "scripture", `${scopeId}-meta.json`);
  mkdirSync(path.dirname(metaPath), { recursive: true });
  writeFileSync(
    metaPath,
    `${JSON.stringify(
      {
        version: 1 as const,
        scopeId,
        minCount,
        maxCount: options.maxCount ?? null,
        cap: options.cap ?? null,
        verseCount: sourceRowsWithExplore.length,
        rows: sourceRowsWithExplore,
      },
      null,
      0,
    )}\n`,
    "utf8",
  );

  const index = readTranslationsIndexSync(cwd);
  const zhTids = translationIdsPresent(index, HOME_POOL_ZH_TRANSLATION_IDS);
  const enTids = translationIdsPresent(index, HOME_POOL_EN_TRANSLATION_IDS);
  const defaultZhTid = zhTids.includes("cuv-simp") ? "cuv-simp" : zhTids[0];
  const defaultEnTid = enTids.includes("web-en") ? "web-en" : enTids[0];
  if (!defaultZhTid || !defaultEnTid) {
    throw new Error("需要 cuv-simp/cuv-trad 与 WEB 等英文译本方可生成池。");
  }

  const resolved: {
    verseKey: string;
    weight: number;
    locales: Record<AppLocale, HomeVerseEntry>;
    byTranslationId: Record<string, HomeVerseEntry>;
  }[] = [];
  const allowlistRows: ThemeRepeatAllowlistRow[] = [];
  let skippedResolve = 0;

  for (const row of sourceRowsWithExplore) {
    const ref: VerseRef = {
      bookId: row.bookId,
      chapter: row.chapter,
      verseStart: row.verse,
      verseEnd: row.verse,
    };
    const verseKey = verseKeyFromVerseRef(ref);
    const byTranslationId: Record<string, HomeVerseEntry> = {};
    for (const tid of zhTids) {
      const entry = await resolveVerseRefToHomeEntry(cwd, { ...ref, translationId: tid }, "zh-CN");
      if (entry?.lines?.length) byTranslationId[tid] = entry;
    }
    for (const tid of enTids) {
      const entry = await resolveVerseRefToHomeEntry(cwd, { ...ref, translationId: tid }, "en");
      if (entry?.lines?.length) byTranslationId[tid] = entry;
    }
    const zhDefault = byTranslationId[defaultZhTid];
    const zhTwDefault = byTranslationId["cuv-trad"] ?? zhDefault;
    const enDefault = byTranslationId[defaultEnTid];
    if (!zhDefault?.lines?.length || !enDefault?.lines?.length) {
      skippedResolve += 1;
      continue;
    }
    if (isLikelyIncompleteCjkSingleLine(zhDefault)) {
      skippedResolve += 1;
      continue;
    }
    allowlistRows.push({
      verseKey,
      repeatCount: Math.max(1, row.repeatCount),
      reference: zhDefault.ref,
      text: zhDefault.lines.join(" "),
    });
    resolved.push({
      verseKey,
      weight: Math.max(1, row.repeatCount),
      locales: { "zh-CN": zhDefault, "zh-TW": zhTwDefault, en: enDefault },
      byTranslationId,
    });
  }

  const chunkSize = HOME_PRAYER_POOL_CHUNK_SIZE;
  const entries: HomePrayerManifestV1["entries"] = [];
  for (let i = 0; i < resolved.length; i++) {
    entries.push({
      verseKey: resolved[i]!.verseKey,
      weight: resolved[i]!.weight,
      chunkIndex: Math.floor(i / chunkSize),
    });
  }

  const manifest: HomePrayerManifestV1 = {
    version: 1,
    scopeId,
    chunkSize,
    entries,
    bootstrapVerseKeys: resolved.slice(0, 40).map((r) => r.verseKey),
  };

  const out = poolOutDir(cwd, scopeId);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify(manifest)}\n`, "utf8");

  let chunkCount = 0;
  if (resolved.length > 0) {
    chunkCount = Math.ceil(resolved.length / chunkSize);
    for (let ci = 0; ci < chunkCount; ci++) {
      const slice = resolved.slice(ci * chunkSize, ci * chunkSize + chunkSize);
      const chunk: HomePrayerChunkV1 = {
        version: 1,
        scopeId,
        chunkIndex: ci,
        verses: slice,
      };
      writeFileSync(path.join(out, `chunk-${ci}.json`), `${JSON.stringify(chunk)}\n`, "utf8");
    }
    for (const name of readdirSync(out)) {
      const m = /^chunk-(\d+)\.json$/.exec(name);
      if (m && Number(m[1]) >= chunkCount) {
        unlinkSync(path.join(out, name));
      }
    }
  }

  if (allowlistVerseKeys == null) {
    const filePath = writeThemeRepeatAllowlist(cwd, scopeId, allowlistRows);
    console.log(
      `[theme-repeat-pool] created allowlist at ${filePath} (${allowlistRows.length} rows)`,
    );
  }

  return {
    scopeId,
    minCount,
    verseCount: resolved.length,
    chunkCount,
    skippedResolve,
    forcedExploreAdds,
  };
}
