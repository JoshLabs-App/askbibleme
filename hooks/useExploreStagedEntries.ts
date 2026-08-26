"use client";

import { useMemo } from "react";
import type { ExploreModulesBundle } from "@/lib/explore/explore-modules-bundle-types";
import {
  getVisibleExploreStagedEntries,
  resolveExploreStagedEntryLabel,
  resolveExploreStagedSectionCaption,
} from "@/lib/explore/explore-home-config";
import type { ExploreStagedEntry } from "@/lib/explore/explore-staged-entries";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function useExploreStagedEntries(bundle: ExploreModulesBundle): {
  entries: ExploreStagedEntry[];
  sectionCaption: string;
  labelFor: (entry: ExploreStagedEntry) => string;
} {
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
