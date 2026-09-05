import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { loadVerseXrefs } from "../bible/load-chapter-xrefs";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { resolveChapterVerseSpeechParts } from "../bible/resolve-verse-speech-parts";
import type { ScriptureVerseXrefs } from "../bible/scripture-xref-types";
import type { ChapterSegment, LoadedChapter } from "../bible/types";
import type { AppLocale } from "../i18n/config";
import { createT, toZhTwText } from "../i18n/site-copy";
import { getScriptureCanonCatalogSections } from "./canonCatalog";
import {
  buildFallbackCatalogSections,
} from "./readChapterScreenConstants";
import { buildChapterSegmentMeta, buildParagraphGroups } from "./readChapterScreenSegmentMeta";
import {
  resolvePlanFlowNextTarget,
  resolvePlanFlowPrevTarget,
} from "./read-plan-flow-nav";
import type { TodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { resolveReadDisplayLocale } from "./resolveReadDisplayLocale";

type TranslationMeta = { language?: string } | undefined;

type Args = {
  locale: AppLocale;
  primaryTranslationMeta: TranslationMeta;
  chapterData: LoadedChapter | null;
  chapterSegments: ChapterSegment[] | null;
  preferEnglishSegmentTitles: boolean;
  verseParagraphFlow: boolean;
  contrastTranslationIds: string[];
  isPlanFlow: boolean;
  todayPlanPayload: TodayReadingPlanPayload | null;
  bookId: string | null;
  chapter: number | null;
};

export function useReadChapterScreenDisplay({
  locale,
  primaryTranslationMeta,
  chapterData,
  chapterSegments,
  preferEnglishSegmentTitles,
  verseParagraphFlow,
  contrastTranslationIds,
  isPlanFlow,
  todayPlanPayload,
  bookId,
  chapter,
}: Args) {
  const [xrefSheetBundle, setXrefSheetBundle] = useState<ScriptureVerseXrefs | null>(null);
  const [xrefSheetLoading, setXrefSheetLoading] = useState(false);
  const [xrefSheetVerse, setXrefSheetVerse] = useState<number | null>(null);

  const planFlowNextTarget = useMemo(() => {
    if (!isPlanFlow || !chapterData) return null;
    return resolvePlanFlowNextTarget(todayPlanPayload, chapterData.bookId, chapterData.chapter);
  }, [chapterData?.bookId, chapterData?.chapter, isPlanFlow, todayPlanPayload]);

  const planFlowPrevTarget = useMemo(() => {
    if (!isPlanFlow || !chapterData) return null;
    return resolvePlanFlowPrevTarget(todayPlanPayload, chapterData.bookId, chapterData.chapter);
  }, [chapterData?.bookId, chapterData?.chapter, isPlanFlow, todayPlanPayload]);

  const readDisplayLocale = useMemo<AppLocale>(() => {
    const verseSample = chapterData?.verses
      ?.slice(0, 3)
      .map((row) => row.text)
      .join(" ");
    return resolveReadDisplayLocale({
      appLocale: locale,
      translationLanguage: primaryTranslationMeta?.language,
      verseSampleText: verseSample,
    });
  }, [primaryTranslationMeta?.language, chapterData?.verses, locale]);

  const tr = useMemo(() => createT(readDisplayLocale), [readDisplayLocale]);
  const prefersEnglishInfoEdition = /^en\b/i.test(primaryTranslationMeta?.language ?? "");
  const xrefBookName = useMemo(
    () => (chapterData ? getScriptureBookDisplayName(chapterData.bookId, readDisplayLocale) : ""),
    [chapterData, readDisplayLocale],
  );
  const postReadingDisplayLocale = readDisplayLocale;
  const isEnglishPostReading = postReadingDisplayLocale === "en";
  const localeDisplayText = useCallback(
    (text: string) => (postReadingDisplayLocale === "zh-TW" ? toZhTwText(text) : text),
    [postReadingDisplayLocale],
  );
  const isZhLocale = /^zh\b/i.test(readDisplayLocale);
  const localeZhText = useCallback(
    (text: string) => (readDisplayLocale === "zh-TW" ? toZhTwText(text) : text),
    [readDisplayLocale],
  );
  const displayBookName = useMemo(
    () => (chapterData ? getScriptureBookDisplayName(chapterData.bookId, readDisplayLocale) : ""),
    [chapterData, readDisplayLocale],
  );
  const chapterTitleBookName = useMemo(
    () => (chapterData ? getScriptureBookDisplayName(chapterData.bookId, readDisplayLocale) : ""),
    [chapterData, readDisplayLocale],
  );
  const chapterTitleText = useMemo(() => {
    if (!chapterData) return "";
    if (readDisplayLocale === "en") {
      return `${chapterTitleBookName} ${chapterData.chapter}`;
    }
    return `${chapterTitleBookName} 第${chapterData.chapter}章`;
  }, [chapterData, chapterTitleBookName, readDisplayLocale]);
  /** 主译本缺本章而回退时在章标题下方的提示；正常加载为空串。 */
  const fallbackNoticeText = useMemo(() => {
    const fromId = chapterData?.fallbackFromTranslationId;
    if (!chapterData || !fromId) return "";
    const fromLabel =
      readDisplayLocale === "en"
        ? chapterData.fallbackFromLabelEn || fromId
        : localeZhText(chapterData.fallbackFromLabelZh || fromId);
    const toLabel = readDisplayLocale === "en" ? chapterData.labelEn : localeZhText(chapterData.labelZh);
    return tr("pages.read.chapterFallbackNotice", { from: fromLabel, to: toLabel });
  }, [chapterData, localeZhText, readDisplayLocale, tr]);

  const catalogSections = useMemo(() => {
    try {
      const sections = getScriptureCanonCatalogSections();
      if (!sections.length) return buildFallbackCatalogSections(tr);
      return sections;
    } catch {
      return buildFallbackCatalogSections(tr);
    }
  }, [tr]);

  const neighbors = useMemo(() => {
    if (!chapterData) return { prev: null, next: null };
    return resolveReadChapterNeighbors(chapterData.bookId, chapterData.chapter);
  }, [chapterData]);

  const endNavNext = isPlanFlow && planFlowNextTarget ? planFlowNextTarget : neighbors.next;
  const endNavPrev = isPlanFlow && planFlowPrevTarget ? planFlowPrevTarget : neighbors.prev;

  const formatNeighborChapterLabel = useCallback(
    (target: { bookId: string; chapter: number } | null): string => {
      if (!target) return "";
      return isZhLocale ? `第${target.chapter}章` : `Chapter ${target.chapter}`;
    },
    [isZhLocale],
  );

  useEffect(() => {
    if (xrefSheetVerse == null || !bookId || chapter == null) {
      setXrefSheetBundle(null);
      setXrefSheetLoading(false);
      return;
    }
    let cancelled = false;
    setXrefSheetLoading(true);
    setXrefSheetBundle(null);
    const task = InteractionManager.runAfterInteractions(() => {
      void loadVerseXrefs(bookId, chapter, xrefSheetVerse).then((bundle) => {
        if (cancelled) return;
        setXrefSheetBundle(bundle);
        setXrefSheetLoading(false);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [bookId, chapter, xrefSheetVerse]);

  const verseIndexByVerse = useMemo(() => {
    const map = new Map<number, number>();
    chapterData?.verses.forEach((row, idx) => {
      map.set(row.verse, idx);
    });
    return map;
  }, [chapterData?.verses]);

  const speechPartsByVerse = useMemo(() => {
    if (!chapterData?.verses.length) return null;
    return resolveChapterVerseSpeechParts(chapterData.verses, {
      translationId: chapterData.translationId,
      bookId: chapterData.bookId,
      chapter: chapterData.chapter,
    });
  }, [
    chapterData?.verses,
    chapterData?.translationId,
    chapterData?.bookId,
    chapterData?.chapter,
  ]);

  const segmentMeta = useMemo(
    () =>
      buildChapterSegmentMeta(
        chapterSegments,
        readDisplayLocale,
        localeZhText,
        preferEnglishSegmentTitles,
      ),
    [chapterSegments, readDisplayLocale, localeZhText, preferEnglishSegmentTitles],
  );
  const useParagraphFlowLayout = verseParagraphFlow && contrastTranslationIds.length === 0;
  const paragraphGroups = useMemo(
    () => buildParagraphGroups(chapterData?.verses ?? [], segmentMeta),
    [chapterData?.verses, segmentMeta],
  );

  const clearXrefOnRouteChange = useCallback(() => {
    setXrefSheetBundle(null);
    setXrefSheetLoading(false);
  }, []);

  return {
    readDisplayLocale,
    tr,
    localeZhText,
    localeDisplayText,
    displayBookName,
    chapterTitleText,
    fallbackNoticeText,
    catalogSections,
    formatNeighborChapterLabel,
    neighbors,
    endNavNext,
    endNavPrev,
    planFlowNextTarget,
    planFlowPrevTarget,
    speechPartsByVerse,
    segmentMeta,
    paragraphGroups,
    useParagraphFlowLayout,
    verseIndexByVerse,
    xrefSheetBundle,
    xrefSheetLoading,
    xrefSheetVerse,
    setXrefSheetVerse,
    xrefBookName,
    postReadingDisplayLocale,
    isEnglishPostReading,
    prefersEnglishInfoEdition,
    clearXrefOnRouteChange,
  };
}
