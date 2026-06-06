/** 探索页图标入口；与 iOS `exploreEntries.ts` 对齐 */
export type ExploreEntry = {
  id: string;
  href: `/explore/${string}`;
  icon: string;
  labelKey: string;
};

export const EXPLORE_ENTRIES: ExploreEntry[] = [
  {
    id: "year-day-count",
    href: "/explore/year-day-count",
    icon: "📊",
    labelKey: "pages.explore.yearDayCountIconLabel",
  },
  {
    id: "biblical-feasts",
    href: "/explore/biblical-feasts",
    icon: "🗓️",
    labelKey: "pages.explore.biblicalFeastsIconLabel",
  },
  {
    id: "years-days-eternity",
    href: "/explore/years-days-eternity",
    icon: "∞",
    labelKey: "pages.explore.yearsDaysEternityIconLabel",
  },
  {
    id: "narrow-gate",
    href: "/explore/narrow-gate",
    icon: "🚪",
    labelKey: "pages.explore.narrowGateIconLabel",
  },
  {
    id: "praise-worship",
    href: "/explore/praise-worship",
    icon: "👑",
    labelKey: "pages.explore.praiseWorshipIconLabel",
  },
  {
    id: "prayer",
    href: "/explore/prayer",
    icon: "🙏",
    labelKey: "pages.explore.prayerIconLabel",
  },
  {
    id: "encouraging-words",
    href: "/explore/encouraging-words",
    icon: "💬",
    labelKey: "pages.explore.encouragingWordsIconLabel",
  },
  {
    id: "word-of-god",
    href: "/explore/word-of-god",
    icon: "📖",
    labelKey: "pages.explore.wordOfGodIconLabel",
  },
];

export const SCRIPTURE_ANTHOLOGY_IDS = [
  "years-days-eternity",
  "word-of-god",
  "narrow-gate",
  "praise-worship",
] as const;
