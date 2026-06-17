import { useMemo } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import {
  getVisibleExploreStagedEntries,
  resolveExploreStagedEntryLabel,
  resolveExploreStagedSectionCaption,
} from "./exploreHomeConfig";
import type { ExploreStagedEntry } from "./exploreStagedEntries";
import { useExploreModulesBundle } from "./useExploreModules";

export function useExploreStagedEntries(): {
  entries: ExploreStagedEntry[];
  sectionCaption: string;
  labelFor: (entry: ExploreStagedEntry) => string;
} {
  const bundle = useExploreModulesBundle();
  const { locale } = useLocale();

  return useMemo(() => {
    const entries = getVisibleExploreStagedEntries(bundle);
    return {
      entries,
      sectionCaption: resolveExploreStagedSectionCaption(locale, bundle),
      labelFor: (entry: ExploreStagedEntry) => resolveExploreStagedEntryLabel(entry, locale, bundle),
    };
  }, [bundle, locale]);
}
