import fs from "node:fs";
import path from "node:path";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { parseVerseRefFromUnknown } from "@/lib/bible/verse-ref-json";
import type { ScriptureSourceMeta } from "@/lib/scripture/scripture-source-meta";

const REL = path.join("data", "scripture", "categorized-verses.json");

export type CategorizedVerseCategory = {
  id: string;
  labelZh: string;
  labelEn: string;
  /** 与主题轴对齐的可选标签（计划 themeIds） */
  themeIds?: string[];
  verseRefs: VerseRef[];
};

export type CategorizedVersesIndex = {
  version: number;
  sourceNote?: string;
  sourceMeta?: ScriptureSourceMeta;
  categories: CategorizedVerseCategory[];
};

function parseSourceMeta(v: unknown): ScriptureSourceMeta | undefined {
  if (!v || typeof v !== "object") return undefined;
  const m = v as Record<string, unknown>;
  return {
    sourceName: typeof m.sourceName === "string" ? m.sourceName : undefined,
    sourceUrl: typeof m.sourceUrl === "string" ? m.sourceUrl : undefined,
    licenseOrTermsNote: typeof m.licenseOrTermsNote === "string" ? m.licenseOrTermsNote : undefined,
    retrievedAt: typeof m.retrievedAt === "string" ? m.retrievedAt : undefined,
    snapshotVersion: typeof m.snapshotVersion === "string" ? m.snapshotVersion : undefined,
  };
}

function parseIndex(raw: unknown): CategorizedVersesIndex | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "number" || !Array.isArray(o.categories)) return null;
  const categories: CategorizedVerseCategory[] = [];
  for (const c of o.categories) {
    if (!c || typeof c !== "object") continue;
    const row = c as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const labelZh = typeof row.labelZh === "string" ? row.labelZh : "";
    const labelEn = typeof row.labelEn === "string" ? row.labelEn : "";
    if (!id || !labelZh || !labelEn) continue;
    const refsRaw = row.verseRefs;
    if (!Array.isArray(refsRaw)) continue;
    const verseRefs: VerseRef[] = [];
    for (const item of refsRaw) {
      const r = parseVerseRefFromUnknown(item);
      if (r) verseRefs.push(r);
    }
    if (verseRefs.length === 0) continue;
    let themeIds: string[] | undefined;
    if (Array.isArray(row.themeIds)) {
      const ids = row.themeIds
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x): x is string => Boolean(x));
      if (ids.length > 0) themeIds = ids;
    }
    categories.push({ id, labelZh, labelEn, themeIds, verseRefs });
  }
  if (categories.length === 0) return null;
  return {
    version: o.version,
    sourceNote: typeof o.sourceNote === "string" ? o.sourceNote : undefined,
    sourceMeta: parseSourceMeta(o.sourceMeta),
    categories,
  };
}

/** 同步读 `data/scripture/categorized-verses.json`；缺文件或坏 JSON 时返回 null。 */
export function readCategorizedVersesSync(cwd: string): CategorizedVersesIndex | null {
  const abs = path.join(cwd, REL);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
  return parseIndex(raw);
}
