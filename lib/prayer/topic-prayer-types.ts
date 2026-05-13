export type TopicPrayerVerse = {
  id: string;
  osis: string;
  reference: string;
  text: string;
  book: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number;
  verseEnd: number;
  weight: number;
  prayerPrompt?: string;
};

export type TopicPrayerTopic = {
  id: string;
  title: string;
  summary: string;
  sourceTopics: string[];
  themeTags: string[];
  dailyEligible: boolean;
  rotationWeight: number;
  journeyDays: number;
  verses: TopicPrayerVerse[];
};

export type TopicPrayerCategory = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  topics: TopicPrayerTopic[];
};

export type TopicPrayerLibrary = {
  version: number;
  updatedAt?: string;
  dailyJourneyDaysDefault: number;
  categories: TopicPrayerCategory[];
};

export type RelatedTopicPrayerEntry = {
  categoryId: string;
  categoryTitle: string;
  topic: TopicPrayerTopic;
  sharedTags: string[];
};
