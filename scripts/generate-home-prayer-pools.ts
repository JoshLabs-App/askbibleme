/**
 * 从祷告库生成 `public/data/home-prayer-pools/<scope>/manifest.json` 与 `chunk-*.json`。
 *
 * 用法：仓库根目录 `npx tsx scripts/generate-home-prayer-pools.ts`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AppLocale } from "../lib/i18n/config";
import type { HomeVerseEntry } from "../lib/i18n/home-verses";
import type { HomePrayerChunkV1, HomePrayerManifestV1 } from "../lib/home-prayer-pools/types";
import { resolveVerseRefToHomeEntry } from "../lib/bible/resolve-verse-range-for-display";
import { readTranslationsIndexSync } from "../lib/bible/translations-store";
import {
  collectPrayerHomeManifestRows,
  listPrayerHomeCategoryScopeIds,
} from "../lib/prayer/collect-prayer-verse-refs-for-home";
import { homeVerseEntryFitsPrayerHomeDisplay } from "../lib/prayer/prayer-home-verse-display-limits";
import { loadUpliftVerseKeySets, upliftTierForVerseKey } from "../lib/prayer/prayer-home-uplift-sets";
import { readTopicPrayerLibrarySync } from "../lib/prayer/read-topic-prayer-library";
import { HOME_PRAYER_POOL_CHUNK_SIZE } from "../lib/home-prayer-pools/constants";

const cwd = process.cwd();

const HOME_POOL_ZH_TRANSLATION_IDS = ["cuv-simp", "cuv-trad"] as const;
const HOME_POOL_EN_TRANSLATION_IDS = ["web-en", "bbe-en"] as const;

function translationIdsPresent(
  index: ReturnType<typeof readTranslationsIndexSync>,
  ids: readonly string[],
): string[] {
  return ids.filter((id) => index.translations.some((t) => t.id === id));
}

function outDir(scopeId: string): string {
  return path.join(cwd, "public", "data", "home-prayer-pools", scopeId);
}

function main(): void {
  const index = readTranslationsIndexSync(cwd);
  const zhTids = translationIdsPresent(index, HOME_POOL_ZH_TRANSLATION_IDS);
  const enTids = translationIdsPresent(index, HOME_POOL_EN_TRANSLATION_IDS);
  const defaultZhTid = zhTids.includes("cuv-simp") ? "cuv-simp" : zhTids[0];
  const defaultEnTid = enTids.includes("web-en") ? "web-en" : enTids[0];

  if (!defaultZhTid || !defaultEnTid) {
    console.error(
      "[home-prayer-pools] 需要至少一种中文译本（cuv-simp / cuv-trad）与一种英文译本（web-en / bbe-en）出现在 data/bible/translations.json 中。",
    );
    return;
  }

  const scopeIds = ["all", ...listPrayerHomeCategoryScopeIds(cwd)];
  for (const scopeId of scopeIds) {
    const rows = collectPrayerHomeManifestRows(cwd, scopeId);
    const resolved: {
      verseKey: string;
      weight: number;
      locales: Record<AppLocale, HomeVerseEntry>;
      byTranslationId: Record<string, HomeVerseEntry>;
    }[] = [];

    for (const row of rows) {
      const byTranslationId: Record<string, HomeVerseEntry> = {};
      for (const tid of zhTids) {
        const entry = resolveVerseRefToHomeEntry(cwd, { ...row.ref, translationId: tid }, "zh-CN");
        if (homeVerseEntryFitsPrayerHomeDisplay(entry)) byTranslationId[tid] = entry!;
      }
      for (const tid of enTids) {
        const entry = resolveVerseRefToHomeEntry(cwd, { ...row.ref, translationId: tid }, "en");
        if (homeVerseEntryFitsPrayerHomeDisplay(entry)) byTranslationId[tid] = entry!;
      }
      const zhDefault = byTranslationId[defaultZhTid];
      const enDefault = byTranslationId[defaultEnTid];
      if (!zhDefault?.lines?.length || !enDefault?.lines?.length) continue;
      resolved.push({
        verseKey: row.verseKey,
        weight: row.weight,
        locales: { "zh-CN": zhDefault, en: enDefault },
        byTranslationId,
      });
    }

    if (scopeId === "all" && resolved.length > 1) {
      const upliftSets = loadUpliftVerseKeySets(cwd);
      const bulk = (row: (typeof resolved)[0]) => {
        const zh = row.locales["zh-CN"];
        const en = row.locales["en"];
        return (zh?.lines?.join("")?.length ?? 0) + (en?.lines?.join("")?.length ?? 0);
      };
      resolved.sort((a, b) => {
        const ta = upliftTierForVerseKey(a.verseKey, upliftSets);
        const tb = upliftTierForVerseKey(b.verseKey, upliftSets);
        if (ta !== tb) return ta - tb;
        const ba = bulk(a);
        const bb = bulk(b);
        if (ba !== bb) return ba - bb;
        return a.verseKey.localeCompare(b.verseKey, "en");
      });
    }

    const chunkSize = HOME_PRAYER_POOL_CHUNK_SIZE;
    const entries: HomePrayerManifestV1["entries"] = [];
    for (let i = 0; i < resolved.length; i++) {
      const chunkIndex = Math.floor(i / chunkSize);
      entries.push({
        verseKey: resolved[i]!.verseKey,
        weight: resolved[i]!.weight,
        chunkIndex,
      });
    }

    const manifest: HomePrayerManifestV1 = {
      version: 1,
      scopeId,
      chunkSize,
      entries,
      ...(scopeId === "all"
        ? { bootstrapVerseKeys: resolved.slice(0, 40).map((r) => r.verseKey) }
        : {}),
    };

    mkdirSync(outDir(scopeId), { recursive: true });
    writeFileSync(path.join(outDir(scopeId), "manifest.json"), `${JSON.stringify(manifest)}\n`, "utf8");

    if (resolved.length === 0) {
      console.log(`[home-prayer-pools] ${scopeId}: 0 verses (empty)`);
      continue;
    }

    const numChunks = Math.ceil(resolved.length / chunkSize);
    for (let ci = 0; ci < numChunks; ci++) {
      const slice = resolved.slice(ci * chunkSize, ci * chunkSize + chunkSize);
      const chunk: HomePrayerChunkV1 = {
        version: 1,
        scopeId,
        chunkIndex: ci,
        verses: slice,
      };
      writeFileSync(path.join(outDir(scopeId), `chunk-${ci}.json`), `${JSON.stringify(chunk)}\n`, "utf8");
    }

    console.log(`[home-prayer-pools] ${scopeId}: ${resolved.length} verses, ${numChunks} chunks`);
  }

  const lib = readTopicPrayerLibrarySync(cwd);
  const meta = {
    version: 1 as const,
    categories: [...lib.categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ id: c.id, title: c.title })),
  };
  const metaDir = path.join(cwd, "public", "data", "home-prayer-pools");
  mkdirSync(metaDir, { recursive: true });
  writeFileSync(path.join(metaDir, "_meta.json"), `${JSON.stringify(meta)}\n`, "utf8");
  console.log("[home-prayer-pools] _meta.json written");
}

main();
