import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  HISTORICAL_CREED_GROUP_ORDER,
  HISTORICAL_CREEDS,
  HISTORICAL_CREEDS_BOTTOM_PAD,
} from "../../../../lib/explore/historical-creeds-content";
import { useLocale } from "../i18n/LocaleProvider";
import { useExploreScrollContentStyle } from "./exploreParchmentStyles";
import {
  mapHistoricalCreedRow,
  resolveHistoricalCreedGroupLabel,
} from "./historicalCreedsTimeline";

export function useExploreHistoricalCreedsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: HISTORICAL_CREEDS_BOTTOM_PAD + insets.bottom,
  });
  const { locale } = useLocale();
  const [expandedCreedId, setExpandedCreedId] = useState<string>("");
  const [fullTextCreedId, setFullTextCreedId] = useState<string | null>(null);

  const creedRows = useMemo(() => {
    const groupLabels = Object.fromEntries(
      HISTORICAL_CREED_GROUP_ORDER.map((group) => [group, resolveHistoricalCreedGroupLabel(group, locale)]),
    ) as Record<(typeof HISTORICAL_CREED_GROUP_ORDER)[number], string>;

    return HISTORICAL_CREEDS.map((item) =>
      mapHistoricalCreedRow(item, locale, groupLabels[item.group]),
    );
  }, [locale]);

  const onToggleExpand = (nextId: string) => {
    setExpandedCreedId(nextId);
  };

  const onToggleFullText = (creedId: string) => {
    setFullTextCreedId((current) => (current === creedId ? null : creedId));
  };

  return {
    router,
    locale,
    scrollContentStyle,
    expandedCreedId,
    fullTextCreedId,
    creedRows,
    onToggleExpand,
    onToggleFullText,
  };
}
