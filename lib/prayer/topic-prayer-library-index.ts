import type { TopicPrayerCategory, TopicPrayerLibrary, TopicPrayerTopic } from "@/lib/prayer/topic-prayer-types";
import { readTopicPrayerLibrarySync } from "@/lib/prayer/read-topic-prayer-library";

export type TopicPrayerTopicIndex = Pick<TopicPrayerTopic, "id" | "title" | "summary">;

export type TopicPrayerCategoryIndex = Omit<TopicPrayerCategory, "topics"> & {
  topics: TopicPrayerTopicIndex[];
};

export function toTopicPrayerLibraryIndex(categories: TopicPrayerCategory[]): TopicPrayerCategoryIndex[] {
  return categories.map((cat) => ({
    id: cat.id,
    title: cat.title,
    description: cat.description,
    sortOrder: cat.sortOrder,
    topics: cat.topics.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
    })),
  }));
}

/** 祷告首页索引：不含经文正文，减小 RSC 体积。 */
export function readTopicPrayerLibraryIndexSync(cwd: string): TopicPrayerCategoryIndex[] {
  const lib: TopicPrayerLibrary = readTopicPrayerLibrarySync(cwd);
  return toTopicPrayerLibraryIndex(lib.categories);
}
