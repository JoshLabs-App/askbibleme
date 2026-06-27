import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PARCHMENT_CATALOG_MAX_WIDTH_PHONE, useParchmentColumnMaxWidth } from "./parchmentColumnLayout";
import { getScriptureCanonCatalogSections } from "./canonCatalog";
import { LAST_READ_LOAD_TIMEOUT_MS } from "./readCatalogScreenConstants";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { useLocale } from "../i18n/LocaleProvider";
import { preloadPrimaryScriptureTranslation } from "../bible/scripture-translation-download";
import { readLastReadPosition, type ReadLastPosition } from "./read-last-position";
import { useTodayReadingPlan } from "./useTodayReadingPlan";
import { getLocalReadingPlanRegistry } from "./reading-plan/fetch-reading-plan-registry";
import { setReadChapterBottomChromeApi } from "./read-chapter-chrome-inset";
import { startTodayPlanFlowScripture } from "./startTodayReadingScriptureFromReadHome";
import {
  readCompletedChapterCountsByBook,
  subscribeReadChapterCompletion,
} from "./read-chapter-completion";
import { useReadCatalogChapterPicker } from "./useReadCatalogChapterPicker";
import { useReadCatalogHomeVerses } from "./useReadCatalogHomeVerses";

type Args = {
  homeMode: boolean;
};

export function useReadCatalogScreen({ homeMode }: Args) {
  const router = useRouter();
  const navigation = useNavigation();
  const catalogFocused = useIsFocused();
  const { px, primaryTranslationId } = useReadBibleTypography();
  const { locale } = useLocale();
  const [lastReadLoading, setLastReadLoading] = useState(true);
  const [lastRead, setLastRead] = useState<ReadLastPosition | null>(null);
  const [completedByBook, setCompletedByBook] = useState<Record<string, number>>({});
  const [completionCountsReady, setCompletionCountsReady] = useState(false);
  const registryPlans = useMemo(() => getLocalReadingPlanRegistry().plans, []);
  const catalogMaxWidth = useParchmentColumnMaxWidth(PARCHMENT_CATALOG_MAX_WIDTH_PHONE);
  const catalogNarrowStyle =
    catalogMaxWidth != null ? { maxWidth: catalogMaxWidth } : null;

  const openChapterRoute = useCallback(
    (bookId: string, chapter: number, opts?: { planFlow?: boolean }) => {
      if (opts?.planFlow) {
        void startTodayPlanFlowScripture(router, { bookId, chapter }).catch((err) => {
          if (__DEV__) {
            console.warn("[planFlow] openChapterRoute failed", err);
          }
        });
        return;
      }
      router.push({
        pathname: "/read/[bookId]/[chapter]",
        params: {
          bookId,
          chapter: String(chapter),
        },
      });
    },
    [router],
  );

  const {
    chapterPickerBookId,
    chapterPickerLayout,
    chapterPickerViewportHeight,
    setMeasuredPickerViewportH,
    closeChapterPicker,
    closeChapterPickerFromBackdrop,
    openChapter,
    onCatalogTestamentChange,
    onCatalogBookPress,
    windowHeight,
  } = useReadCatalogChapterPicker({ catalogFocused, openChapterRoute });

  const { activeHomeVerse, verseOpacity } = useReadCatalogHomeVerses({
    homeMode,
    catalogFocused,
  });

  const todayPlan = useTodayReadingPlan(registryPlans, { enabled: catalogFocused });

  const sections = useMemo(() => {
    try {
      return getScriptureCanonCatalogSections();
    } catch {
      return [];
    }
  }, [locale]);
  const catalogBookIds = useMemo(
    () => sections.flatMap((section) => section.books.map((book) => book.bookId)),
    [sections],
  );

  useEffect(() => {
    if (!catalogFocused) {
      setCompletionCountsReady(false);
      return;
    }
    void preloadPrimaryScriptureTranslation(primaryTranslationId);
    const timer = setTimeout(() => setCompletionCountsReady(true), 3500);
    return () => clearTimeout(timer);
  }, [catalogFocused, primaryTranslationId]);

  useEffect(() => {
    if (!catalogFocused) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLastReadLoading(false);
    }, LAST_READ_LOAD_TIMEOUT_MS);
    void readLastReadPosition()
      .then((pos) => {
        if (cancelled) return;
        setLastRead(pos);
        setLastReadLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLastReadLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [catalogFocused]);

  useEffect(() => {
    if (!catalogFocused || !completionCountsReady) return;
    let cancelled = false;
    const reload = () => {
      void readCompletedChapterCountsByBook(catalogBookIds).then((counts) => {
        if (cancelled) return;
        setCompletedByBook(counts);
      });
    };
    const timer = setTimeout(reload, 0);
    const unsub = subscribeReadChapterCompletion(() => {
      if (catalogFocused && completionCountsReady) reload();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsub();
    };
  }, [catalogBookIds, catalogFocused, completionCountsReady]);

  const onCatalogScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (event.nativeEvent.contentOffset.y > 72) {
        setCompletionCountsReady(true);
      }
    },
    [],
  );

  const noNextChapter = useCallback(() => {}, []);

  useEffect(() => {
    const syncChrome = () => {
      if (!navigation.isFocused()) {
        setReadChapterBottomChromeApi(null);
        return;
      }
      setReadChapterBottomChromeApi({
        goNext: noNextChapter,
        hasNext: false,
      });
    };
    syncChrome();
    const onFocus = navigation.addListener("focus", syncChrome);
    const onBlur = navigation.addListener("blur", () => setReadChapterBottomChromeApi(null));
    return () => {
      onFocus();
      onBlur();
      setReadChapterBottomChromeApi(null);
    };
  }, [navigation, noNextChapter]);

  return {
    px,
    primaryTranslationId,
    router,
    todayPlan,
    sections,
    lastReadLoading,
    lastRead,
    completedByBook,
    catalogNarrowStyle,
    onCatalogScroll,
    openChapter,
    onCatalogTestamentChange,
    onCatalogBookPress,
    activeHomeVerse,
    verseOpacity,
    chapterPickerBookId,
    chapterPickerLayout,
    closeChapterPicker,
    closeChapterPickerFromBackdrop,
    chapterPickerViewportHeight,
    setMeasuredPickerViewportH,
    windowHeight,
  };
}
