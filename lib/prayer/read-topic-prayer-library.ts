import fs from "node:fs";
import type {
  TopicPrayerCategory,
  TopicPrayerLibrary,
  TopicPrayerTopic,
  TopicPrayerVerse,
} from "@/lib/prayer/topic-prayer-types";
import { resolveTopicPrayerLibraryJsonPath } from "@/lib/prayer/topic-prayer-library-path";

function defaultLibrary(): TopicPrayerLibrary {
  return { version: 1, dailyJourneyDaysDefault: 7, categories: [] };
}

function normalizeVerse(raw: Partial<TopicPrayerVerse> | null | undefined): TopicPrayerVerse | null {
  if (!raw?.id || !raw?.book || !raw?.osis) return null;
  const hasCoords = Number(raw.chapterStart || 0) > 0 && Number(raw.verseStart || 0) > 0;
  if (!hasCoords && (!raw?.reference || !raw?.text)) return null;
  return {
    id: String(raw.id).trim(),
    osis: String(raw.osis).trim(),
    reference: String(raw.reference || "").trim(),
    text: String(raw.text || "").trim(),
    book: String(raw.book).trim(),
    chapterStart: Number(raw.chapterStart || 1),
    verseStart: Number(raw.verseStart || 1),
    chapterEnd: Number(raw.chapterEnd || raw.chapterStart || 1),
    verseEnd: Number(raw.verseEnd || raw.verseStart || 1),
    weight: Number(raw.weight || 0),
    prayerPrompt: String(raw.prayerPrompt || "").trim() || undefined,
  };
}

function normalizeTopic(raw: Partial<TopicPrayerTopic> | null | undefined): TopicPrayerTopic | null {
  if (!raw?.id || !raw?.title) return null;
  const verses = Array.isArray(raw.verses)
    ? raw.verses
        .map((verse) => normalizeVerse(verse))
        .filter((verse): verse is TopicPrayerVerse => Boolean(verse))
        .sort((a, b) => b.weight - a.weight || a.reference.localeCompare(b.reference, "zh-CN"))
    : [];
  return {
    id: String(raw.id).trim(),
    title: String(raw.title).trim(),
    summary: String(raw.summary || "").trim(),
    sourceTopics: Array.isArray(raw.sourceTopics) ? raw.sourceTopics.map((item) => String(item || "").trim()).filter(Boolean) : [],
    themeTags: Array.isArray(raw.themeTags) ? raw.themeTags.map((item) => String(item || "").trim()).filter(Boolean) : [],
    dailyEligible: raw.dailyEligible !== false,
    rotationWeight: Math.max(1, Number(raw.rotationWeight || 1)),
    journeyDays: Math.max(1, Number(raw.journeyDays || 7)),
    verses,
  };
}

function normalizeCategory(raw: Partial<TopicPrayerCategory> | null | undefined): TopicPrayerCategory | null {
  if (!raw?.id || !raw?.title) return null;
  const topics = Array.isArray(raw.topics)
    ? raw.topics
        .map((topic) => normalizeTopic(topic))
        .filter((topic): topic is TopicPrayerTopic => Boolean(topic))
    : [];
  return {
    id: String(raw.id).trim(),
    title: String(raw.title).trim(),
    description: String(raw.description || "").trim(),
    sortOrder: Math.max(1, Number(raw.sortOrder || 1)),
    topics,
  };
}

let cached: TopicPrayerLibrary | undefined;

export function readTopicPrayerLibrarySync(cwd: string): TopicPrayerLibrary {
  if (cached !== undefined) return cached;
  const abs = resolveTopicPrayerLibraryJsonPath(cwd);
  if (!abs) {
    cached = defaultLibrary();
    return cached;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  } catch {
    cached = defaultLibrary();
    return cached;
  }
  if (!raw || typeof raw !== "object") {
    cached = defaultLibrary();
    return cached;
  }
  const o = raw as Record<string, unknown>;
  const categories = Array.isArray(o.categories)
    ? o.categories
        .map((c) => normalizeCategory(c as Partial<TopicPrayerCategory>))
        .filter((c): c is TopicPrayerCategory => Boolean(c))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "zh-CN"))
    : [];
  cached = {
    version: Number(o.version || 1),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
    dailyJourneyDaysDefault: Math.max(1, Number(o.dailyJourneyDaysDefault || 7)),
    categories,
  };
  return cached;
}

export function getTopicPrayerCategory(cwd: string, categoryId: string): TopicPrayerCategory | null {
  const lib = readTopicPrayerLibrarySync(cwd);
  return lib.categories.find((c) => c.id === categoryId) ?? null;
}

export function getTopicPrayerTopic(cwd: string, categoryId: string, topicId: string): TopicPrayerTopic | null {
  const cat = getTopicPrayerCategory(cwd, categoryId);
  if (!cat) return null;
  return cat.topics.find((t) => t.id === topicId) ?? null;
}

export function getRelatedTopicsForCategory(cwd: string, categoryId: string, limit = 6) {
  const lib = readTopicPrayerLibrarySync(cwd);
  const category = lib.categories.find((c) => c.id === categoryId);
  if (!category) return [];

  const tagSet = new Set(category.topics.flatMap((t) => t.themeTags.map((x) => String(x || "").trim())).filter(Boolean));
  const sourceSet = new Set(
    category.topics.flatMap((t) => t.sourceTopics.map((x) => String(x || "").trim().toLowerCase())).filter(Boolean),
  );

  return lib.categories
    .filter((e) => e.id !== categoryId)
    .flatMap((entry) =>
      entry.topics.map((topic) => {
        const sharedTags = topic.themeTags.filter((tag) => tagSet.has(tag));
        const sharedSources = topic.sourceTopics.filter((tag) => sourceSet.has(String(tag || "").trim().toLowerCase()));
        return {
          categoryId: entry.id,
          categoryTitle: entry.title,
          topic,
          sharedTags,
          score: sharedTags.length * 3 + sharedSources.length * 2,
        };
      }),
    )
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.topic.title.localeCompare(b.topic.title, "zh-CN"))
    .slice(0, limit)
    .map(({ categoryId: rid, categoryTitle, topic, sharedTags }) => ({
      categoryId: rid,
      categoryTitle,
      topic,
      sharedTags,
    }));
}

export function buildTopicOpeningLine(topic: TopicPrayerTopic): string {
  const tags = new Set(topic.themeTags);
  if (tags.has("焦虑") || tags.has("平安")) return "先把心安静下来，再把最挂心的那件事告诉神。";
  if (tags.has("孩子")) return "把你对孩子最深的牵挂交托给神，不急着一次祷告很多。";
  if (tags.has("婚姻")) return "从最真实的关系状态开始，不粉饰，也不急着证明自己。";
  if (tags.has("家庭")) return "把家里最需要神介入的一处带到主面前。";
  if (tags.has("工作")) return "先把压力、决定和需要交给神，再进入今天的祷告。";
  if (tags.has("健康")) return "从身体或情绪最软弱的一点开始，安静地向神倾心吐意。";
  if (tags.has("父母")) return "想一想父母此刻最需要的是什么，然后为那一点具体祷告。";
  if (tags.has("关系")) return "先为那段最需要被修复的关系开口祷告。";
  if (tags.has("经济")) return "把最真实的缺口带到神面前，也求他整理你的心。";
  if (tags.has("前路")) return "不必一次看清全部道路，先为眼前的下一步祷告。";
  return "先安静下来，再把你此刻最真实的挂念告诉神。";
}
