import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { TopicPrayerCategory, TopicPrayerTopic, TopicPrayerVerse } from "@/lib/prayer/topic-prayer-types";

const BOOK_ID_MAP: Record<string, string> = {
  PS: "PSA",
  PROV: "PRO",
  MATT: "MAT",
  MARK: "MRK",
  LUKE: "LUK",
  JOHN: "JHN",
  ACTS: "ACT",
  ROM: "ROM",
  "1COR": "1CO",
  "2COR": "2CO",
  GAL: "GAL",
  EPH: "EPH",
  PHIL: "PHP",
  COL: "COL",
  "1THESS": "1TH",
  HEB: "HEB",
  JAS: "JAS",
  "1PET": "1PE",
  "2PET": "2PE",
  "1JOHN": "1JN",
  "3JOHN": "3JN",
  DEUT: "DEU",
  JOSH: "JOS",
  NUM: "NUM",
  ISA: "ISA",
  JER: "JER",
  LAM: "LAM",
  EZEK: "EZK",
  MIC: "MIC",
  MAL: "MAL",
};

function normalizeBookId(bookId: string): string {
  const u = String(bookId || "").trim().toUpperCase();
  return BOOK_ID_MAP[u] ?? u;
}

function collectVerseText(
  verses: { verse: number; text: string }[],
  verseStart: number,
  verseEnd: number,
): string {
  return verses
    .filter((v) => v.verse >= verseStart && v.verse <= verseEnd)
    .map((v) => String(v.text || "").trim())
    .filter(Boolean)
    .join("");
}

function referenceLabelZh(bookId: string, chapter: number, verseStart: number, verseEnd: number): string {
  const meta = scriptureBooks.find((b) => b.bookId === bookId);
  const name = meta?.bookName ?? bookId;
  if (verseStart === verseEnd) return `${name} ${chapter}:${verseStart}`;
  return `${name} ${chapter}:${verseStart}–${verseEnd}`;
}

/**
 * 用 Selah 已导入译本填充 `reference` 与 `text`（单书卷、可跨章连续取字；跨书卷则仅规范化书卷码）。
 */
export async function resolveTopicPrayerVerseFromSelah(
  cwd: string,
  verse: TopicPrayerVerse,
  translationId: string,
): Promise<TopicPrayerVerse> {
  const bookId = normalizeBookId(verse.book);
  const ch0 = verse.chapterStart;
  const ch1 = verse.chapterEnd;
  const vs = verse.verseStart;
  const ve = verse.verseEnd;

  if (ch0 !== ch1) {
    const parts: string[] = [];
    for (let ch = ch0; ch <= ch1; ch += 1) {
      const loaded = await loadChapterFromTranslation(cwd, bookId, ch, translationId);
      if (!loaded) continue;
      const v0 = ch === ch0 ? vs : 1;
      const v1 = ch === ch1 ? ve : loaded.verses[loaded.verses.length - 1]?.verse ?? ve;
      const chunk = collectVerseText(loaded.verses, v0, v1);
      if (chunk) parts.push(chunk);
    }
    const text = parts.join("");
    return {
      ...verse,
      book: bookId,
      reference: verse.reference.trim() || referenceLabelZh(bookId, ch0, vs, ve),
      text: text || verse.text,
    };
  }

  const loaded = await loadChapterFromTranslation(cwd, bookId, ch0, translationId);
  if (!loaded) {
    return { ...verse, book: bookId, reference: verse.reference.trim() || referenceLabelZh(bookId, ch0, vs, ve) };
  }
  const text = collectVerseText(loaded.verses, vs, ve);
  return {
    ...verse,
    book: bookId,
    reference: referenceLabelZh(loaded.bookId, ch0, vs, ve),
    text: text || verse.text,
  };
}

export async function resolveTopicPrayerTopicFromSelah(
  cwd: string,
  topic: TopicPrayerTopic,
  translationId: string,
): Promise<TopicPrayerTopic> {
  const verses = await Promise.all(topic.verses.map((v) => resolveTopicPrayerVerseFromSelah(cwd, v, translationId)));
  return {
    ...topic,
    verses,
  };
}

/** 只解析前 `maxVerses` 条（用于分类页预览，减轻磁盘读）。 */
export async function resolveTopicPrayerTopicHeadVerses(
  cwd: string,
  topic: TopicPrayerTopic,
  translationId: string,
  maxVerses: number,
): Promise<TopicPrayerTopic> {
  const head = await Promise.all(
    topic.verses.slice(0, maxVerses).map((v) => resolveTopicPrayerVerseFromSelah(cwd, v, translationId)),
  );
  return { ...topic, verses: head };
}

export async function resolveTopicPrayerCategoryFromSelah(
  cwd: string,
  category: TopicPrayerCategory,
  translationId: string,
): Promise<TopicPrayerCategory> {
  const topics = await Promise.all(category.topics.map((t) => resolveTopicPrayerTopicFromSelah(cwd, t, translationId)));
  return {
    ...category,
    topics,
  };
}
