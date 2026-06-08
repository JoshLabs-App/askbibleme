/** 探索页图标入口；与 iOS `exploreEntries.ts` 对齐 */
export type ExploreEntry = {
  id: string;
  href: `/explore/${string}`;
  iconSet: "material-community";
  icon: string;
  labelKey: string;
};

export const EXPLORE_ENTRIES: ExploreEntry[] = [
  {
    id: "year-day-count",
    href: "/explore/year-day-count",
    iconSet: "material-community",
    icon: "chart-timeline-variant",
    labelKey: "pages.explore.yearDayCountIconLabel",
  },
  {
    id: "years-days-eternity",
    href: "/explore/years-days-eternity",
    iconSet: "material-community",
    icon: "infinity",
    labelKey: "pages.explore.yearsDaysEternityIconLabel",
  },
  {
    id: "narrow-gate",
    href: "/explore/narrow-gate",
    iconSet: "material-community",
    icon: "door-closed",
    labelKey: "pages.explore.narrowGateIconLabel",
  },
  {
    id: "praise-worship",
    href: "/explore/praise-worship",
    iconSet: "material-community",
    icon: "crown",
    labelKey: "pages.explore.praiseWorshipIconLabel",
  },
  {
    id: "prayer",
    href: "/explore/prayer",
    iconSet: "material-community",
    icon: "hands-pray",
    labelKey: "pages.explore.prayerIconLabel",
  },
];

export const SCRIPTURE_ANTHOLOGY_IDS = [
  "years-days-eternity",
  "word-of-god",
  "narrow-gate",
  "praise-worship",
] as const;

/** iOS 探索页图标区列数 */
export const EXPLORE_ICON_COLUMNS = 3;
