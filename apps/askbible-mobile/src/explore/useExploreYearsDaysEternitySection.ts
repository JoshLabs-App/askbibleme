import { useEffect, useMemo, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { InteractionManager } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import { getYearsDaysEternityEn, getYearsDaysEternityZh, resolveYearsDaysEternityDocument } from "./years-days-eternity-content";
import { filterEternityScriptures } from "./years-days-eternity-blocks";
import { getRedemptionTimelineCaption } from "./years-days-eternity-redemption-eras";
import { loadEternityEnScriptureBodiesForRefs } from "./yearsDaysEternityScriptureLoad";
import { localizeRefLabel } from "./yearsDaysEternityRefUtils";

export function useExploreYearsDaysEternitySection() {
  const { locale } = useLocale();
  const screenFocused = useIsFocused();
  const doc = locale === "en" ? getYearsDaysEternityEn() : resolveYearsDaysEternityDocument(locale);
  const [enScriptureBodyByRef, setEnScriptureBodyByRef] = useState<Record<string, string>>({});
  const [expandedCategoryIndex, setExpandedCategoryIndex] = useState<number | null>(null);
  const [accordionReady, setAccordionReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setAccordionReady(true));
    return () => task.cancel();
  }, []);

  const fullScriptureSections = useMemo(() => {
    if (locale !== "en") return doc.sections;
    const sourceById = new Map(getYearsDaysEternityZh().sections.map((section) => [section.id, section]));
    return doc.sections.map((section) => {
      const source = sourceById.get(section.id);
      if (!source) return section;
      return { ...section, blocks: source.blocks };
    });
  }, [doc.sections, locale]);

  const localizedRefByRaw = useMemo(() => {
    if (locale === "zh-CN") return {};
    const rows = fullScriptureSections
      .flatMap((section) => filterEternityScriptures(section.blocks))
      .map((block) => [block.ref, localizeRefLabel(block.ref, locale)] as const);
    return Object.fromEntries(rows) as Record<string, string>;
  }, [fullScriptureSections, locale]);

  useEffect(() => {
    setEnScriptureBodyByRef({});
    setExpandedCategoryIndex(null);
  }, [locale]);

  useEffect(() => {
    if (!screenFocused || locale !== "en" || expandedCategoryIndex === null) return;
    const section = fullScriptureSections[expandedCategoryIndex];
    if (!section) return;

    const refs = filterEternityScriptures(section.blocks).map((block) => block.ref);
    if (refs.length === 0) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadEternityEnScriptureBodiesForRefs(refs).then((loaded) => {
        if (cancelled || !screenFocused) return;
        setEnScriptureBodyByRef((prev) => {
          const merged = { ...prev };
          let changed = false;
          for (const [ref, text] of Object.entries(loaded)) {
            if (merged[ref] == null) {
              merged[ref] = text;
              changed = true;
            }
          }
          return changed ? merged : prev;
        });
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [expandedCategoryIndex, fullScriptureSections, locale, screenFocused]);

  const timelineCaption = getRedemptionTimelineCaption(locale);

  const onToggleSection = (index: number) => {
    setExpandedCategoryIndex((current) => (current === index ? null : index));
  };

  return {
    locale,
    doc,
    timelineCaption,
    fullScriptureSections,
    expandedCategoryIndex,
    accordionReady,
    enScriptureBodyByRef,
    localizedRefByRaw,
    onToggleSection,
  };
}
