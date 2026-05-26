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
import { loadBundledChapterSegments } from "../bible/bundled-chapter-segments";
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
import { useLocale } from "../i18n/LocaleProvider";
import { t, tFormat } from "../i18n/site-copy";
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
import { trackTelemetry } from "../telemetry/client";
import { writeLastReadPosition } from "./read-last-position";
import {
  isReadChapterCompleted,
  markReadChapterCompleted,
} from "./read-chapter-completion";

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

function buildFallbackCatalogSections(): ScriptureCanonCatalogSection[] {
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
      title: t("pages.read.catalogTestamentOld"),
      taglines: [],
      books: oldBooks,
    },
    {
      sectionId: "fallback-new-testament",
      order: 2,
      title: t("pages.read.catalogTestamentNew"),
      taglines: [],
      books: newBooks,
    },
  ];
}

type ReadChapterPlanRef = { bookId: string; chapter: number };
type VerseLayout = { y: number; height: number };

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
  const [contrastByVerse, setContrastByVerse] = useState<Map<number, string> | null>(null);
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
    contrastTranslationId,
    translationCatalog,
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
  const prefersEnglishInfoEdition = /^en\b/i.test(primaryTranslationMeta?.language ?? "");
  const isZhLocale = /^zh\b/i.test(locale);

  const catalogSections = useMemo(() => {
    try {
      const sections = getScriptureCanonCatalogSections();
      if (!sections.length) return buildFallbackCatalogSections();
      return sections;
    } catch {
      return buildFallbackCatalogSections();
    }
  }, []);

  const load = useCallback(async () => {
    if (!bookId || chapter == null) {
      setError(t("pages.read.invalidChapter"));
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
      const contrastMeta = contrastTranslationId
        ? translationCatalog.find((tr) => tr.id === contrastTranslationId)
        : null;
      const primaryLabels = {
        labelZh: primaryMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
        labelEn: primaryMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
      };
      const contrastLabels = contrastMeta
        ? { labelZh: contrastMeta.labelZh, labelEn: contrastMeta.labelEn }
        : null;

      const loaded = await loadChapterFromBundledTranslation(
        bookId,
        chapter,
        primaryTranslationId,
        primaryLabels,
      );

      const [contrastResult, xrefsResult] = await Promise.allSettled([
        contrastTranslationId && contrastLabels
          ? loadChapterFromBundledTranslation(
              bookId,
              chapter,
              contrastTranslationId,
              contrastLabels,
            )
          : Promise.resolve(null),
        loadChapterXrefs(bookId, chapter),
      ]);

      if (!loaded) {
        setChapterData(null);
        setError(t("pages.read.chapterLoadError"));
        return;
      }
      setChapterData(loaded);
      setChapterSegments(loadBundledChapterSegments(loaded.bookId, loaded.chapter));
      setChapterXrefs(xrefsResult.status === "fulfilled" ? xrefsResult.value : null);
      void recordTodayReadingChapterFraction(loaded.bookId, loaded.chapter, 0.1);

      const contrastLoaded = contrastResult.status === "fulfilled" ? contrastResult.value : null;
      if (contrastLoaded?.verses.length) {
        const map = new Map<number, string>();
        for (const v of contrastLoaded.verses) {
          map.set(v.verse, v.text);
        }
        setContrastByVerse(map);
      }
      await writeLastReadPosition({
        bookId: loaded.bookId,
        chapter: loaded.chapter,
        bookName: loaded.bookName,
      });
    } catch (e) {
      setChapterData(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [bookId, chapter, primaryTranslationId, contrastTranslationId, translationCatalog]);

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
        const text = (locale === "en" ? row.title : row.titleZh || row.title)?.trim();
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
  }, [chapterSegments, locale]);

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
        : 0;
    const fraction = Math.min(1, (verseIdx + 1) / total);
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
    Boolean(chapterData) && !jumpOpen && !verseSelectionMode,
    onChapterSwipe,
  );
  useShellSwipeSuspend(jumpOpen || verseSelectionMode);

  const onVersePress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
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
            bookName: chapterData.bookName,
            chapter: chapterData.chapter,
            verse,
            translationId: chapterData.translationId,
            text,
          };
          const added = await toggleVerseBookmark(ref);
          if (added) {
            try {
              await copyScriptureVerseToClipboard(ref);
            } catch {
              /* 剪贴板失败不阻断收藏 */
            }
          }
          void Haptics.notificationAsync(
            added
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning,
          );
          setBookmarkFeedback(
            added ? t("pages.read.verseBookmarkSaved") : t("pages.read.verseBookmarkRemoved"),
          );
        })();
        return;
      }
      lastVerseTapRef.current = { verse, at: now };
    },
    [chapterData, verseSelectionMode, toggleVerseBookmark, swipe],
  );

  const onVerseLongPress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
      longPressCopiedVerseRef.current = verse;
      swipe?.markExclude();
      void (async () => {
        const copied = await copyScriptureVerseToClipboard({
          bookId: chapterData.bookId,
          bookName: chapterData.bookName,
          chapter: chapterData.chapter,
          verse,
          translationId: chapterData.translationId,
          text,
        });
        void Haptics.notificationAsync(
          copied
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
        setBookmarkFeedback(
          copied ? t("pages.read.verseCopied") : t("pages.read.verseCopyFailed"),
        );
      })();
    },
    [chapterData, swipe],
  );

  const copySelectedVerses = useCallback(async () => {
    if (!chapterData || selectedVerses.length === 0) {
      setBookmarkFeedback(t("pages.read.verseSelectionEmpty"));
      return;
    }
    swipe?.markExclude();
    const selectedText = selectedVerses
      .map((verse) => {
        const row = chapterData.verses.find((v) => v.verse === verse);
        return row
          ? `${chapterData.bookName} ${chapterData.chapter}:${verse} ${row.text}`
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
        ? tFormat("pages.read.verseSelectionCopied", { count: selectedVerses.length })
        : t("pages.read.verseCopyFailed"),
    );
  }, [chapterData, selectedVerses, swipe]);

  useEffect(() => {
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }, [chapterData?.bookId, chapterData?.chapter]);

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
          <Text style={styles.statusText}>{t("pages.read.loadingChapter")}</Text>
        </View>
      ) : error ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryBtnText}>{t("pages.read.retry")}</Text>
          </Pressable>
        </View>
      ) : chapterData ? (
        <ParchmentBottomFadeScrollView
          ref={scrollRef}
          style={styles.scroll}
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
              {isZhLocale
                ? `${chapterData.bookName}${chapterData.chapter}章`
                : `${chapterData.bookName} ${chapterData.chapter}`}
            </Text>
          </View>

          {chapterData.verses.map((v, i) => {
            const headings = segmentMeta.headingByVerse.get(v.verse) ?? [];
            const showParagraphBreak = i > 0 && segmentMeta.paragraphStarts.has(v.verse);
            const showParagraphRule = showParagraphBreak && headings.length > 0;
            const nextVerse = chapterData.verses[i + 1];
            const nextHasParagraphBreak =
              nextVerse != null && segmentMeta.paragraphStarts.has(nextVerse.verse);
            const searchFocus = searchFocusVerse === v.verse;
            const bookmarked = isBookmarked({
              translationId: chapterData.translationId,
              bookId: chapterData.bookId,
              chapter: chapterData.chapter,
              verse: v.verse,
            });
            const audioActive = !searchFocus && !bookmarked && activeVerseIndex === i;
            const verseHighlight = verseTextHighlightStyleForVerse({
              isGolden: v.isGolden,
              bookmarked,
            });
            const verseNumHighlight = bookmarked ? undefined : verseHighlight;
            const highlightKind = bookmarked ? "bookmark" : v.isGolden ? "golden" : undefined;
            const xrefBundle = xrefsByVerse?.get(v.verse);
            const hasXref = Boolean(xrefBundle);
            return (
              <Fragment key={v.verse}>
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
                  onPress={() => onVersePress(v.verse, v.text)}
                  onLongPress={() => onVerseLongPress(v.verse, v.text)}
                  delayLongPress={280}
                  onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    onVerseLayout(v.verse, y, height);
                    verseLayoutsRef.current.set(v.verse, { y, height });
                  }}
                  accessibilityRole="button"
                  accessibilityHint={
                    verseSelectionMode
                      ? t("pages.read.verseSelectionTapA11yHint")
                      : t("pages.read.verseBookmarkA11yHint")
                  }
                >
                  <View
                    style={[
                      styles.verseBlock,
                      nextHasParagraphBreak && styles.verseBlockBeforeSegmentBreak,
                      selectedVerses.includes(v.verse) && styles.verseBlockSelected,
                      searchFocus && styles.verseLineSearchFocus,
                      audioActive && styles.verseLineActive,
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
                          selectedVerses.includes(v.verse) && styles.verseNumSelected,
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
                            ? `${v.verse}, ${t("pages.read.verseXrefMarkerA11y")}`
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
                        inline
                        highlight={highlightKind}
                        text={v.text}
                        parts={speechPartsByVerse?.get(v.verse) ?? null}
                      />
                    </Text>
                    {contrastByVerse?.get(v.verse) ? (
                      <Text
                        style={[
                          styles.verseContrast,
                          {
                            fontSize: px.verseFontSize * 0.92,
                            lineHeight: px.verseLineHeight * 0.78,
                          },
                        ]}
                      >
                        {contrastByVerse.get(v.verse)}
                      </Text>
                    ) : null}
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
                <Text style={styles.endCenterText}>{chapterData.bookName}</Text>
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
                    {locale === "en" ? "Completed" : "已完成读经"}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <ReadChapterPostReadingEditions
            bookId={chapterData.bookId}
            chapter={chapterData.chapter}
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
            <ReadChapterCompletionPlanPanel bookId={chapterData.bookId} chapter={chapterData.chapter} />
          ) : null}

        </ParchmentBottomFadeScrollView>
      ) : null}

      <ReadVerseBookmarkFeedback message={bookmarkFeedback} onClear={clearBookmarkFeedback} />

      {chapterData ? (
        <ReadChapterVerseXrefSheet
          visible={xrefSheetVerse != null}
          onClose={() => setXrefSheetVerse(null)}
          bookName={chapterData.bookName}
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
            accessibilityLabel={t("pages.read.chapterChromeBack")}
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
            onPress={() => router.push("/read/search")}
            disabled={verseSelectionMode}
            style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("pages.read.chapterChromeSearch")}
          >
            <MaterialIcons name="search" size={21} color="#FFFFFF" style={styles.topActionIcon} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/read/favorites")}
            disabled={verseSelectionMode}
            style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("pages.read.chapterChromeFavorites")}
          >
            <MaterialIcons name="bookmark-border" size={21} color="#FFFFFF" style={styles.topActionIcon} />
          </Pressable>
          <Pressable
            onPress={() => {
              swipe?.markExclude();
              setVerseSelectionMode((prev) => {
                if (prev) setSelectedVerses([]);
                return !prev;
              });
            }}
            style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("pages.read.verseSelectionToggle")}
            accessibilityState={{ selected: verseSelectionMode }}
          >
            <MaterialIcons
              name={verseSelectionMode ? "check-box" : "check-box-outline-blank"}
              size={21}
              color="#FFFFFF"
              style={styles.topActionIcon}
            />
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
            {tFormat("pages.read.verseSelectionPicked", { count: selectedVerses.length })}
          </Text>
          <View style={styles.selectionActions}>
            <Pressable
              onPress={() => setSelectedVerses([])}
              style={({ pressed }) => [styles.selectionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.selectionBtnText}>{t("pages.read.verseSelectionClear")}</Text>
            </Pressable>
            <Pressable
              onPress={() => void copySelectedVerses()}
              style={({ pressed }) => [styles.selectionBtnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.selectionBtnPrimaryText}>
                {t("pages.read.verseSelectionCopy")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setVerseSelectionMode(false);
                setSelectedVerses([]);
              }}
              style={({ pressed }) => [styles.selectionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.selectionBtnText}>{t("common.done")}</Text>
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
                  accessibilityLabel={t("pages.read.backToBibleHome")}
                >
                  <MaterialIcons name="arrow-back-ios-new" size={16} color={c.ink} />
                </Pressable>
                <Text
                  style={styles.jumpTitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                >
                  {t("pages.read.chapterJumpTitle")}
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
                <Text style={styles.jumpCloseText}>{t("pages.read.chapterJumpClose")}</Text>
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
  verseBlockBeforeSegmentBreak: {
    marginBottom: 0,
  },
  versePrimaryLine: {
    ...parchmentSans(readTypography.verseFontWeight),
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
    color: "#D97707",
  },
  verseNumSelected: {
    color: "#B45309",
  },
  verseBlockSelected: {
    backgroundColor: "rgba(217, 119, 7, 0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(180, 83, 9, 0.34)",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verseLineActive: {
    backgroundColor: c.verseAudioActiveBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.verseAudioActiveBorder,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verseLineSearchFocus: {
    backgroundColor: c.verseSearchFocusBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.verseSearchFocusBorder,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verseNumActive: { color: c.verseAudioActiveNum },
  verseNumSearchFocus: { color: c.verseSearchFocusNum },
  verseContrast: {
    marginTop: 3,
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
    borderColor: "rgba(180, 83, 9, 0.5)",
    backgroundColor: "rgba(217, 119, 7, 0.15)",
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
  pressed: { opacity: 0.88 },
});
