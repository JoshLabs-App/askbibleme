import * as Haptics from "expo-haptics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { resolveChapterSegmentHeadingText } from "../bible/chapter-segment-display";
import { loadChapterXrefs } from "../bible/load-chapter-xrefs";
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
import { useLocale } from "../i18n/LocaleProvider";
import { createT, toZhTwText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { BibleCatalogOutline } from "./BibleCatalogOutline";
import { readParchmentTheme as c } from "./readParchmentTheme";
import {
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
import {
  ReadParchmentBackgroundImage,
} from "./ReadParchmentSurface";
import { parchmentSans, readTypography } from "./readTypography";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { useReadChapterAudio } from "./useReadChapterAudio";
import { useReadChapterSearchFocus } from "./useReadChapterSearchFocus";
import { useScriptureVerseBookmarks } from "./useScriptureVerseBookmarks";
import { ReadVerseBookmarkFeedback } from "./ReadVerseBookmarkFeedback";
import { recordTodayReadingChapterFraction } from "./reading-plan/today-reading-chapter-fraction";
import { markTodayReadingChapterVisit } from "./reading-plan/today-reading-done";
import { readingIncludesChapter } from "./reading-plan/today-reading-done";
import { loadTodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { readEffectiveReadingPlanPrefs } from "./reading-plan/reading-plan-prefs";
import { jumpReadChapter, navigateReadChapter, type ReadChapterNavDirection } from "./read-chapter-nav";
import { readScriptureSearchRoute } from "./readScriptureSearchRoute";
import { trackTelemetry } from "../telemetry/client";
import { writeLastReadPosition } from "./read-last-position";
import {
  isReadChapterCompleted,
  markReadChapterCompleted,
} from "./read-chapter-completion";
import {
  VERSE_TEXT_HIGHLIGHT_PALETTE,
  readChapterVerseTextHighlights,
  writeVerseTextHighlightIndices,
} from "./read-verse-text-highlights";

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
const LOGO_HIGHLIGHT_COLOR = "#FFB103";
const READ_VERSE_HIGHLIGHT_PALETTE = VERSE_TEXT_HIGHLIGHT_PALETTE;

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

type ReadChapterPlanRef = { bookId: string; chapter: number };
type VerseLayout = { y: number; height: number };
type VerseActionMenuState = { verse: number; text: string } | null;
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

function countHighlightedChars(input: ChapterHighlightMap): number {
  let total = 0;
  for (const set of input.values()) total += set.size;
  return total;
}

function buildPlanChapterQueue(readings: Array<{ bookId: string; startChapter: number; endChapter: number }>) {
  const out: ReadChapterPlanRef[] = [];
  for (const r of readings) {
    for (let ch = r.startChapter; ch <= r.endChapter; ch += 1) {
      out.push({ bookId: r.bookId, chapter: ch });
    }
  }
  return out;
}

function resolveTodayPlanLoopNextTarget(
  payload: Awaited<ReturnType<typeof loadTodayReadingPlanPayload>>,
  currentBookId: string,
  currentChapter: number,
): ReadChapterPlanRef | null {
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return null;
  if (!readings.some((r) => readingIncludesChapter(r, currentBookId, currentChapter))) return null;
  const queue = buildPlanChapterQueue(readings);
  if (queue.length <= 1) return null;
  const idx = queue.findIndex((ref) => ref.bookId === currentBookId && ref.chapter === currentChapter);
  if (idx < 0) return null;
  return queue[(idx + 1) % queue.length] ?? null;
}

export function ReadChapterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ bookId: string; chapter: string; verse?: string; planFlow?: string }>();
  const bookId = parseBookIdParam(params.bookId);
  const chapter = parseChapterParam(params.chapter);
  const isPlanFlow = String(Array.isArray(params.planFlow) ? params.planFlow[0] : params.planFlow || "") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterData, setChapterData] = useState<LoadedChapter | null>(null);
  const [chapterSegments, setChapterSegments] = useState<ChapterSegment[] | null>(null);
  const [contrastByVerse, setContrastByVerse] = useState<Map<number, ContrastVerseLine[]> | null>(null);
  const [chapterXrefs, setChapterXrefs] = useState<ScriptureVerseXrefs[] | null>(null);
  const [xrefSheetVerse, setXrefSheetVerse] = useState<number | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollHeaderHeightRef = useRef(0);
  const lastVerseTapRef = useRef<{ verse: number; at: number } | null>(null);
  const longPressCopiedVerseRef = useRef<number | null>(null);
  const [bookmarkFeedback, setBookmarkFeedback] = useState<string | null>(null);
  const [verseSelectionMode, setVerseSelectionMode] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [highlightedVerseIndexes, setHighlightedVerseIndexes] = useState<ChapterHighlightMap>(
    new Map(),
  );
  const [verseActionMenu, setVerseActionMenu] = useState<VerseActionMenuState>(null);
  const [highlightModeActive, setHighlightModeActive] = useState(false);
  const [highlightDraftMap, setHighlightDraftMap] = useState<ChapterHighlightMap | null>(null);
  const [activeHighlightColor, setActiveHighlightColor] = useState<string>(
    READ_VERSE_HIGHLIGHT_PALETTE[0],
  );
  const highlightDraftMapRef = useRef<ChapterHighlightMap | null>(null);
  const [chapterCompleted, setChapterCompleted] = useState(false);
  const [planFlowNextTarget, setPlanFlowNextTarget] = useState<ReadChapterPlanRef | null>(null);
  const [audioViewportHeight, setAudioViewportHeight] = useState(0);
  const chapterCompletionMarkedRef = useRef(false);
  const chapterScrollIntentRef = useRef(false);
  const verseLayoutsRef = useRef<Map<number, VerseLayout>>(new Map());
  const clearBookmarkFeedback = useCallback(() => setBookmarkFeedback(null), []);
  const { isBookmarked, toggle: toggleVerseBookmark } = useScriptureVerseBookmarks();
  const { locale } = useLocale();
  const swipe = useShellSwipeNav();
  const {
    px,
    primaryTranslationId,
    contrastTranslationIds,
    translationCatalog,
    verseParagraphFlow,
    chapterSegmentMode,
  } =
    useReadBibleTypography();
  const { searchFocusVerse, onScrollViewportLayout, onVerseLayout } = useReadChapterSearchFocus(
    chapterData,
    params.verse,
    scrollRef,
  );
  const primaryTranslationMeta = useMemo(
    () => translationCatalog.find((tr) => tr.id === primaryTranslationId),
    [translationCatalog, primaryTranslationId],
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
    if (!bookId || chapter == null) {
      setError(tr("pages.read.invalidChapter"));
      setChapterData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setChapterData(null);
    setChapterSegments(null);
    setContrastByVerse(null);
    setChapterXrefs(null);
    try {
      const primaryMeta = translationCatalog.find((tr) => tr.id === primaryTranslationId);
      const contrastMetas = contrastTranslationIds
        .map((id) => translationCatalog.find((tr) => tr.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      const primaryLabels = {
        labelZh: primaryMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
        labelEn: primaryMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
      };

      const catalogIndex = {
        translations: translationCatalog,
        defaultTranslationId: null as string | null,
      };
      const readyPrimaryId = await ensureScriptureTranslationReadyWithFallback(
        primaryTranslationId,
        translationMetaFromCatalog(catalogIndex, primaryTranslationId)?.downloadUrl,
      );

      const loaded = await loadChapterFromBundledTranslation(
        bookId,
        chapter,
        readyPrimaryId,
        primaryLabels,
      );

      if (!loaded) {
        setChapterData(null);
        setError(tr("pages.read.chapterLoadError"));
        return;
      }
      setChapterData(loaded);
      setChapterSegments(loadBundledChapterSegments(loaded.bookId, loaded.chapter, chapterSegmentMode));
      void recordTodayReadingChapterFraction(loaded.bookId, loaded.chapter, 0.1);
      void writeLastReadPosition({
        bookId: loaded.bookId,
        chapter: loaded.chapter,
        bookName: loaded.bookName,
      });

      // 对照译本与交叉引用不阻塞首屏经文。
      void (async () => {
        const [contrastResults, xrefsResult] = await Promise.allSettled([
          Promise.allSettled(
            contrastMetas.map(async (meta) => {
              try {
                await ensureScriptureTranslationReady(
                  meta.id,
                  translationMetaFromCatalog(catalogIndex, meta.id)?.downloadUrl,
                );
              } catch {
                return null;
              }
              return loadChapterFromBundledTranslation(
                bookId,
                chapter,
                meta.id,
                { labelZh: meta.labelZh, labelEn: meta.labelEn },
              );
            }),
          ),
          loadChapterXrefs(bookId, chapter),
        ]);
        setChapterXrefs(xrefsResult.status === "fulfilled" ? xrefsResult.value : null);
        const contrastSettledRows =
          contrastResults.status === "fulfilled" ? contrastResults.value : [];
        if (contrastSettledRows.length === 0) return;
        const map = new Map<number, ContrastVerseLine[]>();
        for (const row of contrastSettledRows) {
          if (row.status !== "fulfilled" || !row.value?.verses?.length) continue;
          for (const v of row.value.verses) {
            const bucket = map.get(v.verse) ?? [];
            bucket.push({ translationId: row.value.translationId, text: v.text });
            map.set(v.verse, bucket);
          }
        }
        setContrastByVerse(map.size ? map : null);
      })();
    } catch (e) {
      setChapterData(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [bookId, chapter, primaryTranslationId, contrastTranslationIds, translationCatalog, chapterSegmentMode, tr]);

  useLayoutEffect(() => {
    setChapterData(null);
    setChapterSegments(null);
    setContrastByVerse(null);
    setChapterXrefs(null);
    verseLayoutsRef.current.clear();
    setLoading(true);
    setError(null);
    chapterScrollIntentRef.current = false;
  }, [bookId, chapter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    highlightDraftMapRef.current = highlightDraftMap;
  }, [highlightDraftMap]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [bookId, chapter]);

  useEffect(() => {
    if (!chapterData) return;
    trackTelemetry("read_chapter_open", {
      book_id: chapterData.bookId,
      chapter: chapterData.chapter,
    });
  }, [chapterData?.bookId, chapterData?.chapter]);

  const neighbors = useMemo(() => {
    if (!chapterData) return { prev: null, next: null };
    return resolveReadChapterNeighbors(chapterData.bookId, chapterData.chapter);
  }, [chapterData]);
  const formatNeighborChapterLabel = useCallback(
    (target: { bookId: string; chapter: number } | null): string => {
      if (!target) return "";
      return isZhLocale ? `第${target.chapter}章` : `Chapter ${target.chapter}`;
    },
    [isZhLocale],
  );

  const xrefsByVerse = useMemo(() => {
    if (!chapterXrefs?.length) return null;
    const m = new Map<number, ScriptureVerseXrefs>();
    for (const row of chapterXrefs) {
      if (row.incoming.length || row.outgoing.length) m.set(row.verse, row);
    }
    return m.size ? m : null;
  }, [chapterXrefs]);

  const xrefSheetBundle =
    xrefSheetVerse != null ? (xrefsByVerse?.get(xrefSheetVerse) ?? null) : null;

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
        const text = resolveChapterSegmentHeadingText(row, locale, localeZhText);
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
  }, [chapterSegments, locale, localeZhText]);
  const useParagraphFlowLayout = verseParagraphFlow && contrastTranslationIds.length === 0;
  const activeHighlightMap = highlightModeActive
    ? (highlightDraftMap ?? highlightedVerseIndexes)
    : highlightedVerseIndexes;

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
        router.push({
          pathname: "/read/[bookId]/[chapter]",
          params: {
            bookId: planFlowNextTarget.bookId,
            chapter: String(planFlowNextTarget.chapter),
            planFlow: "1",
          },
        });
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
    verseLayoutsRef,
    audioViewportHeight,
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
    void isReadChapterCompleted(chapterData.bookId, chapterData.chapter).then((done) => {
      if (cancelled) return;
      setChapterCompleted(done);
      if (done) chapterCompletionMarkedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [chapterData?.bookId, chapterData?.chapter]);

  useEffect(() => {
    if (!nearAudioEnd) return;
    markChapterDone();
  }, [markChapterDone, nearAudioEnd]);

  const onChapterScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { y } = event.nativeEvent.contentOffset;
      const { height: contentH } = event.nativeEvent.contentSize;
      const { height: viewportH } = event.nativeEvent.layoutMeasurement;
      if (contentH <= 0 || viewportH <= 0) return;
      if (y > 12) chapterScrollIntentRef.current = true;
      if (!chapterScrollIntentRef.current) return;
      if (y + viewportH >= contentH - 48) {
        markChapterDone();
      }
    },
    [markChapterDone],
  );

  useEffect(() => {
    if (!chapterData?.verses.length) return;
    const total = chapterData.verses.length;
    const verseIdx =
      activeVerseIndex != null && activeVerseIndex >= 0 && activeVerseIndex < total
        ? activeVerseIndex
        : -1;
    const fraction = verseIdx >= 0 ? Math.min(1, (verseIdx + 1) / total) : 0;
    void recordTodayReadingChapterFraction(chapterData.bookId, chapterData.chapter, fraction);
  }, [chapterData, activeVerseIndex]);

  useEffect(() => {
    if (!chapterData || !isPlanFlow) {
      setPlanFlowNextTarget(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await readEffectiveReadingPlanPrefs();
        const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount });
        if (cancelled) return;
        setPlanFlowNextTarget(resolveTodayPlanLoopNextTarget(payload, chapterData.bookId, chapterData.chapter));
      } catch {
        if (cancelled) return;
        setPlanFlowNextTarget(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chapterData?.bookId, chapterData?.chapter, isPlanFlow]);

  const onChapterSwipe = useCallback(
    (direction: "left" | "right") => {
      // 阅读序：左划下一章（新页从右进），右划上一章（新页从左进）；与首页场景条左右空间模型相反
      if (direction === "left") goNeighbor(neighbors.next, "forward");
      else goNeighbor(neighbors.prev, "back");
    },
    [goNeighbor, neighbors.next, neighbors.prev],
  );

  useShellSwipeAction(
    Boolean(chapterData) &&
      !jumpOpen &&
      !verseSelectionMode &&
      verseActionMenu == null &&
      !highlightModeActive,
    onChapterSwipe,
  );
  useShellSwipeSuspend(
    jumpOpen || verseSelectionMode || verseActionMenu != null || highlightModeActive,
  );

  const onVersePress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
      if (highlightModeActive) return;
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
    [chapterData, highlightModeActive, verseSelectionMode, toggleVerseBookmark, swipe, localeZhText, tr],
  );

  const onVerseLongPress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
      if (highlightModeActive) return;
      if (verseSelectionMode) return;
      longPressCopiedVerseRef.current = verse;
      swipe?.markExclude();
      setVerseActionMenu({ verse, text });
    },
    [chapterData, highlightModeActive, swipe, verseSelectionMode],
  );

  /** Android 收藏字下色带会拦截父级 Text/Pressable 的点击，改由节文组件接收 */
  const verseBodyPressProps = useCallback(
    (verse: number, text: string) => {
      if (highlightModeActive || Platform.OS !== "android") return {};
      return {
        onPress: () => onVersePress(verse, text),
        onLongPress: () => onVerseLongPress(verse, text),
      };
    },
    [highlightModeActive, onVerseLongPress, onVersePress],
  );

  const parentVersePressHandler = useCallback(
    (verse: number, text: string) => {
      if (highlightModeActive || Platform.OS === "android") return undefined;
      return () => onVersePress(verse, text);
    },
    [highlightModeActive, onVersePress],
  );

  const parentVerseLongPressHandler = useCallback(
    (verse: number, text: string) => {
      if (highlightModeActive || Platform.OS === "android") return undefined;
      return () => onVerseLongPress(verse, text);
    },
    [highlightModeActive, onVerseLongPress],
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
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }, [chapterData, selectedVerses, swipe, localeZhText]);

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
    const draft = cloneHighlightMap(highlightedVerseIndexes);
    setHighlightDraftMap(draft);
    highlightDraftMapRef.current = draft;
    setHighlightModeActive(true);
    setVerseActionMenu(null);
  }, [highlightedVerseIndexes, verseActionMenu]);

  const toggleVerseHighlightUnit = useCallback(
    (verse: number, current: VerseHighlightMap | null, start: number, end: number, color: string) => {
      if (!highlightModeActive) return;
      const next = new Map(current ?? []);
      let allSelected = true;
      for (let i = start; i < end; i += 1) {
        if (!next.has(i)) {
          allSelected = false;
          break;
        }
      }
      for (let i = start; i < end; i += 1) {
        if (allSelected) next.delete(i);
        else next.set(i, color);
      }
      const base = cloneHighlightMap(highlightDraftMapRef.current ?? highlightedVerseIndexes);
      if (next.size) base.set(verse, next);
      else base.delete(verse);
      highlightDraftMapRef.current = base;
      setHighlightDraftMap(base);
    },
    [highlightModeActive, highlightedVerseIndexes],
  );

  const replaceVerseHighlightSelection = useCallback(
    (verse: number, selected: VerseHighlightMap) => {
      if (!highlightModeActive) return;
      const base = cloneHighlightMap(highlightDraftMapRef.current ?? highlightedVerseIndexes);
      if (selected.size) base.set(verse, new Map(selected));
      else base.delete(verse);
      highlightDraftMapRef.current = base;
      setHighlightDraftMap(base);
    },
    [highlightModeActive, highlightedVerseIndexes],
  );

  const paintVerseHighlightUnit = useCallback(
    (verse: number, start: number, end: number, mode: "add" | "remove", color: string) => {
      if (!highlightModeActive) return;
      const base = cloneHighlightMap(highlightDraftMapRef.current ?? highlightedVerseIndexes);
      const verseSet = new Map(base.get(verse) ?? []);
      for (let i = start; i < end; i += 1) {
        if (mode === "add") verseSet.set(i, color);
        else verseSet.delete(i);
      }
      if (verseSet.size) base.set(verse, verseSet);
      else base.delete(verse);
      highlightDraftMapRef.current = base;
      setHighlightDraftMap(base);
    },
    [highlightModeActive, highlightedVerseIndexes],
  );

  const finishHighlightMode = useCallback(async () => {
    const latestDraft = highlightDraftMapRef.current ?? highlightDraftMap ?? highlightedVerseIndexes;
    const nextMap = cloneHighlightMap(latestDraft);
    const savedChars = countHighlightedChars(nextMap);
    setHighlightedVerseIndexes(nextMap);
    setHighlightModeActive(false);
    setHighlightDraftMap(null);
    highlightDraftMapRef.current = null;
    if (!chapterData) return;
    const allVerses = new Set<number>([
      ...highlightedVerseIndexes.keys(),
      ...nextMap.keys(),
    ]);
    for (const verse of Array.from(allVerses).sort((a, b) => a - b)) {
      await writeVerseTextHighlightIndices(
        {
          translationId: chapterData.translationId,
          bookId: chapterData.bookId,
          chapter: chapterData.chapter,
          verse,
        },
        nextMap.get(verse)?.entries() ?? [],
      );
    }
    try {
      const persisted = await readChapterVerseTextHighlights({
        translationId: chapterData.translationId,
        bookId: chapterData.bookId,
        chapter: chapterData.chapter,
      });
      const persistedCount = countHighlightedChars(persisted);
      if (persistedCount > 0 || savedChars === 0) setHighlightedVerseIndexes(persisted);
      else setHighlightedVerseIndexes(nextMap);
    } catch {
      setHighlightedVerseIndexes(nextMap);
    }
    setBookmarkFeedback(
      savedChars > 0
        ? localeZhText("已保存高亮")
        : localeZhText("已清空高亮"),
    );
  }, [chapterData, highlightedVerseIndexes, highlightDraftMap, localeZhText]);

  const cancelHighlightModeByChapterChange = useCallback(() => {
    setHighlightModeActive(false);
    setHighlightDraftMap(null);
    highlightDraftMapRef.current = null;
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
    cancelHighlightModeByChapterChange();
  }, [cancelHighlightModeByChapterChange, chapterData?.bookId, chapterData?.chapter]);

  useEffect(() => {
    if (!chapterData) {
      setHighlightedVerseIndexes(new Map());
      return;
    }
    let cancelled = false;
    void readChapterVerseTextHighlights({
      translationId: chapterData.translationId,
      bookId: chapterData.bookId,
      chapter: chapterData.chapter,
    }).then((map) => {
      if (cancelled) return;
      setHighlightedVerseIndexes(map);
    });
    return () => {
      cancelled = true;
    };
  }, [chapterData?.translationId, chapterData?.bookId, chapterData?.chapter]);

  const jumpToChapter = useCallback(
    (nextBookId: string, nextChapter: number) => {
      setJumpOpen(false);
      jumpReadChapter(router, { bookId: nextBookId, chapter: nextChapter });
    },
    [router],
  );

  const openCatalogChrome = useCallback(() => {
    setJumpOpen(true);
  }, []);

  const goReadHomeFromCatalog = useCallback(() => {
    setJumpOpen(false);
    router.push("/read");
  }, [router]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const goNextChrome = useCallback(() => {
    goNeighbor(neighbors.next, "forward");
  }, [goNeighbor, neighbors.next]);

  useEffect(() => {
    const syncChrome = () => {
      if (!navigation.isFocused() || !chapterData) {
        setReadChapterBottomChromeApi(null);
        return;
      }
      setReadChapterBottomChromeApi({
        openCatalog: openCatalogChrome,
        goNext: goNextChrome,
        hasNext: Boolean(neighbors.next),
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
    neighbors.next,
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
          scrollEnabled={!highlightModeActive}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            onScrollViewportLayout(h);
            setAudioViewportHeight(h > 0 ? Math.round(h) : 0);
          }}
          onScroll={onChapterScroll}
          scrollEventThrottle={120}
          contentContainerStyle={[
            styles.scrollContent,
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
                          const highlightedIndexes = activeHighlightMap.get(v.verse) ?? null;
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
                              ? `pv:${v.verse}:audio:${audioActive ? "on" : "off"}`
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
                          const xrefBundle = xrefsByVerse?.get(v.verse);
                          const hasXref = Boolean(xrefBundle);
                          return (
                            <Text
                              key={verseAudioChunkKey}
                              onPress={parentVersePressHandler(v.verse, v.text)}
                              onLongPress={parentVerseLongPressHandler(v.verse, v.text)}
                              suppressHighlighting
                              onLayout={(e) => {
                                const { y, height } = e.nativeEvent.layout;
                                onVerseLayout(v.verse, y, height);
                                verseLayoutsRef.current.set(v.verse, { y, height });
                              }}
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
                                key={`pvtext:${v.verse}:${highlightModeActive ? "edit" : "view"}`}
                                inline
                                highlight={highlightKind}
                                textHighlightColor={activeHighlightColor}
                                text={localeZhText(v.text)}
                                parts={speechPartsByVerse?.get(v.verse) ?? null}
                                highlightedCharIndexes={highlightedIndexes}
                                highlightEditMode={highlightModeActive}
                                {...verseBodyPressProps(v.verse, v.text)}
                                onToggleHighlightUnit={(start, end, color) =>
                                  toggleVerseHighlightUnit(v.verse, highlightedIndexes, start, end, color)
                                }
                                onReplaceHighlightSelection={(next) =>
                                  replaceVerseHighlightSelection(v.verse, next)
                                }
                                onPaintHighlightUnit={(start, end, mode, color) =>
                                  paintVerseHighlightUnit(v.verse, start, end, mode, color)
                                }
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
                const highlightedIndexes = activeHighlightMap.get(v.verse) ?? null;
                const bookmarked = isBookmarked({
                  translationId: chapterData.translationId,
                  bookId: chapterData.bookId,
                  chapter: chapterData.chapter,
                  verse: v.verse,
                });
                const audioActive = !searchFocus && !bookmarked && activeVerseIndex === i;
                const verseBlockKey =
                  Platform.OS === "android"
                    ? `v:${v.verse}:audio:${audioActive ? "on" : "off"}`
                    : `${v.verse}`;
                const selected = selectedVerses.includes(v.verse);
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
                const xrefBundle = xrefsByVerse?.get(v.verse);
                const hasXref = Boolean(xrefBundle);
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
                      pointerEvents={highlightModeActive ? "box-none" : "auto"}
                      onPress={parentVersePressHandler(v.verse, v.text)}
                      onLongPress={parentVerseLongPressHandler(v.verse, v.text)}
                      delayLongPress={280}
                      onLayout={(e) => {
                        const { y, height } = e.nativeEvent.layout;
                        onVerseLayout(v.verse, y, height);
                        verseLayoutsRef.current.set(v.verse, { y, height });
                      }}
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
                            key={`vtext:${v.verse}:${highlightModeActive ? "edit" : "view"}`}
                            inline
                            highlight={highlightKind}
                            textHighlightColor={activeHighlightColor}
                            text={localeZhText(v.text)}
                            parts={speechPartsByVerse?.get(v.verse) ?? null}
                            highlightedCharIndexes={highlightedIndexes}
                            highlightEditMode={highlightModeActive}
                            {...verseBodyPressProps(v.verse, v.text)}
                            onToggleHighlightUnit={(start, end, color) =>
                              toggleVerseHighlightUnit(v.verse, highlightedIndexes, start, end, color)
                            }
                            onReplaceHighlightSelection={(next) =>
                              replaceVerseHighlightSelection(v.verse, next)
                            }
                            onPaintHighlightUnit={(start, end, mode, color) =>
                              paintVerseHighlightUnit(v.verse, start, end, mode, color)
                            }
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
                {neighbors.prev ? (
                  <Pressable onPress={() => goNeighbor(neighbors.prev, "back")}>
                    <View style={styles.endLinkRow}>
                      <MaterialIcons name="chevron-left" size={16} color={readTypography.breadcrumbColor} />
                      <Text style={styles.endLink}>{formatNeighborChapterLabel(neighbors.prev)}</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={() => router.push("/read/read")} style={styles.endCenter}>
                <Text style={styles.endCenterText}>{displayBookName}</Text>
              </Pressable>
              <View style={[styles.endSide, styles.endSideRight]}>
                {neighbors.next ? (
                  <Pressable onPress={() => goNeighbor(neighbors.next, "forward")}>
                    <View style={[styles.endLinkRow, styles.endLinkRowRight]}>
                      <Text style={styles.endLink}>{formatNeighborChapterLabel(neighbors.next)}</Text>
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

          <ReadChapterPostReadingEditions
            bookId={chapterData.bookId}
            chapter={chapterData.chapter}
            displayLocale={postReadingDisplayLocale}
            infoRoleId={prefersEnglishInfoEdition ? INFO_EDITION_V1_EN_ROLE_ID : null}
            guideRoleId={prefersEnglishInfoEdition ? INFO_EDITION_GUIDE_V2_EN_ROLE_ID : null}
            onBackToTop={scrollToTop}
            onGoPrevChapter={
              neighbors.prev ? () => goNeighbor(neighbors.prev, "back") : undefined
            }
            onGoNextChapter={
              neighbors.next ? () => goNeighbor(neighbors.next, "forward") : undefined
            }
          />

          {chapterCompleted ? (
            <ReadChapterCompletionPlanPanel
              bookId={chapterData.bookId}
              chapter={chapterData.chapter}
              displayLocale={postReadingDisplayLocale}
            />
          ) : null}

        </ParchmentBottomFadeScrollView>
      ) : null}

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
            onPress={() => router.push(readScriptureSearchRoute())}
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
              onPress={() => setSelectedVerses([])}
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
                  <MaterialIcons
                    name={highlightModeActive ? "check-circle-outline" : "edit"}
                    size={18}
                    color={c.ink}
                  />
                  <Text style={styles.verseActionBtnText}>
                    {highlightModeActive ? localeZhText("划重点模式中") : localeZhText("划重点（按字上底色）")}
                  </Text>
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

      {chapterData && highlightModeActive ? (
        <View
          style={[
            styles.highlightModeBar,
            {
              bottom: 88 + insets.bottom,
            },
          ]}
        >
          <Text style={styles.highlightModeTitle}>{localeZhText("划重点")}</Text>
          <View style={styles.highlightColorPicker}>
            {READ_VERSE_HIGHLIGHT_PALETTE.map((color) => {
              const active = color === activeHighlightColor;
              return (
                <Pressable
                  key={color}
                  onPress={() => setActiveHighlightColor(color)}
                  style={[
                    styles.highlightColorChip,
                    { backgroundColor: color },
                    active && styles.highlightColorChipActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    active ? localeZhText("当前高亮颜色") : localeZhText("切换高亮颜色")
                  }
                />
              );
            })}
          </View>
          <View style={styles.highlightModeActions}>
            <Pressable
              onPress={() => void finishHighlightMode()}
              style={({ pressed }) => [styles.selectionBtnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.selectionBtnPrimaryText}>{localeZhText("完成")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal visible={jumpOpen} animationType="slide" transparent onRequestClose={() => setJumpOpen(false)}>
        <Pressable style={styles.jumpBackdrop} onPress={() => setJumpOpen(false)}>
          <Pressable style={styles.jumpSheet} onPress={(e) => e.stopPropagation()}>
            <ReadParchmentBackgroundImage
              style={[styles.jumpSheetBg, { paddingBottom: 16 + insets.bottom }]}
              imageStyle={styles.jumpSheetBgImage}
            >
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
                  {tr("pages.read.chapterJumpTitle")}
                </Text>
                <View style={styles.jumpHeaderSpacer} />
              </View>
              <View style={styles.jumpCatalogScrollWrap}>
                <ParchmentBottomFadeScrollView
                  style={styles.jumpCatalogScroll}
                  fadePreset="default"
                  keyboardShouldPersistTaps="handled"
                >
                  <BibleCatalogOutline
                    sections={catalogSections}
                    activeBookId={bookId}
                    onPickChapter={jumpToChapter}
                    splitByTestamentColumns
                    bookMetaMode="none"
                    compactMode
                    showSectionTint={false}
                    sectionGapPx={8}
                    sectionStripeFullHeight
                    lockTextScale
                  />
                </ParchmentBottomFadeScrollView>
              </View>
              <Pressable onPress={() => setJumpOpen(false)} style={styles.jumpClose}>
                <Text style={styles.jumpCloseText}>{tr("pages.read.chapterJumpClose")}</Text>
              </Pressable>
            </ReadParchmentBackgroundImage>
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
    maxWidth: 448,
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
    color: c.inkSoft,
  },
  verseNumXref: {
    color: c.verseNum,
  },
  verseNumSelected: {
    color: c.inkSoft,
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
  verseNumActive: { color: c.inkSoft },
  verseNumSearchFocus: { color: c.inkSoft },
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
    maxHeight: "82%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  jumpSheetBg: {
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(236, 217, 185, 0.64)",
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
    height: 460,
    overflow: "hidden",
  },
  jumpCatalogScroll: {
    flex: 1,
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
  highlightModeBar: {
    position: "absolute",
    zIndex: 68,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
    shadowColor: "#1c1410",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  highlightModeTitle: {
    fontSize: 12,
    color: c.ink,
    textAlign: "left",
    ...parchmentSans(600),
  },
  highlightModeHint: {
    fontSize: 11,
    color: c.muted,
    textAlign: "center",
    ...parchmentSans(400),
  },
  highlightColorPicker: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
  },
  highlightColorChip: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(80, 50, 20, 0.35)",
  },
  highlightColorChipActive: {
    borderWidth: 2,
    borderColor: "#6A3D13",
    transform: [{ scale: 1.08 }],
  },
  highlightModeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  pressed: { opacity: 0.88 },
});
