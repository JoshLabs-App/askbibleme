import fs from "node:fs";
import path from "node:path";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { getHomeVerseRotationRefs } from "@/lib/bible/home-verse-ref-rotation";

/** 与祷告库 `osis` / 轮播 key 对齐：`BOOK.chapter.verseStart`（大写书卷）。 */
export function verseRefToShortOsisKey(ref: VerseRef): string {
  const b = String(ref.bookId || "").trim().toUpperCase();
  return `${b}.${ref.chapter}.${ref.verseStart}`;
}

type CategorizedFile = {
  categories?: { id?: string; verseRefs?: VerseRef[] }[];
};

const PRIMARY_CATEGORY_IDS = new Set(["encouragement", "hope", "comfort"]);
const SECONDARY_CATEGORY_IDS = new Set(["faith", "wisdom"]);

/**
 * 「全部」池排序用：鼓励向经文 key（与 `verseKey` 或 `verseKey` 首段 OSIS 匹配）。
 * primary：鼓励/盼望/安慰 + 当前首页轮播 ref；secondary：信心/智慧。
 */
export function loadUpliftVerseKeySets(cwd: string): { primary: Set<string>; secondary: Set<string> } {
  const primary = new Set<string>();
  const secondary = new Set<string>();

  for (const ref of getHomeVerseRotationRefs(cwd)) {
    primary.add(verseRefToShortOsisKey(ref));
  }

  const abs = path.join(cwd, "data", "scripture", "categorized-verses.json");
  if (!fs.existsSync(abs)) {
    return { primary, secondary };
  }
  let raw: CategorizedFile;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as CategorizedFile;
  } catch {
    return { primary, secondary };
  }
  for (const cat of raw.categories ?? []) {
    const id = String(cat.id || "");
    const set = PRIMARY_CATEGORY_IDS.has(id) ? primary : SECONDARY_CATEGORY_IDS.has(id) ? secondary : null;
    if (!set) continue;
    for (const ref of cat.verseRefs ?? []) {
      if (!ref?.bookId || !Number.isInteger(ref.chapter) || !Number.isInteger(ref.verseStart)) continue;
      set.add(verseRefToShortOsisKey(ref as VerseRef));
    }
  }

  return { primary, secondary };
}

export function upliftTierForVerseKey(
  verseKey: string,
  sets: { primary: Set<string>; secondary: Set<string> },
): number {
  const candidates = [verseKey];
  const i = verseKey.indexOf("-");
  if (i > 0) candidates.push(verseKey.slice(0, i).trim());
  for (const k of candidates) {
    if (sets.primary.has(k)) return 0;
  }
  for (const k of candidates) {
    if (sets.secondary.has(k)) return 1;
  }
  return 2;
}
