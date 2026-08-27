import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ExploreEntry } from "./exploreEntries";

type MaterialIconName = keyof typeof MaterialIcons.glyphMap;
type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type ExploreStagedEntry =
  | {
      id: string;
      href: `/explore/${string}`;
      iconSet: "material";
      icon: MaterialIconName;
      labelZh: string;
      labelEn: string;
    }
  | {
      id: string;
      href: `/explore/${string}`;
      iconSet: "material-community";
      icon: MaterialCommunityIconName;
      labelZh: string;
      labelEn: string;
    };

/** 预埋新经文池（5 格）：远程 exploreHome.remoteModules 填内容，visibleStagedEntryIds 放出图标 */
export const EXPLORE_SCRIPTURE_POOL_ENTRY_IDS = [
  "scripture-pool-01",
  "scripture-pool-02",
  "scripture-pool-03",
  "scripture-pool-04",
  "scripture-pool-05",
] as const;

export type ExploreScripturePoolEntryId = (typeof EXPLORE_SCRIPTURE_POOL_ENTRY_IDS)[number];

const SCRIPTURE_POOL_ID_SET = new Set<string>(EXPLORE_SCRIPTURE_POOL_ENTRY_IDS);

export function isExploreScripturePoolEntryId(id: string): id is ExploreScripturePoolEntryId {
  return SCRIPTURE_POOL_ID_SET.has(id);
}

/** 探索首页第一行下方：预埋区，默认不展示；远程 visibleStagedEntryIds + 内容就绪后才出现 */
export const EXPLORE_STAGED_ENTRY_IDS = [
  "bible-maps",
  "historical-creeds",
  "history-timeline",
  ...EXPLORE_SCRIPTURE_POOL_ENTRY_IDS,
] as const;

export type ExploreStagedEntryId = (typeof EXPLORE_STAGED_ENTRY_IDS)[number];

const STAGED_ID_SET = new Set<string>(EXPLORE_STAGED_ENTRY_IDS);

export function isExploreStagedEntryId(id: string): id is ExploreStagedEntryId {
  return STAGED_ID_SET.has(id);
}

function stagedHref(id: string): `/explore/${string}` {
  return `/explore/${id}`;
}

/** 与 ExploreEntry 同形，供 ExploreEntryIcon 复用 */
export const EXPLORE_STAGED_ENTRIES: ExploreStagedEntry[] = [
  {
    id: "bible-maps",
    href: stagedHref("bible-maps"),
    iconSet: "material-community",
    icon: "map-outline",
    labelZh: "圣经地图",
    labelEn: "Bible Maps",
  },
  {
    id: "historical-creeds",
    href: stagedHref("historical-creeds"),
    iconSet: "material-community",
    icon: "script-text-outline",
    labelZh: "历代信经",
    labelEn: "Historic Creeds",
  },
  {
    id: "history-timeline",
    href: stagedHref("history-timeline"),
    iconSet: "material-community",
    icon: "timeline-clock-outline",
    labelZh: "历史线",
    labelEn: "History Timeline",
  },
  {
    id: "scripture-pool-01",
    href: stagedHref("scripture-pool-01"),
    iconSet: "material-community",
    icon: "book-multiple-outline",
    labelZh: "经文池 1",
    labelEn: "Scripture Pool 1",
  },
  {
    id: "scripture-pool-02",
    href: stagedHref("scripture-pool-02"),
    iconSet: "material-community",
    icon: "bookmark-outline",
    labelZh: "经文池 2",
    labelEn: "Scripture Pool 2",
  },
  {
    id: "scripture-pool-03",
    href: stagedHref("scripture-pool-03"),
    iconSet: "material-community",
    icon: "tag-text-outline",
    labelZh: "经文池 3",
    labelEn: "Scripture Pool 3",
  },
  {
    id: "scripture-pool-04",
    href: stagedHref("scripture-pool-04"),
    iconSet: "material-community",
    icon: "format-list-bulleted",
    labelZh: "经文池 4",
    labelEn: "Scripture Pool 4",
  },
  {
    id: "scripture-pool-05",
    href: stagedHref("scripture-pool-05"),
    iconSet: "material-community",
    icon: "bookshelf",
    labelZh: "经文池 5",
    labelEn: "Scripture Pool 5",
  },
];

const STAGED_BY_ID = Object.fromEntries(
  EXPLORE_STAGED_ENTRIES.map((entry) => [entry.id, entry]),
) as Record<ExploreStagedEntryId, ExploreStagedEntry>;

export function getExploreStagedEntry(id: string): ExploreStagedEntry | undefined {
  if (!isExploreStagedEntryId(id)) return undefined;
  return STAGED_BY_ID[id];
}

/** 供 ExploreEntryIcon：结构与 ExploreEntry 一致 */
export function asExploreEntryIconShape(entry: ExploreStagedEntry): ExploreEntry {
  return {
    ...entry,
    labelKey: entry.id,
  };
}
