import * as Haptics from "expo-haptics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  copyScriptureVerseToClipboard,
  copyTextToClipboard,
} from "../bible/copy-scripture-verse-clipboard";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { translationMetaFromCatalog } from "../api/fetchBibleTranslationsCatalog";
import {
  ensureScriptureTranslationReady,
  ensureScriptureTranslationReadyWithFallback,
} from "../bible/scripture-translation-download";
import { loadBundledChapterSegments } from "../bible/bundled-chapter-segments";
import { resolveChapterSegmentHeadingText, preferEnglishChapterSegmentTitles } from "../bible/chapter-segment-display";
import { loadChapterXrefVerseNumbers, loadVerseXrefs } from "../bible/load-chapter-xrefs";
import { warmScriptureSearchDatabase } from "../bible/scripture-database";
import { normalizeScriptureSearchQuery } from "../bible/scripture-search";
import { warmScriptureXrefDatabase } from "../bible/scripture-xref-database";
import type { ScriptureVerseXrefs } from "../bible/scripture-xref-types";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import type { LoadedChapter } from "../bible/types";
import type { ChapterSegment } from "../bible/types";
import {
  DEFAULT_SCRIPTURE_LABEL_EN,
  DEFAULT_SCRIPTURE_LABEL_ZH,
} from "../bible/types";
import { scriptureBooks, testamentForBookNumber } from "../bible/scripture-books";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import {
  EXPLORE_READ_RETURN_PARAM,
  resolveExploreReadReturnParam,
  useReadChapterExploreReturnHandler,
} from "../explore/explore-read-chapter-nav";
import { useLocale } from "../i18n/LocaleProvider";
import { createT, t, toZhTwText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { BibleCatalogOutline } from "./BibleCatalogOutline";
import { BibleChapterPickerPanel, deferChapterPickerNavigation } from "./BibleChapterPickerPanel";
import { readParchmentTheme as c } from "./readParchmentTheme";
import {
  bookNameForId,
  getScriptureCanonCatalogSections,
  type ScriptureCanonCatalogSection,
} from "./canonCatalog";
import { ParchmentBottomFadeScrollView } from "./ParchmentBottomFadeScrollView";
import { ReadChapterPostReadingEditions } from "./ReadChapterPostReadingEditions";
import {
  readChapterScrollBottomPad,
  setReadChapterBottomChromeApi,
} from "./read-chapter-chrome-inset";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import { useShellSwipeNav } from "../shell/ShellSwipeNavContext";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { ReadChapterCompletionPlanPanel } from "./ReadChapterCompletionPlanPanel";
import { resolveChapterVerseSpeechParts } from "../bible/resolve-verse-speech-parts";
import { verseTextHighlightStyleForVerse } from "./goldenVerseMarkerStyle";
import { ReadChapterVerseText } from "./ReadChapterVerseText";
import { ReadChapterVerseXrefSheet } from "./ReadChapterVerseXrefSheet";
import { useParchmentColumnMaxWidth } from "./parchmentColumnLayout";
import { READ_PARCHMENT_SCROLL_SOURCE } from "./ReadParchmentSurface";
import { parchmentSans, readTypography } from "./readTypography";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { useReadChapterAudio } from "./useReadChapterAudio";
import { useReadChapterSearchFocus } from "./useReadChapterSearchFocus";
import { useScriptureVerseBookmarks } from "./useScriptureVerseBookmarks";
import { ReadVerseBookmarkFeedback } from "./ReadVerseBookmarkFeedback";
import { recordTodayReadingChapterFraction } from "./reading-plan/today-reading-chapter-fraction";
import { markTodayReadingChapterVisit } from "./reading-plan/today-reading-done";
import { getLocalReadingPlanRegistry } from "./reading-plan/fetch-reading-plan-registry";
import { jumpReadChapter, navigateReadChapter, type ReadChapterNavDirection } from "./read-chapter-nav";
import {
  pushReadPlanFlowChapter,
  resolveTodayPlanLoopNextTarget,
  resolveTodayPlanLoopPrevTarget,
} from "./read-plan-flow-nav";
import { useTodayReadingPlan } from "./useTodayReadingPlan";
import { readScriptureSearchRoute } from "./readScriptureSearchRoute";
import { trackTelemetry } from "../telemetry/client";
import { writeLastReadPosition } from "./read-last-position";
import {
  isReadChapterCompleted,
  markReadChapterCompleted,
} from "./read-chapter-completion";
import { ReadVerseHighlightWordSheet, type HighlightWordEditorTarget } from "./ReadVerseHighlightWordSheet";
import { readChapterVerseTextHighlights } from "./read-verse-text-highlights";

function parseChapterParam(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function parseBookIdParam(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return String(s || "").trim().toUpperCase();
}

/** 与网站 `--read-parchment-pad-top`（4.5rem + safe-area）对齐，避开顶栏菜单/设置 */
const READ_CHAPTER_SCROLL_TOP_PAD = 72;
/** 嵌套 Text 内节号后间距：iOS 半字宽；Android 用 Em 空（U+2003，需与正文字号一致才占宽） */
const READ_VERSE_NUM_BODY_GAP = Platform.OS === "android" ? "\u2003" : "\u2002";
const READ_SETTINGS_TOP_OFFSET = 6;
const READ_TOP_ACTION_SIZE = 44;
const READ_TOP_ACTION_GAP = 1;
const READ_TOP_ACTION_IDLE_OPACITY = Platform.OS === "android" ? 0.72 : 0.5;
const READ_TOP_ACTION_PRESSED_OPACITY = Platform.OS === "android" ? 0.88 : 0.68;
const INFO_EDITION_V1_EN_ROLE_ID = "info_edition_v1_en";
const INFO_EDITION_GUIDE_V2_EN_ROLE_ID = "role_guide_v2_en";

function buildFallbackCatalogSections(tx: (key: string) => string): ScriptureCanonCatalogSection[] {
  const oldBooks = scriptureBooks
    .filter((book) => testamentForBookNumber(book.bookNumber) === "old")
    .map((book) => ({
      bookId: book.bookId,
      bookNumber: book.bookNumber,
      bookName: book.bookName,
      divine: "",
      summary: "",
    }));
  const newBooks = scriptureBooks
    .filter((book) => testamentForBookNumber(book.bookNumber) === "new")
    .map((book) => ({
      bookId: book.bookId,
      bookNumber: book.bookNumber,
      bookName: book.bookName,
      divine: "",
      summary: "",
    }));
  return [
    {
      sectionId: "fallback-old-testament",
      order: 1,
      title: tx("pages.read.catalogTestamentOld"),
      taglines: [],
      books: oldBooks,
    },
    {
      sectionId: "fallback-new-testament",
      order: 2,
      title: tx("pages.read.catalogTestamentNew"),
      taglines: [],
      books: newBooks,
    },
  ];
}

type VerseActionMenuState = { verse: number; text: string } | null;
const JUMP_CATALOG_VIEWPORT_H = 460;
type VerseHighlightMap = Map<number, string>;
type ChapterHighlightMap = Map<number, VerseHighlightMap>;
type ContrastVerseLine = { translationId: string; text: string };

function cloneHighlightMap(input: ChapterHighlightMap): ChapterHighlightMap {
  const out = new Map<number, VerseHighlightMap>();
  for (const [verse, set] of input.entries()) {
    out.set(verse, new Map(set));
  }
  return out;
}

export function ReadChapterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const chapterFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const scrollColumnMaxWidth = useParchmentColumnMaxWidth();
  const params = useLocalSearchParams<{
    bookId: string;
    chapter: string;
    verse?: string;
    q?: string;
    planFlow?: string;
    [EXPLORE_READ_RETURN_PARAM]?: string;
  }>();
  const bookId = parseBookIdParam(params.bookId);
  const chapter = parseChapterParam(params.chapter);
  const searchQuery = useMemo(() => {
    const raw = Array.isArray(params.q) ? params.q[0] : params.q;
    return normalizeScriptureSearchQuery(raw ?? "");
  }, [params.q, bookId, chapter]);
  const isPlanFlow = String(Array.isArray(params.planFlow) ? params.planFlow[0] : params.planFlow || "") === "1";
  const exploreReturn = resolveExploreReadReturnParam(params[EXPLORE_READ_RETURN_PARAM]);
  const returnToExplore = useReadChapterExploreReturnHandler(exploreReturn);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterData, setChapterData] = useState<LoadedChapter | null>(null);
  const [chapterSegments, setChapterSegments] = useState<ChapterSegment[] | null>(null);
  const [contrastByVerse, setContrastByVerse] = useState<Map<number, ContrastVerseLine[]> | null>(null);
  const [contrastLoadRequested, setContrastLoadRequested] = useState(false);
  const [highlightsLoadRequested, setHighlightsLoadRequested] = useState(false);
  const [postReadingReady, setPostReadingReady] = useState(false);
  const [xrefVerseNumbers, setXrefVerseNumbers] = useState<Set<number> | null>(null);
  const [xrefSheetBundle, setXrefSheetBundle] = useState<ScriptureVerseXrefs | null>(null);
  const [xrefSheetLoading, setXrefSheetLoading] = useState(false);
  const [xrefSheetVerse, setXrefSheetVerse] = useState<number | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpPickerBookId, setJumpPickerBookId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollHeaderHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const lastVerseTapRef = useRef<{ verse: number; at: number } | null>(null);
  const longPressCopiedVerseRef = useRef<number | null>(null);
  const [bookmarkFeedback, setBookmarkFeedback] = useState<string | null>(null);
  const [verseSelectionMode, setVerseSelectionMode] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [highlightedVerseIndexes, setHighlightedVerseIndexes] = useState<ChapterHighlightMap>(
    new Map(),
  );
  const [verseActionMenu, setVerseActionMenu] = useState<VerseActionMenuState>(null);
  const [highlightWordEditor, setHighlightWordEditor] = useState<HighlightWordEditorTarget | null>(null);
  const [chapterCompleted, setChapterCompleted] = useState(false);
  const [audioViewportHeight, setAudioViewportHeight] = useState(0);
  const registryPlans = useMemo(() => getLocalReadingPlanRegistry().plans, []);
  const todayPlan = useTodayReadingPlan(registryPlans, { enabled: chapterFocused && isPlanFlow });
  const planFlowNextTarget = useMemo(() => {
    if (!isPlanFlow || !chapterData) return null;
    return resolveTodayPlanLoopNextTarget(todayPlan.payload, chapterData.bookId, chapterData.chapter);
  }, [chapterData?.bookId, chapterData?.chapter, isPlanFlow, todayPlan.payload]);
  const planFlowPrevTarget = useMemo(() => {
    if (!isPlanFlow || !chapterData) return null;
    return resolveTodayPlanLoopPrevTarget(todayPlan.payload, chapterData.bookId, chapterData.chapter);
  }, [chapterData?.bookId, chapterData?.chapter, isPlanFlow, todayPlan.payload]);
  const chapterCompletionMarkedRef = useRef(false);
  const chapterScrollIntentRef = useRef(false);
  const deferredXrefTaskRef = useRef<{ cancel: () => void } | null>(null);
  const deferredContrastTaskRef = useRef<{ cancel: () => void } | null>(null);
  const lastRecordedFractionRef = useRef<{ bookId: string; chapter: number; fraction: number } | null>(
    null,
  );
  const clearBookmarkFeedback = useCallback(() => setBookmarkFeedback(null), []);
  const { isBookmarked, toggle: toggleVerseBookmark } = useScriptureVerseBookmarks();
  const { locale } = useLocale();
  const swipe = useShellSwipeNav();
  const {
    px,
    primaryTranslationId,
    contrastTranslationIds,
    translationCatalog,
    translationCatalogReady,
    verseParagraphFlow,
    chapterSegmentMode,
  } =
    useReadBibleTypography();
  const translationCatalogRef = useRef(translationCatalog);
  translationCatalogRef.current = translationCatalog;
  const chapterDataRef = useRef(chapterData);
  chapterDataRef.current = chapterData;
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const chapterLoadSeqRef = useRef(0);
  const {
    searchFocusVerse,
    verseLayoutsRef,
    scrollOffsetRef,
    scrollViewportHeight,
    onScrollViewportLayout,
    onChapterScrollOffset,
    reportVerseLayoutFromEvent,
    refreshScrollViewportTop,
  } = useReadChapterSearchFocus(chapterData, params.verse, scrollRef, scrollContentHeightRef);
  const primaryTranslationMeta = useMemo(
    () => translationCatalog.find((tr) => tr.id === primaryTranslationId),
    [translationCatalog, primaryTranslationId],
  );
  const preferEnglishSegmentTitles = useMemo(
    () =>
      preferEnglishChapterSegmentTitles(
        primaryTranslationId,
        primaryTranslationMeta?.language,
      ),
    [primaryTranslationId, primaryTranslationMeta?.language],
  );
  const readDisplayLocale = useMemo<AppLocale>(() => {
    const lang = String(primaryTranslationMeta?.language ?? "").toLowerCase();
    if (lang.startsWith("en")) return "en";
    if (lang.startsWith("zh")) return locale === "zh-TW" ? "zh-TW" : "zh-CN";
    const verseSample = chapterData?.verses
      ?.slice(0, 3)
      .map((row) => row.text)
      .join(" ");
    if (verseSample) {
      if (/[\u3400-\u9FFF]/.test(verseSample)) {
        return locale === "zh-TW" ? "zh-TW" : "zh-CN";
      }
      if (/[A-Za-z]/.test(verseSample)) {
        return "en";
      }
    }
    return locale;
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

  const catalogSections = useMemo(() => {
    try {
      const sections = getScriptureCanonCatalogSections();
      if (!sections.length) return buildFallbackCatalogSections(tr);
      return sections;
    } catch {
      return buildFallbackCatalogSections(tr);
    }
  }, [tr]);

  const load = useCallback(async () => {
    if (!translationCatalogReady) {
      const cached = chapterDataRef.current;
      if (
        cached?.bookId === bookId &&
        cached?.chapter === chapter &&
        cached?.translationId === primaryTranslationId
      ) {
        setChapterData(cached);
        setLoading(false);
        setError(null);
      } else {
        setLoading(true);
      }
      return;
    }

    const loadSeq = chapterLoadSeqRef.current;
    if (!bookId || chapter == null) {
      setError(t("pages.read.invalidChapter"));
      setChapterData(null);
      setLoading(false);
      return;
    }

    const cached = chapterDataRef.current;
    const hasCachedChapter =
      cached?.bookId === bookId &&
      cached?.chapter === chapter &&
      cached?.translationId === primaryTranslationId;

    if (!hasCachedChapter) {
      setLoading(true);
    }
    setError(null);

    try {
      const catalog = translationCatalogRef.current;
      const primaryMeta = catalog.find((item) => item.id === primaryTranslationId);
      const primaryLabels = {
        labelZh: primaryMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
        labelEn: primaryMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
      };

      const catalogIndex = {
        translations: catalog,
        defaultTranslationId: null as string | null,
      };
      const readyPrimaryId = await ensureScriptureTranslationReadyWithFallback(
        primaryTranslationId,
        translationMetaFromCatalog(catalogIndex, primaryTranslationId)?.downloadUrl,
      );

      if (loadSeq !== chapterLoadSeqRef.current) return;

      const loaded = await loadChapterFromBundledTranslation(
        bookId,
        chapter,
        readyPrimaryId,
        primaryLabels,
      );

      if (loadSeq !== chapterLoadSeqRef.current) return;

      if (!loaded) {
        setChapterData(null);
        setError(t("pages.read.chapterLoadError"));
        return;
      }
      setChapterData(loaded);
      setChapterSegments(
        loadBundledChapterSegments(loaded.bookId, loaded.chapter, chapterSegmentMode, {
          preferEnglishTitles: preferEnglishSegmentTitles,
        }),
      );
      InteractionManager.runAfterInteractions(() => {
        void writeLastReadPosition({
          bookId: loaded.bookId,
          chapter: loaded.chapter,
          bookName: loaded.bookName,
        });
      });

      // 对照译本不阻塞首屏；交叉引用仅建索引，详情在打开 sheet 时按需加载。
      deferredXrefTaskRef.current?.cancel();
      deferredContrastTaskRef.current?.cancel();
      InteractionManager.runAfterInteractions(() => {
        void recordTodayReadingChapterFraction(loaded.bookId, loaded.chapter, 0.1);
      });
      deferredXrefTaskRef.current = InteractionManager.runAfterInteractions(() => {
        void (async () => {
          if (!navigationRef.current.isFocused()) return;
          await warmScriptureXrefDatabase();
          if (!navigationRef.current.isFocused()) return;
          const verseNumbers = await loadChapterXrefVerseNumbers(bookId, chapter);
          if (!navigationRef.current.isFocused()) return;
          if (loadSeq !== chapterLoadSeqRef.current) return;
          setXrefVerseNumbers(verseNumbers.length ? new Set(verseNumbers) : new Set());
        })();
      });
    } catch (e) {
      if (loadSeq !== chapterLoadSeqRef.current) return;
      setChapterData(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (loadSeq === chapterLoadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [
    bookId,
    chapter,
    primaryTranslationId,
    chapterSegmentMode,
    translationCatalogReady,
    preferEnglishSegmentTitles,
  ]);

  useEffect(() => {
    if (!chapterData || !translationCatalogReady) return;
    setChapterSegments(
      loadBundledChapterSegments(chapterData.bookId, chapterData.chapter, chapterSegmentMode, {
        preferEnglishTitles: preferEnglishSegmentTitles,
      }),
    );
  }, [
    chapterData?.bookId,
    chapterData?.chapter,
    chapterSegmentMode,
    preferEnglishSegmentTitles,
    translationCatalogReady,
  ]);

  useLayoutEffect(() => {
    chapterLoadSeqRef.current += 1;
    setChapterData(null);
    setChapterSegments(null);
    setContrastByVerse(null);
    setContrastLoadRequested(false);
    setHighlightsLoadRequested(false);
    setPostReadingReady(false);
    setXrefVerseNumbers(null);
    setXrefSheetBundle(null);
    setXrefSheetLoading(false);
    verseLayoutsRef.current.clear();
    lastRecordedFractionRef.current = null;
    setLoading(true);
    setError(null);
    chapterScrollIntentRef.current = false;
  }, [bookId, chapter]);

  const prevPrimaryTranslationIdRef = useRef(primaryTranslationId);
  useEffect(() => {
    if (prevPrimaryTranslationIdRef.current === primaryTranslationId) return;
    prevPrimaryTranslationIdRef.current = primaryTranslationId;
    chapterLoadSeqRef.current += 1;
    void load();
  }, [primaryTranslationId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!bookId || chapter == null) return;
      const cached = chapterDataRef.current;
      if (
        cached?.bookId === bookId &&
        cached?.chapter === chapter &&
        cached?.translationId === primaryTranslationId
      ) {
        setChapterData(cached);
        setLoading(false);
        setError(null);
        return;
      }
      if (!translationCatalogReady) {
        setLoading(true);
        return;
      }
      void load();
    }, [bookId, chapter, primaryTranslationId, load, translationCatalogReady]),
  );

  useEffect(() => {
    if (!chapterFocused || loading || error || chapterData) return;
    if (!bookId || chapter == null) return;
    if (!translationCatalogReady) {
      setLoading(true);
      return;
    }
    setLoading(true);
    void load();
  }, [
    bookId,
    chapter,
    chapterData,
    chapterFocused,
    error,
    load,
    loading,
    translationCatalogReady,
  ]);

  useEffect(() => {
    if (!chapterFocused || !translationCatalogReady || !bookId || chapter == null) return;
    const cached = chapterDataRef.current;
    if (
      cached?.bookId === bookId &&
      cached?.chapter === chapter &&
      cached?.translationId === primaryTranslationId
    ) {
      return;
    }
    void load();
  }, [bookId, chapter, chapterFocused, load, primaryTranslationId, translationCatalogReady]);

  useEffect(() => {
    return () => {
      deferredXrefTaskRef.current?.cancel();
      deferredContrastTaskRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [bookId, chapter]);

  useEffect(() => {
    if (!chapterData) return;
    const task = InteractionManager.runAfterInteractions(() => {
      trackTelemetry("read_chapter_open", {
        book_id: chapterData.bookId,
        chapter: chapterData.chapter,
      });
    });
    return () => task.cancel();
  }, [chapterData?.bookId, chapterData?.chapter]);

  useEffect(() => {
    if (!chapterData || contrastTranslationIds.length === 0 || contrastLoadRequested) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setContrastLoadRequested(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [
    chapterData?.bookId,
    chapterData?.chapter,
    chapterFocused,
    contrastLoadRequested,
    contrastTranslationIds.length,
  ]);

  useEffect(() => {
    if (!chapterData || highlightsLoadRequested) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setHighlightsLoadRequested(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [chapterData?.bookId, chapterData?.chapter, chapterFocused, highlightsLoadRequested]);

  useEffect(() => {
    if (!chapterData || postReadingReady) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setPostReadingReady(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [chapterData?.bookId, chapterData?.chapter, chapterFocused, postReadingReady]);


  useEffect(() => {
    if (chapterCompleted) setPostReadingReady(true);
  }, [chapterCompleted]);

  useEffect(() => {
    if (!chapterData || !contrastLoadRequested || contrastTranslationIds.length === 0) return;

    const contrastMetas = contrastTranslationIds
      .map((id) => translationCatalog.find((tr) => tr.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!contrastMetas.length) return;

    const catalogIndex = {
      translations: translationCatalog,
      defaultTranslationId: null as string | null,
    };

    deferredContrastTaskRef.current?.cancel();
    deferredContrastTaskRef.current = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        if (!navigation.isFocused()) return;

        const map = new Map<number, ContrastVerseLine[]>();
        for (const meta of contrastMetas) {
          if (!navigation.isFocused()) return;
          try {
            await ensureScriptureTranslationReady(
              meta.id,
              translationMetaFromCatalog(catalogIndex, meta.id)?.downloadUrl,
            );
          } catch {
            continue;
          }
          const loaded = await loadChapterFromBundledTranslation(
            bookId,
            chapter,
            meta.id,
            { labelZh: meta.labelZh, labelEn: meta.labelEn },
          );
          if (!loaded?.verses?.length) continue;
          for (const v of loaded.verses) {
            const bucket = map.get(v.verse) ?? [];
            bucket.push({ translationId: loaded.translationId, text: v.text });
            map.set(v.verse, bucket);
          }
        }
        if (!navigation.isFocused()) return;
        setContrastByVerse(map.size ? map : null);
      })();
    });

    return () => {
      deferredContrastTaskRef.current?.cancel();
    };
  }, [
    bookId,
    chapter,
    chapterData,
    contrastLoadRequested,
    contrastTranslationIds,
    navigation,
    translationCatalog,
  ]);

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

  const segmentMeta = useMemo(() => {
    const headingByVerse = new Map<number, string[]>();
    const paragraphStarts = new Set<number>();
    for (const row of chapterSegments ?? []) {
      if (!Number.isInteger(row.verseStart) || row.verseStart == null) continue;
      if (row.type === "heading") {
        const text = resolveChapterSegmentHeadingText(
          row,
          readDisplayLocale,
          localeZhText,
          preferEnglishSegmentTitles,
        );
        if (text) {
          const bucket = headingByVerse.get(row.verseStart) ?? [];
          bucket.push(text);
          headingByVerse.set(row.verseStart, bucket);
        }
      }
      if (row.type === "paragraph" || row.type === "poetry") {
        paragraphStarts.add(row.verseStart);
      }
    }
    return { headingByVerse, paragraphStarts };
  }, [chapterSegments, readDisplayLocale, localeZhText, preferEnglishSegmentTitles]);
  const useParagraphFlowLayout = verseParagraphFlow && contrastTranslationIds.length === 0;

  const paragraphGroups = useMemo(() => {
    const verses = chapterData?.verses ?? [];
    const groups: Array<{ verses: typeof verses }> = [];
    let current: typeof verses = [];
    for (let i = 0; i < verses.length; i += 1) {
      const verse = verses[i]!;
      const isStart =
        i === 0 ||
        segmentMeta.paragraphStarts.has(verse.verse) ||
        (segmentMeta.headingByVerse.get(verse.verse)?.length ?? 0) > 0;
      if (isStart && current.length > 0) {
        groups.push({ verses: current });
        current = [];
      }
      current.push(verse);
    }
    if (current.length > 0) groups.push({ verses: current });
    return groups;
  }, [chapterData?.verses, segmentMeta.headingByVerse, segmentMeta.paragraphStarts]);

  const goNeighbor = useCallback(
    (target: { bookId: string; chapter: number } | null, direction: ReadChapterNavDirection) => {
      if (!target || !chapterData) return;
      if (target.bookId === chapterData.bookId && target.chapter === chapterData.chapter) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigateReadChapter(router, target, direction);
    },
    [chapterData, router],
  );

  const onAdvanceChapterAudio = useCallback(
    (next: { bookId: string; chapter: number }) => {
      if (isPlanFlow && planFlowNextTarget) {
        pushReadPlanFlowChapter(router, planFlowNextTarget);
        return;
      }
      goNeighbor(next, "forward");
    },
    [goNeighbor, isPlanFlow, planFlowNextTarget, router],
  );

  const { activeVerseIndex, nearAudioEnd } = useReadChapterAudio(
    chapterData,
    scrollRef,
    scrollHeaderHeightRef,
    onAdvanceChapterAudio,
    {
      verseLayoutsRef,
      scrollViewportHeight: audioViewportHeight || scrollViewportHeight,
      scrollOffsetRef,
      scrollContentHeightRef,
    },
  );

  const markChapterDone = useCallback(() => {
    if (!chapterData) return;
    if (chapterCompletionMarkedRef.current) return;
    chapterCompletionMarkedRef.current = true;
    setChapterCompleted(true);
    void markReadChapterCompleted(chapterData.bookId, chapterData.chapter);
    void markTodayReadingChapterVisit(chapterData.bookId, chapterData.chapter);
  }, [chapterData]);

  useEffect(() => {
    if (!chapterData) return;
    chapterCompletionMarkedRef.current = false;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void isReadChapterCompleted(chapterData.bookId, chapterData.chapter).then((done) => {
        if (cancelled) return;
        setChapterCompleted(done);
        if (done) chapterCompletionMarkedRef.current = true;
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [chapterData?.bookId, chapterData?.chapter]);

  useEffect(() => {
    if (!nearAudioEnd) return;
    markChapterDone();
  }, [markChapterDone, nearAudioEnd]);

  useEffect(() => {
    if (!chapterData || !chapterCompleted) return;
    void markTodayReadingChapterVisit(chapterData.bookId, chapterData.chapter);
  }, [chapterData?.bookId, chapterData?.chapter, chapterCompleted]);

  const onChapterScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { y } = event.nativeEvent.contentOffset;
      onChapterScrollOffset(y);
      const { height: contentH } = event.nativeEvent.contentSize;
      if (contentH > 0) scrollContentHeightRef.current = contentH;
      const { height: viewportH } = event.nativeEvent.layoutMeasurement;
      if (!chapterData || contentH <= 0 || viewportH <= 0) return;
      const scrollProgress = Math.min(1, (y + viewportH) / contentH);
      if (y > 12 || scrollProgress > 0.04) {
        chapterScrollIntentRef.current = true;
        setContrastLoadRequested((prev) => prev || true);
        setHighlightsLoadRequested((prev) => prev || true);
      }
      void recordTodayReadingChapterFraction(
        chapterData.bookId,
        chapterData.chapter,
        scrollProgress,
      );
      if (scrollProgress > 0.58 || y + viewportH >= contentH - 160) {
        setPostReadingReady(true);
      }
      if (scrollProgress >= 0.88 || y + viewportH >= contentH - 48) {
        markChapterDone();
      }
    },
    [chapterData, markChapterDone, onChapterScrollOffset],
  );

  const onChapterContentSizeChange = useCallback(
    (_w: number, contentH: number) => {
      if (!chapterData || contentH <= 0) return;
      scrollContentHeightRef.current = contentH;
      const viewportH = audioViewportHeight || scrollViewportHeight;
      if (viewportH <= 0) return;
      if (contentH <= viewportH + 40) {
        chapterScrollIntentRef.current = true;
        void recordTodayReadingChapterFraction(chapterData.bookId, chapterData.chapter, 1);
        markChapterDone();
      }
    },
    [audioViewportHeight, chapterData, markChapterDone, scrollViewportHeight],
  );

  useEffect(() => {
    if (!chapterData?.verses.length) return;
    const total = chapterData.verses.length;
    const verseIdx =
      activeVerseIndex != null && activeVerseIndex >= 0 && activeVerseIndex < total
        ? activeVerseIndex
        : -1;
    const fraction = verseIdx >= 0 ? Math.min(1, (verseIdx + 1) / total) : 0;
    const prev = lastRecordedFractionRef.current;
    if (
      prev?.bookId === chapterData.bookId &&
      prev?.chapter === chapterData.chapter &&
      Math.abs(prev.fraction - fraction) < 0.04
    ) {
      return;
    }
    const timer = setTimeout(() => {
      lastRecordedFractionRef.current = {
        bookId: chapterData.bookId,
        chapter: chapterData.chapter,
        fraction,
      };
      void recordTodayReadingChapterFraction(chapterData.bookId, chapterData.chapter, fraction);
    }, 700);
    return () => clearTimeout(timer);
  }, [chapterData, activeVerseIndex]);

  const onChapterSwipe = useCallback(
    (direction: "left" | "right") => {
      // 阅读序：左划下一章（新页从右进），右划上一章（新页从左进）；与首页场景条左右空间模型相反
      if (direction === "left") {
        if (isPlanFlow && planFlowNextTarget) {
          pushReadPlanFlowChapter(router, planFlowNextTarget);
          return;
        }
        goNeighbor(neighbors.next, "forward");
        return;
      }
      if (isPlanFlow && planFlowPrevTarget) {
        pushReadPlanFlowChapter(router, planFlowPrevTarget);
        return;
      }
      goNeighbor(neighbors.prev, "back");
    },
    [goNeighbor, isPlanFlow, neighbors.next, neighbors.prev, planFlowNextTarget, planFlowPrevTarget, router],
  );

  useShellSwipeAction(
    Boolean(chapterData) &&
      !jumpOpen &&
      !verseSelectionMode &&
      verseActionMenu == null &&
      !highlightWordEditor,
    onChapterSwipe,
  );
  useShellSwipeSuspend(
    jumpOpen || verseSelectionMode || verseActionMenu != null || highlightWordEditor != null,
  );

  const onVersePress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
      if (highlightWordEditor) return;
      if (verseSelectionMode) {
        setSelectedVerses((prev) =>
          prev.includes(verse)
            ? prev.filter((v) => v !== verse)
            : [...prev, verse].sort((a, b) => a - b),
        );
        swipe?.markExclude();
        return;
      }
      if (longPressCopiedVerseRef.current === verse) {
        longPressCopiedVerseRef.current = null;
        return;
      }
      const now = Date.now();
      const prev = lastVerseTapRef.current;
      if (prev?.verse === verse && now - prev.at < 420) {
        lastVerseTapRef.current = null;
        void (async () => {
          const ref = {
            bookId: chapterData.bookId,
            bookName: displayBookName,
            chapter: chapterData.chapter,
            verse,
            translationId: chapterData.translationId,
            text: localeZhText(text),
          };
          const added = await toggleVerseBookmark(ref);
          void Haptics.notificationAsync(
            added
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning,
          );
          setBookmarkFeedback(
            added ? tr("pages.read.verseBookmarkSaved") : tr("pages.read.verseBookmarkRemoved"),
          );
        })();
        return;
      }
      lastVerseTapRef.current = { verse, at: now };
    },
    [chapterData, highlightWordEditor, verseSelectionMode, toggleVerseBookmark, swipe, localeZhText, tr],
  );

  const onVerseLongPress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
      if (highlightWordEditor) return;
      if (verseSelectionMode) return;
      longPressCopiedVerseRef.current = verse;
      swipe?.markExclude();
      setVerseActionMenu({ verse, text });
    },
    [chapterData, highlightWordEditor, swipe, verseSelectionMode],
  );

  /** Android 收藏字下色带会拦截父级 Text/Pressable 的点击，改由节文组件接收 */
  const verseBodyPressProps = useCallback(
    (verse: number, text: string) => {
      if (highlightWordEditor || Platform.OS !== "android") return {};
      return {
        onPress: () => onVersePress(verse, text),
        onLongPress: () => onVerseLongPress(verse, text),
      };
    },
    [highlightWordEditor, onVerseLongPress, onVersePress],
  );

  const parentVersePressHandler = useCallback(
    (verse: number, text: string) => {
      if (highlightWordEditor || Platform.OS === "android") return undefined;
      return () => onVersePress(verse, text);
    },
    [highlightWordEditor, onVersePress],
  );

  const parentVerseLongPressHandler = useCallback(
    (verse: number, text: string) => {
      if (highlightWordEditor || Platform.OS === "android") return undefined;
      return () => onVerseLongPress(verse, text);
    },
    [highlightWordEditor, onVerseLongPress],
  );

  const copySelectedVerses = useCallback(async () => {
    if (!chapterData || selectedVerses.length === 0) {
      setBookmarkFeedback(tr("pages.read.verseSelectionEmpty"));
      return;
    }
    swipe?.markExclude();
    const selectedText = selectedVerses
      .map((verse) => {
        const row = chapterData.verses.find((v) => v.verse === verse);
        return row
          ? `${displayBookName} ${chapterData.chapter}:${verse} ${localeZhText(row.text)}`
          : null;
      })
      .filter((x): x is string => Boolean(x))
      .join("\n");
    const ok = await copyTextToClipboard(selectedText);
    void Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
    setBookmarkFeedback(
      ok
        ? tr("pages.read.verseSelectionCopied", { count: selectedVerses.length })
        : tr("pages.read.verseCopyFailed"),
    );
    lastVerseTapRef.current = null;
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }, [chapterData, displayBookName, localeZhText, selectedVerses, swipe, tr]);

  const exitVerseSelectionMode = useCallback(() => {
    lastVerseTapRef.current = null;
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }, []);

  const runCopyCurrentVerse = useCallback(async () => {
    if (!chapterData || !verseActionMenu) return;
    const copied = await copyScriptureVerseToClipboard({
      bookName: displayBookName,
      chapter: chapterData.chapter,
      verse: verseActionMenu.verse,
      text: localeZhText(verseActionMenu.text),
    });
    void Haptics.notificationAsync(
      copied
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    setBookmarkFeedback(copied ? tr("pages.read.verseCopied") : tr("pages.read.verseCopyFailed"));
    setVerseActionMenu(null);
  }, [chapterData, displayBookName, verseActionMenu, localeZhText, tr]);

  const runToggleVerseBookmarkFromMenu = useCallback(async () => {
    if (!chapterData || !verseActionMenu) return;
    const ref = {
      bookId: chapterData.bookId,
      bookName: displayBookName,
      chapter: chapterData.chapter,
      verse: verseActionMenu.verse,
      translationId: chapterData.translationId,
      text: localeZhText(verseActionMenu.text),
    };
    const added = await toggleVerseBookmark(ref);
    void Haptics.notificationAsync(
      added
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    setBookmarkFeedback(
      added ? tr("pages.read.verseBookmarkSaved") : tr("pages.read.verseBookmarkRemoved"),
    );
    setVerseActionMenu(null);
  }, [chapterData, displayBookName, localeZhText, toggleVerseBookmark, tr, verseActionMenu]);

  const verseActionMenuBookmarked = useMemo(() => {
    if (!chapterData || !verseActionMenu) return false;
    return isBookmarked({
      translationId: chapterData.translationId,
      bookId: chapterData.bookId,
      chapter: chapterData.chapter,
      verse: verseActionMenu.verse,
    });
  }, [chapterData, isBookmarked, verseActionMenu]);

  const runStartMultiCopy = useCallback(() => {
    if (!verseActionMenu) return;
    setVerseSelectionMode(true);
    setSelectedVerses([verseActionMenu.verse]);
    setVerseActionMenu(null);
  }, [verseActionMenu]);

  const runOpenHighlightEditor = useCallback(() => {
    if (!verseActionMenu) return;
    setHighlightWordEditor({
      verse: verseActionMenu.verse,
      text: localeZhText(verseActionMenu.text),
    });
    setVerseActionMenu(null);
  }, [localeZhText, verseActionMenu]);

  const handleHighlightWordSaved = useCallback((verse: number, highlights: Map<number, string> | null) => {
    setHighlightedVerseIndexes((prev) => {
      const next = cloneHighlightMap(prev);
      if (highlights?.size) next.set(verse, highlights);
      else next.delete(verse);
      return next;
    });
  }, []);

  const runShareVerse = useCallback(() => {
    if (!chapterData || !verseActionMenu) return;
    const message = `${displayBookName} ${chapterData.chapter}:${verseActionMenu.verse}\n${localeZhText(verseActionMenu.text)}`;
    void Share.share({ message })
      .then(() => {
        setVerseActionMenu(null);
      })
      .catch(() => {
        setBookmarkFeedback(tr("pages.read.verseShareFailed"));
        setVerseActionMenu(null);
      });
  }, [chapterData, verseActionMenu, localeZhText, displayBookName, tr]);

  useEffect(() => {
    setVerseSelectionMode(false);
    setSelectedVerses([]);
    setVerseActionMenu(null);
    setHighlightWordEditor(null);
  }, [chapterData?.bookId, chapterData?.chapter]);

  useEffect(() => {
    if (!chapterData || !highlightsLoadRequested) {
      if (!chapterData) setHighlightedVerseIndexes(new Map());
      return;
    }
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readChapterVerseTextHighlights({
        translationId: chapterData.translationId,
        bookId: chapterData.bookId,
        chapter: chapterData.chapter,
      }).then((map) => {
        if (cancelled || !chapterFocused) return;
        setHighlightedVerseIndexes(map);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [
    chapterData?.translationId,
    chapterData?.bookId,
    chapterData?.chapter,
    chapterFocused,
    highlightsLoadRequested,
  ]);

  const jumpToChapter = useCallback(
    (nextBookId: string, nextChapter: number) => {
      setJumpOpen(false);
      setJumpPickerBookId(null);
      deferChapterPickerNavigation(() => {
        jumpReadChapter(router, { bookId: nextBookId, chapter: nextChapter });
      });
    },
    [router],
  );

  const openCatalogChrome = useCallback(() => {
    setJumpOpen(true);
  }, []);

  const onJumpBookPress = useCallback((book: { bookId: string }) => {
    const show = () => setJumpPickerBookId(book.bookId);
    if (Platform.OS === "android") {
      setTimeout(show, 120);
      return;
    }
    show();
  }, []);

  useEffect(() => {
    if (!jumpOpen) setJumpPickerBookId(null);
  }, [jumpOpen]);

  const goReadHomeFromCatalog = useCallback(() => {
    setJumpOpen(false);
    router.push("/read");
  }, [router]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const goNextChrome = useCallback(() => {
    if (isPlanFlow && planFlowNextTarget) {
      pushReadPlanFlowChapter(router, planFlowNextTarget);
      return;
    }
    goNeighbor(neighbors.next, "forward");
  }, [goNeighbor, isPlanFlow, neighbors.next, planFlowNextTarget, router]);

  const goPrevChrome = useCallback(() => {
    if (isPlanFlow && planFlowPrevTarget) {
      pushReadPlanFlowChapter(router, planFlowPrevTarget);
      return;
    }
    goNeighbor(neighbors.prev, "back");
  }, [goNeighbor, isPlanFlow, neighbors.prev, planFlowPrevTarget, router]);

  const chapterHasNext = isPlanFlow ? Boolean(planFlowNextTarget) : Boolean(neighbors.next);

  useEffect(() => {
    const syncChrome = () => {
      if (!navigation.isFocused() || !chapterData) {
        setReadChapterBottomChromeApi(null);
        return;
      }
      setReadChapterBottomChromeApi({
        openCatalog: openCatalogChrome,
        goNext: goNextChrome,
        hasNext: chapterHasNext,
      });
    };

    syncChrome();
    const onFocus = navigation.addListener("focus", syncChrome);
    const onBlur = navigation.addListener("blur", () => {
      setReadChapterBottomChromeApi(null);
    });
    return () => {
      onFocus();
      onBlur();
      setReadChapterBottomChromeApi(null);
    };
  }, [
    chapterData,
    goNextChrome,
    navigation,
    chapterHasNext,
    openCatalogChrome,
  ]);

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={c.muted} />
          <Text style={styles.statusText}>{tr("pages.read.loadingChapter")}</Text>
        </View>
      ) : error ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryBtnText}>{tr("pages.read.retry")}</Text>
          </Pressable>
        </View>
      ) : chapterData ? (
        <ParchmentBottomFadeScrollView
          ref={scrollRef}
          style={styles.scroll}
          scrollEnabled={highlightWordEditor == null}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            onScrollViewportLayout(h);
            setAudioViewportHeight(h > 0 ? Math.round(h) : 0);
            refreshScrollViewportTop();
          }}
          onScroll={onChapterScroll}
          onContentSizeChange={onChapterContentSizeChange}
          scrollEventThrottle={120}
          contentContainerStyle={[
            styles.scrollContent,
            scrollColumnMaxWidth != null ? { maxWidth: scrollColumnMaxWidth } : null,
            {
              paddingTop: READ_CHAPTER_SCROLL_TOP_PAD + insets.top,
              paddingBottom: readChapterScrollBottomPad(insets.bottom, true),
            },
          ]}
        >
          <View
            style={styles.header}
            onLayout={(e) => {
              scrollHeaderHeightRef.current = Math.round(e.nativeEvent.layout.height);
            }}
          >
            <Text style={[styles.chapterTitle, { fontSize: px.chapterTitleSize }]}>
              {chapterTitleText}
            </Text>
          </View>

          {useParagraphFlowLayout
            ? paragraphGroups.map((group, groupIndex) => {
                const firstVerse = group.verses[0];
                if (!firstVerse) return null;
                const headings = segmentMeta.headingByVerse.get(firstVerse.verse) ?? [];
                const showParagraphBreak = groupIndex > 0;
                const showParagraphRule = showParagraphBreak && headings.length > 0;
                return (
                  <Fragment key={`pg:${firstVerse.verse}`}>
                    {showParagraphBreak ? (
                      showParagraphRule ? (
                        <View style={styles.segmentParagraphBreakWithRule}>
                          <View style={styles.segmentParagraphRule} />
                        </View>
                      ) : (
                        <View style={styles.segmentParagraphBreak} />
                      )
                    ) : null}
                    {headings.map((heading, idx) => (
                      <Text
                        key={`${firstVerse.verse}:h:${idx}`}
                        style={[
                          styles.segmentHeading,
                          {
                            fontSize: px.verseFontSize + 1,
                            lineHeight: px.verseLineHeight + 2,
                          },
                        ]}
                      >
                        {heading}
                      </Text>
                    ))}
                    <View style={styles.verseParagraphBlock}>
                      <Text
                        style={[
                          styles.versePrimaryLine,
                          {
                            fontSize: px.verseFontSize,
                            lineHeight: px.verseLineHeight,
                          },
                        ]}
                      >
                        {group.verses.map((v) => {
                          const verseIndex = verseIndexByVerse.get(v.verse) ?? -1;
                          const searchFocus = searchFocusVerse === v.verse;
                          const selected = selectedVerses.includes(v.verse);
                          const highlightedIndexes = highlightedVerseIndexes.get(v.verse) ?? null;
                          const bookmarked = isBookmarked({
                            translationId: chapterData.translationId,
                            bookId: chapterData.bookId,
                            chapter: chapterData.chapter,
                            verse: v.verse,
                          });
                          const audioActive =
                            !searchFocus && !bookmarked && verseIndex >= 0 && activeVerseIndex === verseIndex;
                          const verseAudioChunkKey =
                            Platform.OS === "android"
                              ? `pv:${v.verse}:audio:${audioActive ? "on" : "off"}:sel:${selected ? 1 : 0}:bm:${bookmarked ? 1 : 0}`
                              : `pv:${v.verse}`;
                          const suppressVerseMarker = searchFocus || audioActive;
                          const verseHighlight = suppressVerseMarker
                            ? undefined
                            : verseTextHighlightStyleForVerse({
                                isGolden: v.isGolden,
                                bookmarked,
                              });
                          const verseNumHighlight = undefined;
                          const highlightKind = selected
                            ? "selection"
                            : suppressVerseMarker
                              ? undefined
                              : bookmarked
                                ? "bookmark"
                                : v.isGolden
                                  ? "golden"
                                  : undefined;
                          const verseChunkBackgroundStyle = selected
                            ? styles.verseInlineChunkSelected
                            : searchFocus
                              ? styles.verseInlineChunkSearchFocus
                              : audioActive
                                ? styles.verseInlineChunkAudioActive
                                : styles.verseInlineChunkAudioIdle;
                          const hasXref = Boolean(xrefVerseNumbers?.has(v.verse));
                          return (
                            <Text
                              key={verseAudioChunkKey}
                              onPress={parentVersePressHandler(v.verse, v.text)}
                              onLongPress={parentVerseLongPressHandler(v.verse, v.text)}
                              suppressHighlighting
                              onLayout={(e) => reportVerseLayoutFromEvent(v.verse, e)}
                              style={[
                                styles.verseInlineChunk,
                                verseChunkBackgroundStyle,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.verseNum,
                                  Platform.OS === "android" && styles.verseNumAndroid,
                                  {
                                    fontSize: px.verseNumFontSize,
                                    lineHeight: px.verseLineHeight,
                                  },
                                  Platform.OS === "android" && {
                                    paddingTop: Math.max(
                                      0,
                                      Math.round((px.verseLineHeight - px.verseNumFontSize) * 0.1),
                                    ),
                                  },
                                  searchFocus && styles.verseNumSearchFocus,
                                  audioActive && styles.verseNumActive,
                                  selected && styles.verseNumSelected,
                                  verseNumHighlight,
                                  hasXref && styles.verseNumXref,
                                ]}
                                onPress={
                                  hasXref
                                    ? () => {
                                        setXrefSheetVerse(v.verse);
                                      }
                                    : undefined
                                }
                                suppressHighlighting={!hasXref}
                                accessibilityRole={hasXref ? "button" : undefined}
                                accessibilityLabel={
                                  hasXref
                                    ? `${v.verse}, ${tr("pages.read.verseXrefMarkerA11y")}`
                                    : undefined
                                }
                              >
                                {v.verse}
                              </Text>
                              <Text
                                style={{
                                  fontSize: px.verseFontSize,
                                  lineHeight: px.verseLineHeight,
                                }}
                              >
                                {READ_VERSE_NUM_BODY_GAP}
                              </Text>
                              <ReadChapterVerseText
                                key={`pvtext:${v.verse}:view:${selected ? "s" : "n"}:${bookmarked ? "b" : "n"}`}
                                inline
                                highlight={highlightKind}
                                text={localeZhText(v.text)}
                                parts={speechPartsByVerse?.get(v.verse) ?? null}
                                highlightedCharIndexes={highlightedIndexes}
                                searchKeyword={searchFocus && searchQuery ? searchQuery : null}
                                {...verseBodyPressProps(v.verse, v.text)}
                              />
                              <Text>{" "}</Text>
                            </Text>
                          );
                        })}
                      </Text>
                    </View>
                  </Fragment>
                );
              })
            : chapterData.verses.map((v, i) => {
                const headings = segmentMeta.headingByVerse.get(v.verse) ?? [];
                const showParagraphBreak = i > 0 && segmentMeta.paragraphStarts.has(v.verse);
                const showParagraphRule = showParagraphBreak && headings.length > 0;
                const nextVerse = chapterData.verses[i + 1];
                const nextHasParagraphBreak =
                  nextVerse != null && segmentMeta.paragraphStarts.has(nextVerse.verse);
                const searchFocus = searchFocusVerse === v.verse;
                const highlightedIndexes = highlightedVerseIndexes.get(v.verse) ?? null;
                const bookmarked = isBookmarked({
                  translationId: chapterData.translationId,
                  bookId: chapterData.bookId,
                  chapter: chapterData.chapter,
                  verse: v.verse,
                });
                const audioActive = !searchFocus && !bookmarked && activeVerseIndex === i;
                const selected = selectedVerses.includes(v.verse);
                const verseBlockKey =
                  Platform.OS === "android"
                    ? `v:${v.verse}:audio:${audioActive ? "on" : "off"}:sel:${selected ? 1 : 0}:bm:${bookmarked ? 1 : 0}`
                    : `${v.verse}`;
                const suppressVerseMarker = searchFocus || audioActive;
                const verseHighlight = suppressVerseMarker
                  ? undefined
                  : verseTextHighlightStyleForVerse({
                      isGolden: v.isGolden,
                      bookmarked,
                    });
                const verseNumHighlight = undefined;
                const highlightKind = selected
                  ? "selection"
                  : suppressVerseMarker
                    ? undefined
                    : bookmarked
                      ? "bookmark"
                      : v.isGolden
                        ? "golden"
                        : undefined;
                const verseBlockBackgroundStyle = selected
                  ? styles.verseBlockSelected
                  : searchFocus
                    ? styles.verseLineSearchFocus
                    : audioActive
                      ? styles.verseLineActive
                      : styles.verseLineIdle;
                const hasXref = Boolean(xrefVerseNumbers?.has(v.verse));
                return (
                  <Fragment key={verseBlockKey}>
                    {showParagraphBreak ? (
                      showParagraphRule ? (
                        <View style={styles.segmentParagraphBreakWithRule}>
                          <View style={styles.segmentParagraphRule} />
                        </View>
                      ) : (
                        <View style={styles.segmentParagraphBreak} />
                      )
                    ) : null}
                    {headings.map((heading, idx) => (
                      <Text
                        key={`${v.verse}:h:${idx}`}
                        style={[
                          styles.segmentHeading,
                          {
                            fontSize: px.verseFontSize + 1,
                            lineHeight: px.verseLineHeight + 2,
                          },
                        ]}
                      >
                        {heading}
                      </Text>
                    ))}
                    <Pressable
                      onPress={parentVersePressHandler(v.verse, v.text)}
                      onLongPress={parentVerseLongPressHandler(v.verse, v.text)}
                      delayLongPress={280}
                      onLayout={(e) => reportVerseLayoutFromEvent(v.verse, e)}
                      accessibilityRole="button"
                      accessibilityHint={
                        verseSelectionMode
                          ? tr("pages.read.verseSelectionTapA11yHint")
                          : tr("pages.read.verseBookmarkA11yHint")
                      }
                    >
                      <View
                        style={[
                          styles.verseBlock,
                          nextHasParagraphBreak && styles.verseBlockBeforeSegmentBreak,
                          verseBlockBackgroundStyle,
                        ]}
                      >
                        <Text
                          style={[
                            styles.versePrimaryLine,
                            {
                              fontSize: px.verseFontSize,
                              lineHeight: px.verseLineHeight,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.verseNum,
                              Platform.OS === "android" && styles.verseNumAndroid,
                              {
                                fontSize: px.verseNumFontSize,
                                lineHeight: px.verseLineHeight,
                              },
                              Platform.OS === "android" && {
                                paddingTop: Math.max(
                                  0,
                                  Math.round((px.verseLineHeight - px.verseNumFontSize) * 0.1),
                                ),
                              },
                              searchFocus && styles.verseNumSearchFocus,
                              audioActive && styles.verseNumActive,
                              selected && styles.verseNumSelected,
                              verseNumHighlight,
                              hasXref && styles.verseNumXref,
                            ]}
                            onPress={
                              hasXref
                                ? () => {
                                    setXrefSheetVerse(v.verse);
                                  }
                                : undefined
                            }
                            suppressHighlighting={!hasXref}
                            accessibilityRole={hasXref ? "button" : undefined}
                            accessibilityLabel={
                              hasXref
                                ? `${v.verse}, ${tr("pages.read.verseXrefMarkerA11y")}`
                                : undefined
                            }
                          >
                            {v.verse}
                          </Text>
                          <Text
                            style={{
                              fontSize: px.verseFontSize,
                              lineHeight: px.verseLineHeight,
                            }}
                          >
                            {READ_VERSE_NUM_BODY_GAP}
                          </Text>
                          <ReadChapterVerseText
                            key={`vtext:${v.verse}:view:${selected ? "s" : "n"}:${bookmarked ? "b" : "n"}`}
                            inline
                            highlight={highlightKind}
                            text={localeZhText(v.text)}
                            parts={speechPartsByVerse?.get(v.verse) ?? null}
                            highlightedCharIndexes={highlightedIndexes}
                            searchKeyword={searchFocus && searchQuery ? searchQuery : null}
                            {...verseBodyPressProps(v.verse, v.text)}
                          />
                        </Text>
                        {contrastByVerse?.get(v.verse)?.map((row) => (
                          <Text
                            key={`${v.verse}:${row.translationId}`}
                            style={[
                              styles.verseContrast,
                              {
                                fontSize: px.verseFontSize * 0.82,
                                lineHeight: Math.max(
                                  px.verseLineHeight * 0.78,
                                  px.verseFontSize * 0.82 * 1.2,
                                ),
                              },
                            ]}
                          >
                            {row.text}
                          </Text>
                        ))}
                      </View>
                    </Pressable>
                  </Fragment>
                );
              })}

          <View style={styles.scriptureEndingSection}>
            <View style={styles.endNav}>
              <View style={styles.endSide}>
                {endNavPrev ? (
                  <Pressable onPress={goPrevChrome}>
                    <View style={styles.endLinkRow}>
                      <MaterialIcons name="chevron-left" size={16} color={readTypography.breadcrumbColor} />
                      <Text style={styles.endLink}>{formatNeighborChapterLabel(endNavPrev)}</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={() => router.push("/read/catalog")} style={styles.endCenter}>
                <Text style={styles.endCenterText}>{displayBookName}</Text>
              </Pressable>
              <View style={[styles.endSide, styles.endSideRight]}>
                {endNavNext ? (
                  <Pressable onPress={goNextChrome}>
                    <View style={[styles.endLinkRow, styles.endLinkRowRight]}>
                      <Text style={styles.endLink}>{formatNeighborChapterLabel(endNavNext)}</Text>
                      <MaterialIcons name="chevron-right" size={16} color={readTypography.breadcrumbColor} />
                    </View>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View
              style={[styles.scriptureClosingDivider, { width: screenWidth }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <LinearGradient
                colors={[
                  "rgba(78, 52, 30, 0.22)",
                  "rgba(78, 52, 30, 0.14)",
                  "rgba(78, 52, 30, 0.07)",
                  "rgba(78, 52, 30, 0.03)",
                  "rgba(78, 52, 30, 0)",
                ]}
                locations={[0, 0.28, 0.58, 0.82, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.scriptureShadowGradient}
              />
            </View>

            {chapterCompleted ? (
              <View style={styles.chapterDoneWrap}>
                <View style={styles.chapterDoneRow}>
                  <MaterialIcons name="check-circle" size={22} color="#6E835E" />
                  <Text style={styles.chapterDoneText}>
                    {isEnglishPostReading ? "Completed" : localeDisplayText("已完成读经")}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {postReadingReady ? (
            <ReadChapterPostReadingEditions
              bookId={chapterData.bookId}
              chapter={chapterData.chapter}
              displayLocale={postReadingDisplayLocale}
              infoRoleId={prefersEnglishInfoEdition ? INFO_EDITION_V1_EN_ROLE_ID : null}
              guideRoleId={prefersEnglishInfoEdition ? INFO_EDITION_GUIDE_V2_EN_ROLE_ID : null}
              onBackToTop={scrollToTop}
              onGoPrevChapter={endNavPrev ? goPrevChrome : undefined}
              onGoNextChapter={endNavNext ? goNextChrome : undefined}
            />
          ) : null}

          {chapterCompleted ? (
            <ReadChapterCompletionPlanPanel
              bookId={chapterData.bookId}
              chapter={chapterData.chapter}
              displayLocale={postReadingDisplayLocale}
            />
          ) : null}

        </ParchmentBottomFadeScrollView>
      ) : (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={c.muted} />
          <Text style={styles.statusText}>{tr("pages.read.loadingChapter")}</Text>
          <Pressable
            onPress={() => void load()}
            style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed, { marginTop: 12 }]}
          >
            <Text style={styles.retryBtnText}>{tr("pages.read.retry")}</Text>
          </Pressable>
        </View>
      )}

      <ReadVerseBookmarkFeedback message={bookmarkFeedback} onClear={clearBookmarkFeedback} />

      {chapterData ? (
        <ReadChapterVerseXrefSheet
          visible={xrefSheetVerse != null}
          onClose={() => setXrefSheetVerse(null)}
          bookName={xrefBookName || localeZhText(chapterData.bookName)}
          displayLocale={readDisplayLocale}
          chapter={chapterData.chapter}
          verse={xrefSheetVerse ?? 0}
          bundle={xrefSheetBundle}
          bundleLoading={xrefSheetLoading}
        />
      ) : null}

      {chapterData ? (
        <View
          style={[
            styles.topLeftActionWrap,
            {
              top: insets.top + READ_SETTINGS_TOP_OFFSET,
              left: Math.max(insets.left, 8),
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (returnToExplore()) return;
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              router.push("/read");
            }}
            disabled={verseSelectionMode}
            style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={tr("pages.read.chapterChromeBack")}
          >
            <MaterialIcons name="arrow-back-ios-new" size={19} color="#FFFFFF" style={styles.topActionIcon} />
          </Pressable>
        </View>
      ) : null}

      {chapterData ? (
        <View
          style={[
            styles.topActions,
            {
              top: insets.top + READ_SETTINGS_TOP_OFFSET + READ_TOP_ACTION_SIZE + READ_TOP_ACTION_GAP,
              right: Math.max(insets.right, 8),
            },
          ]}
        >
          <Pressable
            onPress={() => {
              void warmScriptureSearchDatabase(primaryTranslationId);
              router.push(readScriptureSearchRoute());
            }}
            disabled={verseSelectionMode}
            style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={tr("pages.read.chapterChromeSearch")}
          >
            <MaterialIcons name="search" size={21} color="#FFFFFF" style={styles.topActionIcon} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/read/favorites")}
            disabled={verseSelectionMode}
            style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={tr("pages.read.chapterChromeFavorites")}
          >
            <MaterialIcons name="bookmark-border" size={21} color="#FFFFFF" style={styles.topActionIcon} />
          </Pressable>
        </View>
      ) : null}

      {chapterData && verseSelectionMode ? (
        <View
          style={[
            styles.selectionBar,
            {
              left: 14 + Math.max(insets.left, 0),
              right: 14 + Math.max(insets.right, 0),
              bottom: 92 + insets.bottom,
            },
          ]}
        >
          <Text style={styles.selectionCountText}>
            {tr("pages.read.verseSelectionPicked", { count: selectedVerses.length })}
          </Text>
          <View style={styles.selectionActions}>
            <Pressable
              onPress={exitVerseSelectionMode}
              style={({ pressed }) => [styles.selectionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.selectionBtnText}>{tr("pages.read.verseSelectionClear")}</Text>
            </Pressable>
            <Pressable
              onPress={() => void copySelectedVerses()}
              style={({ pressed }) => [styles.selectionBtnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.selectionBtnPrimaryText}>
                {tr("pages.read.verseSelectionCopy")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {chapterData && verseActionMenu ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setVerseActionMenu(null)}
        >
          <Pressable style={styles.verseActionBackdrop} onPress={() => setVerseActionMenu(null)}>
            <Pressable style={styles.verseActionSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.verseActionTitle}>
                {readDisplayLocale === "en"
                  ? `Verse ${verseActionMenu.verse}`
                  : localeZhText(`第 ${verseActionMenu.verse} 节`)}
              </Text>

              <Pressable onPress={() => void runCopyCurrentVerse()} style={styles.verseActionBtn}>
                <View style={styles.verseActionBtnRow}>
                  <MaterialIcons name="content-copy" size={18} color={c.ink} />
                  <Text style={styles.verseActionBtnText}>{localeZhText("本节复制")}</Text>
                </View>
              </Pressable>

              <Pressable onPress={runStartMultiCopy} style={styles.verseActionBtn}>
                <View style={styles.verseActionBtnRow}>
                  <MaterialIcons name="done-all" size={18} color={c.ink} />
                  <Text style={styles.verseActionBtnText}>{localeZhText("多选复制")}</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => void runToggleVerseBookmarkFromMenu()}
                style={styles.verseActionBtn}
              >
                <View style={styles.verseActionBtnRow}>
                  <MaterialIcons
                    name={verseActionMenuBookmarked ? "bookmark" : "bookmark-border"}
                    size={18}
                    color={c.ink}
                  />
                  <Text style={styles.verseActionBtnText}>
                    {verseActionMenuBookmarked
                      ? tr("pages.read.verseActionUnbookmark")
                      : tr("pages.read.verseActionBookmark")}
                  </Text>
                </View>
              </Pressable>

              <Pressable onPress={runOpenHighlightEditor} style={styles.verseActionBtn}>
                <View style={styles.verseActionBtnRow}>
                  <MaterialIcons name="edit" size={18} color={c.ink} />
                  <Text style={styles.verseActionBtnText}>{localeZhText("划重点词")}</Text>
                </View>
              </Pressable>

              <Pressable onPress={runShareVerse} style={styles.verseActionBtn}>
                <View style={styles.verseActionBtnRow}>
                  <MaterialIcons name="share" size={18} color={c.ink} />
                  <Text style={styles.verseActionBtnText}>{localeZhText("分享")}</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setVerseActionMenu(null)}
                style={[styles.verseActionBtn, styles.verseActionBtnCancel]}
              >
                <View style={styles.verseActionBtnRow}>
                  <MaterialIcons name="close" size={18} color={c.muted} />
                  <Text style={[styles.verseActionBtnText, styles.verseActionBtnTextMuted]}>
                    {localeZhText("关闭")}
                  </Text>
                </View>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      <ReadVerseHighlightWordSheet
        visible={highlightWordEditor != null}
        target={highlightWordEditor}
        title={
          chapterData && highlightWordEditor
            ? `${displayBookName} ${chapterData.chapter}:${highlightWordEditor.verse}`
            : ""
        }
        parts={
          highlightWordEditor
            ? (speechPartsByVerse?.get(highlightWordEditor.verse) ?? null)
            : null
        }
        initialHighlights={
          highlightWordEditor
            ? (highlightedVerseIndexes.get(highlightWordEditor.verse) ?? null)
            : null
        }
        chapterRef={
          chapterData
            ? {
                translationId: chapterData.translationId,
                bookId: chapterData.bookId,
                chapter: chapterData.chapter,
              }
            : null
        }
        onClose={() => setHighlightWordEditor(null)}
        onSaved={handleHighlightWordSaved}
        onFeedback={(message) => setBookmarkFeedback(localeZhText(message))}
      />

      <Modal visible={jumpOpen} animationType="slide" transparent onRequestClose={() => setJumpOpen(false)}>
        <Pressable style={styles.jumpBackdrop} onPress={() => setJumpOpen(false)}>
          <Pressable style={styles.jumpSheet} onPress={(e) => e.stopPropagation()}>
            <ImageBackground
              source={READ_PARCHMENT_SCROLL_SOURCE}
              resizeMode="stretch"
              style={styles.jumpSheetImageBg}
              imageStyle={styles.jumpSheetBgImage}
            >
              <View style={[styles.jumpSheetContent, { paddingBottom: 16 + insets.bottom }]}>
                <View style={styles.jumpHeaderRow}>
                  <Pressable
                    onPress={goReadHomeFromCatalog}
                    style={({ pressed }) => [styles.jumpBackBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={tr("pages.read.backToBibleHome")}
                  >
                    <MaterialIcons name="arrow-back-ios-new" size={16} color={c.ink} />
                  </Pressable>
                  <Text
                    style={styles.jumpTitle}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    allowFontScaling={false}
                  >
                    {jumpPickerBookId ? bookNameForId(jumpPickerBookId) : tr("pages.read.chapterJumpTitle")}
                  </Text>
                  <View style={styles.jumpHeaderSpacer} />
                </View>
                <View style={styles.jumpCatalogScrollWrap}>
                  {jumpPickerBookId ? (
                    <BibleChapterPickerPanel
                      bookId={jumpPickerBookId}
                      viewportHeight={JUMP_CATALOG_VIEWPORT_H}
                      embedded
                      lockTextScale
                      onBack={() => setJumpPickerBookId(null)}
                      onPickChapter={(chapter) => jumpToChapter(jumpPickerBookId, chapter)}
                    />
                  ) : (
                    <ScrollView
                      style={styles.jumpCatalogScroll}
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="handled"
                    >
                      <BibleCatalogOutline
                        sections={catalogSections}
                        activeBookId={bookId}
                        onPickChapter={jumpToChapter}
                        onBookPress={onJumpBookPress}
                        splitByTestamentColumns
                        bookMetaMode="none"
                        compactMode
                        showSectionTint={false}
                        sectionGapPx={8}
                        sectionStripeFullHeight
                        lockTextScale
                      />
                    </ScrollView>
                  )}
                </View>
                <Pressable onPress={() => setJumpOpen(false)} style={styles.jumpClose}>
                  <Text style={styles.jumpCloseText}>{tr("pages.read.chapterJumpClose")}</Text>
                </Pressable>
              </View>
            </ImageBackground>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  header: {
    width: "100%",
    paddingTop: 4,
    paddingBottom: 24,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    alignItems: "center",
  },
  chapterTitle: {
    marginTop: 0,
    fontSize: readTypography.chapterTitleSize,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  chapterMeta: { marginTop: 4, fontSize: 12, color: c.muted, textAlign: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  statusText: { fontSize: 14, color: c.muted },
  errorText: { fontSize: 14, lineHeight: 22, color: c.muted, textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  retryBtnText: { fontSize: 14, ...parchmentSans(600), color: c.ink },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    width: "100%",
    alignSelf: "center",
  },
  segmentParagraphBreak: {
    height: 16,
  },
  segmentParagraphBreakWithRule: {
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentParagraphRule: {
    width: 96,
    height: StyleSheet.hairlineWidth,
    borderRadius: 999,
    backgroundColor: c.border,
  },
  segmentHeading: {
    marginTop: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
    ...parchmentSans(600),
    color: "#70451F",
    textAlign: "center",
    letterSpacing: 0.3,
    opacity: 0.92,
  },
  verseBlock: {
    marginBottom: 14,
    textAlign: "left",
  },
  verseParagraphBlock: {
    marginBottom: 14,
  },
  verseBlockBeforeSegmentBreak: {
    marginBottom: 0,
  },
  verseInlineChunk: {
    borderRadius: 6,
  },
  verseInlineChunkSelected: {
    backgroundColor: "#FFB103",
  },
  verseInlineChunkSearchFocus: {
    backgroundColor: "#FFB103",
  },
  verseInlineChunkAudioActive: {
    backgroundColor: "#FFB103",
  },
  verseInlineChunkAudioIdle: {
    backgroundColor: "transparent",
  },
  versePrimaryLine: {
    ...parchmentSans(500),
    color: readTypography.verseColor,
  },
  verseNumAndroid: {
    includeFontPadding: false,
    textAlignVertical: "top",
    paddingTop: 0,
    marginTop: 0,
  },
  verseNum: {
    fontSize: readTypography.verseNumFontSize,
    ...parchmentSans(700),
    color: readTypography.verseNumColor,
  },
  verseNumXref: {
    color: readTypography.verseNumXrefColor,
  },
  verseNumSelected: {
    color: c.verseSearchFocusNum,
  },
  verseBlockSelected: {
    backgroundColor: "#FFB103",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFB103",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verseLineActive: {
    backgroundColor: "#FFB103",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFB103",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verseLineIdle: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  verseLineSearchFocus: {
    backgroundColor: "#FFB103",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFB103",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verseNumActive: { color: c.verseAudioActiveNum },
  verseNumSearchFocus: { color: c.verseSearchFocusNum },
  verseContrast: {
    marginTop: 7,
    color: c.muted,
    ...parchmentSans(400),
  },
  scriptureEndingSection: {
    marginTop: 0,
    marginBottom: 30,
  },
  scriptureClosingDivider: {
    marginTop: 0,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    alignSelf: "center",
  },
  scriptureShadowGradient: {
    width: "100%",
    height: 28,
  },
  scriptureClosingRuleRow: {
    width: "100%",
    maxWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scriptureClosingRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(143, 104, 62, 0.44)",
  },
  scriptureClosingDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "rgba(143, 104, 62, 0.6)",
  },
  chapterDoneRow: {
    marginTop: 50,
    marginBottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chapterDoneWrap: {
    alignSelf: "center",
    alignItems: "center",
  },
  chapterDoneText: {
    fontSize: 20,
    color: "#6E835E",
    ...parchmentSans(600),
  },
  endNav: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 80,
    marginBottom: 50,
    paddingTop: 0,
    gap: 8,
  },
  endSide: { flex: 1, minWidth: 0 },
  endSideRight: { alignItems: "flex-end" },
  endLink: {
    fontSize: 13,
    ...parchmentSans(500),
    color: readTypography.breadcrumbColor,
  },
  endLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  endLinkRowRight: {
    justifyContent: "flex-end",
  },
  endCenter: { flexShrink: 0, maxWidth: 120, paddingHorizontal: 4 },
  endCenterText: {
    fontSize: 16,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  jumpBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: c.modalBackdrop },
  jumpSheet: {
    width: "100%",
    maxHeight: "82%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  jumpSheetImageBg: {
    width: "100%",
  },
  jumpSheetContent: {
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  jumpSheetBgImage: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    opacity: 0.92,
  },
  jumpHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  jumpBackBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 249, 239, 0.72)",
  },
  jumpHeaderSpacer: {
    width: 30,
    height: 30,
  },
  jumpTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    lineHeight: 32,
    ...parchmentSans(700),
    color: c.ink,
    textAlign: "center",
  },
  jumpCatalogScrollWrap: {
    position: "relative",
    height: JUMP_CATALOG_VIEWPORT_H,
    overflow: "hidden",
  },
  jumpCatalogScroll: {
    height: "100%",
    width: "100%",
  },
  jumpClose: { marginTop: 4, alignSelf: "center", paddingVertical: 6 },
  jumpCloseText: { fontSize: 14, color: c.muted },
  topActions: {
    position: "absolute",
    zIndex: 50,
    gap: READ_TOP_ACTION_GAP,
    alignItems: "center",
  },
  topLeftActionWrap: {
    position: "absolute",
    zIndex: 50,
    alignItems: "center",
  },
  topActionBtn: {
    width: READ_TOP_ACTION_SIZE,
    height: READ_TOP_ACTION_SIZE,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    opacity: READ_TOP_ACTION_IDLE_OPACITY,
  },
  topActionPressed: {
    opacity: READ_TOP_ACTION_PRESSED_OPACITY,
  },
  topActionIcon: {
    ...(Platform.OS === "ios"
      ? {
          textShadowColor: "rgba(0,0,0,0.55)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 6,
        }
      : null),
  },
  selectionBar: {
    position: "absolute",
    zIndex: 65,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    shadowColor: "#1c1410",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  selectionCountText: {
    fontSize: 12,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  selectionActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  selectionBtn: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectionBtnPrimary: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFB103",
    backgroundColor: "#FFB103",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectionBtnText: {
    fontSize: 12,
    ...parchmentSans(600),
    color: c.ink,
  },
  selectionBtnPrimaryText: {
    fontSize: 12,
    ...parchmentSans(600),
    color: "#8C4A0F",
  },
  verseActionBackdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  verseActionSheet: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surfaceSolid,
    padding: 10,
    gap: 8,
  },
  verseActionTitle: {
    fontSize: 12,
    color: c.muted,
    textAlign: "center",
    ...parchmentSans(600),
  },
  verseActionBtn: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  verseActionBtnCancel: {
    marginTop: 2,
  },
  verseActionBtnText: {
    fontSize: 14,
    color: c.ink,
    ...parchmentSans(600),
  },
  verseActionBtnTextMuted: {
    color: c.muted,
  },
  verseActionBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: { opacity: 0.88 },
});
