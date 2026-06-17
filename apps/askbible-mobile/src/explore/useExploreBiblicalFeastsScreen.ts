import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { useExploreScrollContentStyle } from "./exploreParchmentStyles";
import { pushExploreReadChapter, useExploreReadReturnPath } from "./explore-read-chapter-nav";
import {
  BIBLICAL_FEAST_TIMELINE,
  BIBLICAL_FEASTS_BOTTOM_PAD,
  CHURCH_FEAST_TIMELINE,
  mapFeastTimelineRows,
  type FeastReadTarget,
} from "./biblicalFeastsTimeline";

export function useExploreBiblicalFeastsScreen() {
  const router = useRouter();
  const exploreReturn = useExploreReadReturnPath();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: BIBLICAL_FEASTS_BOTTOM_PAD + insets.bottom,
  });
  const { locale } = useLocale();
  const [expandedFeastId, setExpandedFeastId] = useState<string>("advent");

  const springLabel = locale === "en" ? "Spring Feasts" : t("pages.explore.biblicalFeastsSeasonSpring");
  const autumnLabel = locale === "en" ? "Autumn Feasts" : t("pages.explore.biblicalFeastsSeasonAutumn");

  const feastRows = useMemo(
    () => mapFeastTimelineRows(BIBLICAL_FEAST_TIMELINE, "feasts", springLabel, autumnLabel),
    [springLabel, autumnLabel],
  );
  const churchFeastRows = useMemo(
    () => mapFeastTimelineRows(CHURCH_FEAST_TIMELINE, "churchFeasts", springLabel, autumnLabel),
    [springLabel, autumnLabel],
  );

  const openRead = (target: FeastReadTarget) => {
    pushExploreReadChapter(
      router,
      {
        bookId: target.bookId,
        chapter: target.chapter,
        verse: target.verse,
      },
      exploreReturn,
    );
  };

  const onToggleExpand = (nextId: string) => {
    setExpandedFeastId(nextId);
  };

  return {
    router,
    locale,
    scrollContentStyle,
    expandedFeastId,
    feastRows,
    churchFeastRows,
    openRead,
    onToggleExpand,
  };
}
