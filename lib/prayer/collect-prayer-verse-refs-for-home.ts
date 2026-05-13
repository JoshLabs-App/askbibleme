import type { TopicPrayerLibrary, TopicPrayerVerse } from "@/lib/prayer/topic-prayer-types";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { readTopicPrayerLibrarySync } from "@/lib/prayer/read-topic-prayer-library";
import { isShortVerseRefForPrayerHomePool } from "@/lib/prayer/prayer-home-verse-display-limits";

export type PrayerHomeScopeId = "all" | (string & {});

export type PrayerHomeManifestSourceRow = {
  verseKey: string;
  weight: number;
  ref: VerseRef;
};

function verseKeyOf(v: TopicPrayerVerse): string {
  const o = String(v.osis || "").trim();
  if (o) return o;
  return `${String(v.book).trim()}.${v.chapterStart}.${v.verseStart}-${v.chapterEnd ?? v.chapterStart}.${v.verseEnd ?? v.verseStart}`;
}

export function topicPrayerVerseToVerseRef(v: TopicPrayerVerse): VerseRef | null {
  const bookId = String(v.book || "").trim().toUpperCase();
  const ch = Number(v.chapterStart);
  const vs = Number(v.verseStart);
  const ve = Number(v.verseEnd ?? v.verseStart);
  if (!bookId || !Number.isInteger(ch) || ch < 1 || !Number.isInteger(vs) || vs < 1) return null;
  if (!Number.isInteger(ve) || ve < vs) return null;
  return { bookId, chapter: ch, verseStart: vs, verseEnd: ve };
}

function mergeInto(
  map: Map<string, { weight: number; ref: VerseRef }>,
  v: TopicPrayerVerse,
): void {
  const ref = topicPrayerVerseToVerseRef(v);
  if (!ref || !isShortVerseRefForPrayerHomePool(ref)) return;
  const key = verseKeyOf(v);
  const w = Math.max(0, Number(v.weight) || 0);
  const prev = map.get(key);
  if (!prev || w > prev.weight) {
    map.set(key, { weight: Math.max(w, prev?.weight ?? 0), ref });
  } else if (prev && w > 0) {
    map.set(key, { weight: Math.max(prev.weight, w), ref: prev.ref });
  }
}

function collectFromCategoryTopics(topics: TopicPrayerLibrary["categories"][0]["topics"]): Map<string, { weight: number; ref: VerseRef }> {
  const map = new Map<string, { weight: number; ref: VerseRef }>();
  for (const topic of topics) {
    for (const verse of topic.verses) {
      mergeInto(map, verse);
    }
  }
  return map;
}

/**
 * 为首页祷告池生成 manifest 源数据：`all` 为十类合并去重；否则为单个 `categoryId`。
 * 已排除「过长」经节：连续节数超过 `PRAYER_HOME_MAX_VERSE_SPAN`（当前为 2）的不入池。
 */
export function collectPrayerHomeManifestRows(cwd: string, scopeId: PrayerHomeScopeId): PrayerHomeManifestSourceRow[] {
  const lib = readTopicPrayerLibrarySync(cwd);
  const map = new Map<string, { weight: number; ref: VerseRef }>();

  if (scopeId === "all") {
    for (const cat of lib.categories) {
      const part = collectFromCategoryTopics(cat.topics);
      for (const [k, row] of part) {
        const prev = map.get(k);
        if (!prev || row.weight > prev.weight) {
          map.set(k, { weight: Math.max(row.weight, prev?.weight ?? 0), ref: row.ref });
        } else {
          map.set(k, { weight: Math.max(prev.weight, row.weight), ref: prev.ref });
        }
      }
    }
  } else {
    const cat = lib.categories.find((c) => c.id === scopeId);
    if (!cat) return [];
    const part = collectFromCategoryTopics(cat.topics);
    for (const [k, row] of part) map.set(k, row);
  }

  const rows: PrayerHomeManifestSourceRow[] = [];
  for (const [verseKey, { weight, ref }] of map) {
    rows.push({ verseKey, weight: Math.max(1, weight || 1), ref });
  }
  rows.sort((a, b) => a.verseKey.localeCompare(b.verseKey, "en"));
  return rows;
}

export function listPrayerHomeCategoryScopeIds(cwd: string): string[] {
  const lib = readTopicPrayerLibrarySync(cwd);
  return [...lib.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => c.id);
}
