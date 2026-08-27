import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { preferEnglishChapterSegmentTitles } from "../bible/chapter-segment-display";
import {
  readScriptureTranslationDownloadState,
  subscribeScriptureTranslationDownload,
  type ScriptureTranslationDownloadState,
} from "../bible/scripture-translation-download";
import { normalizeScriptureSearchQuery } from "../bible/scripture-search";
import {
  EXPLORE_READ_RETURN_PARAM,
  resolveExploreReadReturnParam,
  useReadChapterExploreReturnHandler,
} from "../explore/explore-read-chapter-nav";
import { useLocale } from "../i18n/LocaleProvider";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadChapterScreenLoad } from "./useReadChapterScreenLoad";
import { useShellSwipeNav } from "../shell/ShellSwipeNavContext";
import { useParchmentColumnMaxWidth, useParchmentContentPadding } from "./parchmentColumnLayout";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { useReadChapterAudio } from "./useReadChapterAudio";
import { getMusicPlaybackControlSnapshot } from "../music/MusicPlaybackContext";
import type { PlayScriptureChapterSnapshotFn } from "../music/musicPlaybackControlSnapshot";
import { useReadChapterSearchFocus } from "./useReadChapterSearchFocus";
import { useScriptureVerseBookmarks } from "./useScriptureVerseBookmarks";
import { buildPlanChapterQueue } from "./read-plan-flow-nav";
import { consumeReadPlanFlowAutoplay } from "./read-plan-flow-autoplay";
import { getLocalReadingPlanRegistry } from "./reading-plan/fetch-reading-plan-registry";
import { useTodayReadingPlan } from "./useTodayReadingPlan";
import {
  parseBookIdParam,
  parseChapterParam,
} from "./readChapterScreenConstants";
import { useReadChapterVerseActions } from "./useReadChapterVerseActions";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";
import { useReadChapterScreenDisplay } from "./useReadChapterScreenDisplay";
import { useReadChapterScreenNav } from "./useReadChapterScreenNav";
import { useReadChapterScreenProgress } from "./useReadChapterScreenProgress";
import { ReadChapterScreenBody } from "./ReadChapterScreenBody";

export function ReadChapterScreen() {
  const navigation = useNavigation();
  const chapterFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const scrollColumnMaxWidth = useParchmentColumnMaxWidth();
  const params = useLocalSearchParams<{
    bookId: string;
    chapter: string;
    verse?: string;
    q?: string;
    planFlow?: string;
    planFlowTick?: string;
    autoplay?: string;
    [EXPLORE_READ_RETURN_PARAM]?: string;
  }>();
  const bookId = parseBookIdParam(params.bookId);
  const chapter = parseChapterParam(params.chapter);
  const searchQuery = useMemo(() => {
    const raw = Array.isArray(params.q) ? params.q[0] : params.q;
    return normalizeScriptureSearchQuery(raw ?? "");
  }, [params.q, bookId, chapter]);
  const isPlanFlow = String(Array.isArray(params.planFlow) ? params.planFlow[0] : params.planFlow || "") === "1";
  const planFlowTick = String(
    Array.isArray(params.planFlowTick) ? params.planFlowTick[0] : params.planFlowTick || "",
  );
  const exploreReturn = resolveExploreReadReturnParam(params[EXPLORE_READ_RETURN_PARAM]);
  const returnToExplore = useReadChapterExploreReturnHandler(exploreReturn);

  const scrollRef = useRef<ScrollView>(null);
  const scrollContentAnchorRef = useRef<View>(null);
  const scrollHeaderHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const [chapterCompleted, setChapterCompleted] = useState(false);
  const [audioViewportHeight, setAudioViewportHeight] = useState(0);
  const registryPlans = useMemo(() => getLocalReadingPlanRegistry().plans, []);
  const todayPlan = useTodayReadingPlan(registryPlans, { enabled: chapterFocused && isPlanFlow });
  const chapterCompletionMarkedRef = useRef(false);
  const lastRecordedFractionRef = useRef<{ bookId: string; chapter: number; fraction: number } | null>(
    null,
  );
  const { isBookmarked, toggle: toggleVerseBookmark } = useScriptureVerseBookmarks();
  const { locale } = useLocale();
  const playScriptureChapter = useCallback<PlayScriptureChapterSnapshotFn>(
    (args, opts) => getMusicPlaybackControlSnapshot().playScriptureChapter(args, opts),
    [],
  );
  const swipe = useShellSwipeNav();
  const {
    px,
    primaryTranslationId,
    contrastTranslationIds,
    translationCatalog,
    translationCatalogReady,
    verseParagraphFlow,
    chapterSegmentMode,
    audioVoiceId,
    chapterAudioTranslationId,
  } = useReadBibleTypography();
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

  const clearXrefOnRouteChangeRef = useRef<() => void>(() => {});
  const onChapterRouteChange = useCallback(() => clearXrefOnRouteChangeRef.current(), []);

  const {
    loading,
    error,
    chapterData,
    chapterSegments,
    contrastByVerse,
    contrastLoadRequested,
    setContrastLoadRequested,
    highlightsLoadRequested,
    setHighlightsLoadRequested,
    postReadingReady,
    setPostReadingReady,
    xrefVerseNumbers,
    chapterScrollIntentRef,
    load,
  } = useReadChapterScreenLoad({
    bookId,
    chapter,
    chapterFocused,
    chapterCompleted,
    primaryTranslationId,
    translationCatalogReady,
    translationCatalog,
    contrastTranslationIds,
    chapterSegmentMode,
    preferEnglishSegmentTitles,
    navigation,
    scrollRef,
    lastRecordedFractionRef,
    onChapterRouteChange,
  });

  const display = useReadChapterScreenDisplay({
    locale,
    primaryTranslationMeta,
    chapterData,
    chapterSegments,
    preferEnglishSegmentTitles,
    verseParagraphFlow,
    contrastTranslationIds,
    isPlanFlow,
    todayPlanPayload: todayPlan.payload,
    bookId,
    chapter,
  });
  const { tr } = display;
  clearXrefOnRouteChangeRef.current = display.clearXrefOnRouteChange;

  const [translationDownload, setTranslationDownload] = useState<ScriptureTranslationDownloadState>(
    () => readScriptureTranslationDownloadState(),
  );
  useEffect(() => {
    return subscribeScriptureTranslationDownload(() => {
      setTranslationDownload(readScriptureTranslationDownloadState());
    });
  }, []);
  const preparingTranslation =
    translationDownload.status === "running" &&
    (!translationDownload.translationId ||
      translationDownload.translationId === primaryTranslationId);
  const preparePercent = Math.max(0, Math.min(100, translationDownload.percent));

  const {
    searchFocusVerse,
    verseLayoutsRef,
    scrollOffsetRef,
    scrollViewportHeight,
    onScrollViewportLayout,
    onChapterScrollOffset,
    reportVerseLayoutFromEvent,
    registerVerseHost,
    registerParagraphHost,
    reportParagraphVerseBoxes,
    reportParagraphFrame,
    refreshScrollViewportTop,
    remeasureVerseLayoutInContent,
    onScrollContentAnchorLayout,
  } = useReadChapterSearchFocus(
    chapterData,
    params.verse,
    scrollRef,
    scrollContentHeightRef,
    scrollContentAnchorRef,
    insets,
    scrollHeaderHeightRef,
  );

  const verseActions = useReadChapterVerseActions({
    chapterData,
    chapterFocused,
    highlightsLoadRequested,
    displayBookName: display.displayBookName,
    localeZhText: display.localeZhText,
    tr: display.tr,
    toggleVerseBookmark,
    isBookmarked,
    swipe,
  });

  const planChapterQueue = useMemo(() => {
    if (!isPlanFlow || !todayPlan.payload?.day?.readings?.length) return [];
    return buildPlanChapterQueue(todayPlan.payload.day.readings);
  }, [isPlanFlow, todayPlan.payload]);

  const autoplayParam = String(
    Array.isArray(params.autoplay) ? params.autoplay[0] : params.autoplay || "",
  );
  const autoplayConsumedRef = useRef(false);
  // 普通读经章：吃掉计划页遗留 autoplay，默认不开音频
  useEffect(() => {
    if (isPlanFlow || autoplayParam === "1") return;
    consumeReadPlanFlowAutoplay();
  }, [bookId, chapter, isPlanFlow, autoplayParam]);
  useEffect(() => {
    if (autoplayParam !== "1" || autoplayConsumedRef.current) return;
    if (!chapterData) return;
    autoplayConsumedRef.current = true;
    void playScriptureChapter({
      bookId: chapterData.bookId,
      chapter: chapterData.chapter,
      bookName: display.displayBookName,
      translationId: chapterAudioTranslationId,
    });
  }, [autoplayParam, chapterData, display.displayBookName, chapterAudioTranslationId, playScriptureChapter]);

  const nav = useReadChapterScreenNav({
    chapterData,
    navigation,
    scrollRef,
    isPlanFlow,
    planFlowNextTarget: display.planFlowNextTarget,
    planFlowPrevTarget: display.planFlowPrevTarget,
    todayPlanPayload: todayPlan.payload,
    chapterAudioTranslationId,
    audioVoiceId,
    playScriptureChapter,
    neighbors: display.neighbors,
    verseSelectionMode: verseActions.verseSelectionMode,
    verseActionMenu: verseActions.verseActionMenu,
    highlightWordEditor: verseActions.highlightWordEditor,
  });

  const { onAdvanceChapterAudio } = nav;

  const { activeVerseIndex, nearAudioEnd } = useReadChapterAudio(chapterData, scrollRef, {
    onAdvanceChapter: onAdvanceChapterAudio,
    isPlanFlow,
    planFlowTick,
    planFlowQueue: planChapterQueue,
  });

  const { onChapterScroll, onChapterContentSizeChange } = useReadChapterScreenProgress({
    chapterData,
    chapterCompleted,
    setChapterCompleted,
    chapterCompletionMarkedRef,
    chapterScrollIntentRef,
    setContrastLoadRequested,
    setHighlightsLoadRequested,
    setPostReadingReady,
    onChapterScrollOffset,
    scrollContentHeightRef,
    audioViewportHeight,
    scrollViewportHeight,
    activeVerseIndex,
    nearAudioEnd,
    lastRecordedFractionRef,
  });

  const prepareStatus = (
    <>
      <ActivityIndicator color={c.muted} />
      <Text style={styles.statusText}>
        {preparingTranslation ? tr("pages.read.preparingTranslation") : tr("pages.read.loadingChapter")}
      </Text>
      {preparingTranslation ? (
        <>
          <View style={styles.prepareProgressTrack} accessibilityRole="progressbar">
            <View style={[styles.prepareProgressFill, { width: `${preparePercent}%` }]} />
          </View>
          <Text style={styles.preparePercentText}>{preparePercent}%</Text>
        </>
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      {loading && !chapterData ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>{prepareStatus}</View>
      ) : error ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryBtnText}>{tr("pages.read.retry")}</Text>
          </Pressable>
        </View>
      ) : !chapterData ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          {prepareStatus}
          {!preparingTranslation ? (
            <Pressable
              onPress={() => void load()}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed, { marginTop: 12 }]}
            >
              <Text style={styles.retryBtnText}>{tr("pages.read.retry")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {(loading || preparingTranslation) && chapterData ? (
        <View style={[styles.prepareOverlay, { paddingTop: insets.top }]} pointerEvents="auto">
          {prepareStatus}
        </View>
      ) : null}

      <ReadChapterScreenBody
        insets={insets}
        bookId={bookId}
        chapterData={chapterData}
        searchQuery={searchQuery}
        scrollRef={scrollRef}
        scrollContentAnchorRef={scrollContentAnchorRef}
        scrollHeaderHeightRef={scrollHeaderHeightRef}
        scrollColumnMaxWidth={scrollColumnMaxWidth}
        setAudioViewportHeight={setAudioViewportHeight}
        onScrollViewportLayout={onScrollViewportLayout}
        refreshScrollViewportTop={refreshScrollViewportTop}
        onScrollContentAnchorLayout={onScrollContentAnchorLayout}
        onChapterScroll={onChapterScroll}
        onChapterContentSizeChange={onChapterContentSizeChange}
        px={px}
        searchFocusVerse={searchFocusVerse}
        activeVerseIndex={activeVerseIndex}
        contrastByVerse={contrastByVerse}
        xrefVerseNumbers={xrefVerseNumbers}
        postReadingReady={postReadingReady}
        chapterCompleted={chapterCompleted}
        reportVerseLayoutFromEvent={reportVerseLayoutFromEvent}
        registerVerseHost={registerVerseHost}
        registerParagraphHost={registerParagraphHost}
        reportParagraphVerseBoxes={reportParagraphVerseBoxes}
        reportParagraphFrame={reportParagraphFrame}
        returnToExplore={returnToExplore}
        navigation={navigation}
        primaryTranslationId={primaryTranslationId}
        isBookmarked={isBookmarked}
        display={display}
        verseActions={verseActions}
        nav={nav}
      />
    </View>
  );
}
