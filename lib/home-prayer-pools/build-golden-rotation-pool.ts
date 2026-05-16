import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { getHomeVerseRotationRefs } from "@/lib/bible/home-verse-ref-rotation";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import { loadUpliftVerseKeySets, upliftTierForVerseKey } from "@/lib/prayer/prayer-home-uplift-sets";
import { HOME_PRAYER_POOL_CHUNK_SIZE } from "@/lib/home-prayer-pools/constants";
import type { HomePrayerChunkV1, HomePrayerManifestV1 } from "@/lib/home-prayer-pools/types";
import { verseKeyFromVerseRef } from "@/lib/home-prayer-pools/verse-key-from-ref";

const HOME_POOL_ZH_TRANSLATION_IDS = ["cuv-simp", "cuv-trad"] as const;
const HOME_POOL_EN_TRANSLATION_IDS = ["web-en", "bbe-en"] as const;

function translationIdsPresent(
  index: ReturnType<typeof readTranslationsIndexSync>,
  ids: readonly string[],
): string[] {
  return ids.filter((id) => index.translations.some((t) => t.id === id));
}

function poolOutDir(cwd: string, scopeId: string): string {
  return path.join(cwd, "public", "data", "home-prayer-pools", scopeId);
}

export type WriteGoldenRotationPrayerPoolResult = {
  scopeId: string;
  verseCount: number;
  chunkCount: number;
};

/**
 * 依 `external-home-verse-rotation.json`（全站唯一经文池，最多 400 句）生成 `public/data/home-prayer-pools/all/`。
 */
export async function writeHomePrayerPoolFromGoldenRotation(
  cwd: string,
): Promise<WriteGoldenRotationPrayerPoolResult> {
  const scopeId = "all";
  const index = readTranslationsIndexSync(cwd);
  const zhTids = translationIdsPresent(index, HOME_POOL_ZH_TRANSLATION_IDS);
  const enTids = translationIdsPresent(index, HOME_POOL_EN_TRANSLATION_IDS);
  const defaultZhTid = zhTids.includes("cuv-simp") ? "cuv-simp" : zhTids[0];
  const defaultEnTid = enTids.includes("web-en") ? "web-en" : enTids[0];

  if (!defaultZhTid || !defaultEnTid) {
    throw new Error(
      "需要至少一种中文译本（cuv-simp / cuv-trad）与一种英文译本（web-en / bbe-en）出现在 data/bible/translations.json 中。",
    );
  }

  const refs = getHomeVerseRotationRefs(cwd);
  const resolved: {
    verseKey: string;
    weight: number;
    locales: Record<AppLocale, HomeVerseEntry>;
    byTranslationId: Record<string, HomeVerseEntry>;
  }[] = [];

  for (const ref of refs) {
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
    const enDefault = byTranslationId[defaultEnTid];
    if (!zhDefault?.lines?.length || !enDefault?.lines?.length) continue;
    resolved.push({
      verseKey,
      weight: 1,
      locales: { "zh-CN": zhDefault, en: enDefault },
      byTranslationId,
    });
  }

  if (resolved.length > 1) {
    const upliftSets = loadUpliftVerseKeySets(cwd);
    const bulk = (row: (typeof resolved)[0]) => {
      const zh = row.locales["zh-CN"];
      const en = row.locales.en;
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

  const metaDir = path.join(cwd, "public", "data", "home-prayer-pools");
  mkdirSync(metaDir, { recursive: true });
  writeFileSync(
    path.join(metaDir, "_meta.json"),
    `${JSON.stringify({ version: 1 as const, categories: [] })}\n`,
    "utf8",
  );

  return { scopeId, verseCount: resolved.length, chunkCount };
}
