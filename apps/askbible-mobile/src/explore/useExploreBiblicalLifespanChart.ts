import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import {
  isExploreYearDayProfileComplete,
  readExploreYearDayProfile,
  type ExploreYearDayProfile,
} from "./explore-birth-year-prefs";
import {
  getBiblicalLifespanModernEra,
  getBiblicalLifespans,
  isBiblicalLifespanNewTestamentEra,
  type BiblicalLifespanEntry,
} from "./biblical-lifespans";
import { pushExploreReadChapter, EXPLORE_YEAR_DAY_COUNT_PATH } from "./explore-read-chapter-nav";

type HookArgs = {
  profileRefreshKey: number;
  profileProp: ExploreYearDayProfile | null | undefined;
  exploreReturnProp: string | null | undefined;
};

export function useExploreBiblicalLifespanChart({
  profileRefreshKey,
  profileProp,
  exploreReturnProp,
}: HookArgs) {
  const { locale } = useLocale();
  const router = useRouter();
  const exploreReturn = exploreReturnProp ?? EXPLORE_YEAR_DAY_COUNT_PATH;
  const [profileLocal, setProfileLocal] = useState<ExploreYearDayProfile | null>(null);
  const profile = profileProp !== undefined ? profileProp : profileLocal;
  const entries = useMemo(() => getBiblicalLifespans(locale), [locale]);
  const modernEraLabel = useMemo(() => getBiblicalLifespanModernEra(locale), [locale]);

  useEffect(() => {
    if (profileProp !== undefined) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readExploreYearDayProfile().then((next) => {
        if (!cancelled) setProfileLocal(next);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [profileProp, profileRefreshKey]);

  const modernProfile = useMemo(() => {
    if (!profile || !isExploreYearDayProfileComplete(profile)) return null;
    return profile;
  }, [profile]);

  const { mainEntries, newTestamentEntries } = useMemo(() => {
    const main: BiblicalLifespanEntry[] = [];
    const nt: BiblicalLifespanEntry[] = [];
    for (const entry of entries) {
      if (isBiblicalLifespanNewTestamentEra(entry.era)) nt.push(entry);
      else main.push(entry);
    }
    return { mainEntries: main, newTestamentEntries: nt };
  }, [entries]);

  const openInBible = (entry: BiblicalLifespanEntry) => {
    pushExploreReadChapter(
      router,
      {
        bookId: entry.bookId,
        chapter: entry.chapter,
        verse: entry.verseStart,
      },
      exploreReturn,
    );
  };

  return {
    modernProfile,
    modernEraLabel,
    mainEntries,
    newTestamentEntries,
    openInBible,
  };
}
