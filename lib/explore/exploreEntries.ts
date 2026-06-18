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
  {
    id: "figures",
    href: "/explore/figures",
    iconSet: "material-community",
    icon: "account-group",
    labelKey: "pages.explore.figuresIconLabel",
  },
  {
    id: "historical-creeds",
    href: "/explore/historical-creeds",
    iconSet: "material-community",
    icon: "script-text-outline",
    labelKey: "pages.explore.historicalCreedsIconLabel",
  },
];

export const SCRIPTURE_ANTHOLOGY_IDS = [
  "word-of-god",
  "narrow-gate",
  "praise-worship",
] as const;

/** iOS 探索页图标区列数 */
export const EXPLORE_ICON_COLUMNS = 3;
