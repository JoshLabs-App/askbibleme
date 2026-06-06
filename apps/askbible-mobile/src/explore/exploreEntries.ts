import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type MaterialIcons from "@expo/vector-icons/MaterialIcons";

type MaterialIconName = keyof typeof MaterialIcons.glyphMap;
type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type ExploreEntry =
  | {
      id: string;
      href: `/explore/${string}`;
      iconSet: "material";
      icon: MaterialIconName;
      labelKey: string;
    }
  | {
      id: string;
      href: `/explore/${string}`;
      iconSet: "material-community";
      icon: MaterialCommunityIconName;
      labelKey: string;
    };

/** 探索页图标入口；后续新内容在此追加一项即可 */
export const EXPLORE_ENTRIES: ExploreEntry[] = [
  {
    id: "year-day-count",
    href: "/explore/year-day-count",
    iconSet: "material-community",
    icon: "chart-timeline-variant",
    labelKey: "pages.explore.yearDayCountIconLabel",
  },
  {
    id: "biblical-feasts",
    href: "/explore/biblical-feasts",
    iconSet: "material-community",
    icon: "calendar-star",
    labelKey: "pages.explore.biblicalFeastsIconLabel",
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
