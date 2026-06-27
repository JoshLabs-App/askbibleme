import { useRouter } from "expo-router";
import {
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { LoadedChapter } from "../bible/types";
import type { ContrastVerseLine } from "./readChapterScreenConstants";
import { ReadChapterCompletionPlanPanel } from "./ReadChapterCompletionPlanPanel";
import { ReadChapterReadingPlanAdvance } from "./ReadChapterReadingPlanAdvance";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import { useEffectiveReadingPlanPrefs } from "./reading-plan/useReadingPlanStores";
import { ReadChapterPostReadingEditions } from "./ReadChapterPostReadingEditions";
import { ReadChapterScreenEndingSection } from "./ReadChapterScreenEndingSection";
import { ReadChapterScreenVerseList } from "./ReadChapterScreenVerseList";
import { ParchmentBottomFadeScrollView } from "./ParchmentBottomFadeScrollView";
import { READ_TAB_SCROLL_FADE_PRESET } from "./readParchmentScrollMask";
import { readChapterScrollBottomPad } from "./read-chapter-chrome-inset";
import type { ReadBibleTypographyPx } from "./read-bible-typography-prefs";
import { useParchmentContentPadding, useReadChapterSpreadLayout } from "./parchmentColumnLayout";
import { readChapterSpreadLayoutStyles as spreadStyles } from "./readChapterSpreadLayoutStyles";
import {
  INFO_EDITION_GUIDE_V2_EN_ROLE_ID,
  INFO_EDITION_V1_EN_ROLE_ID,
  READ_CHAPTER_SCROLL_TOP_PAD,
} from "./readChapterScreenConstants";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";
import { useReadChapterScreenDisplay } from "./useReadChapterScreenDisplay";
import { useReadChapterScreenNav } from "./useReadChapterScreenNav";
import { useReadChapterVerseActions } from "./useReadChapterVerseActions";

type DisplayProps = Omit<ReturnType<typeof useReadChapterScreenDisplay>, "clearXrefOnRouteChange">;
type VerseActionsProps = ReturnType<typeof useReadChapterVerseActions>;
type NavProps = Omit<ReturnType<typeof useReadChapterScreenNav>, "onAdvanceChapterAudio">;

type Props = {
  insets: EdgeInsets;
  chapterData: LoadedChapter;
  searchQuery: string;
  scrollRef: React.RefObject<ScrollView | null>;
  scrollContentAnchorRef: React.RefObject<View | null>;
  scrollHeaderHeightRef: React.MutableRefObject<number>;
  scrollColumnMaxWidth: number | undefined;
  setAudioViewportHeight: (height: number) => void;
  onScrollViewportLayout: (height: number) => void;
  refreshScrollViewportTop: () => void;
  onScrollContentAnchorLayout: () => void;
  onChapterScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onChapterContentSizeChange: (width: number, height: number) => void;
  px: ReadBibleTypographyPx;
  searchFocusVerse: number | null;
  activeVerseIndex: number | null;
  contrastByVerse: Map<number, ContrastVerseLine[]> | null;
  xrefVerseNumbers: Set<number> | null;
  postReadingReady: boolean;
  chapterCompleted: boolean;
  reportVerseLayoutFromEvent: (verse: number, e: LayoutChangeEvent) => void;
  isBookmarked: (ref: {
    translationId: string;
    bookId: string;
    chapter: number;
    verse: number;
  }) => boolean;
  display: DisplayProps;
  verseActions: VerseActionsProps;
  nav: NavProps;
};

export function ReadChapterScreenScrollContent({
  insets,
  chapterData,
  searchQuery,
  scrollRef,
  scrollContentAnchorRef,
  scrollHeaderHeightRef,
  scrollColumnMaxWidth,
  setAudioViewportHeight,
  onScrollViewportLayout,
  refreshScrollViewportTop,
  onScrollContentAnchorLayout,
  onChapterScroll,
  onChapterContentSizeChange,
  px,
  searchFocusVerse,
  activeVerseIndex,
  contrastByVerse,
  xrefVerseNumbers,
  postReadingReady,
  chapterCompleted,
  reportVerseLayoutFromEvent,
  isBookmarked,
  display,
  verseActions,
  nav,
}: Props) {
  const router = useRouter();
  const { prefs } = useEffectiveReadingPlanPrefs();
  const showTripleLoopAdvance = isTripleLoopPlanId(prefs.planId);
  const { width: screenWidth } = useWindowDimensions();
  const scrollPadX = useParchmentContentPadding();
  const isSpread = useReadChapterSpreadLayout();
  const {
    tr,
    localeZhText,
    localeDisplayText,
    displayBookName,
    chapterTitleText,
    formatNeighborChapterLabel,
    endNavNext,
    endNavPrev,
    speechPartsByVerse,
    segmentMeta,
    paragraphGroups,
    useParagraphFlowLayout,
    verseIndexByVerse,
    postReadingDisplayLocale,
    isEnglishPostReading,
    prefersEnglishInfoEdition,
    setXrefSheetVerse,
  } = display;
  const {
    highlightWordEditor,
    selectedVerses,
    verseSelectionMode,
    highlightedVerseIndexes,
    parentVersePressHandler,
    parentVerseLongPressHandler,
    verseBodyPressProps,
  } = verseActions;
  const { scrollToTop, goNextChrome, goPrevChrome } = nav;

  const chapterHeader = (
    <View
      style={[styles.header, isSpread && spreadStyles.headerSpread]}
      onLayout={(e) => {
        scrollHeaderHeightRef.current = Math.round(e.nativeEvent.layout.height);
      }}
    >
      <Text style={[styles.chapterTitle, { fontSize: px.chapterTitleSize }]}>
        {chapterTitleText}
      </Text>
    </View>
  );

  const verseList = (
    <ReadChapterScreenVerseList
      chapterData={chapterData}
      px={px}
      useParagraphFlowLayout={useParagraphFlowLayout}
      paragraphGroups={paragraphGroups}
      segmentMeta={segmentMeta}
      searchFocusVerse={searchFocusVerse}
      searchQuery={searchQuery}
      selectedVerses={selectedVerses}
      verseSelectionMode={verseSelectionMode}
      highlightedVerseIndexes={highlightedVerseIndexes}
      xrefVerseNumbers={xrefVerseNumbers}
      activeVerseIndex={activeVerseIndex}
      verseIndexByVerse={verseIndexByVerse}
      speechPartsByVerse={speechPartsByVerse}
      contrastByVerse={contrastByVerse}
      localeZhText={localeZhText}
      verseXrefA11yLabel={tr("pages.read.verseXrefMarkerA11y")}
      verseSelectionTapA11yHint={tr("pages.read.verseSelectionTapA11yHint")}
      verseBookmarkA11yHint={tr("pages.read.verseBookmarkA11yHint")}
      isBookmarked={isBookmarked}
      parentVersePressHandler={parentVersePressHandler}
      parentVerseLongPressHandler={parentVerseLongPressHandler}
      verseBodyPressProps={verseBodyPressProps}
      reportVerseLayoutFromEvent={reportVerseLayoutFromEvent}
      onXrefVersePress={setXrefSheetVerse}
    />
  );

  const endingSection = (
    <ReadChapterScreenEndingSection
      screenWidth={screenWidth}
      displayBookName={displayBookName}
      chapterCompleted={chapterCompleted}
      completedLabel={isEnglishPostReading ? "Completed" : localeDisplayText("已完成读经")}
      endNavPrev={endNavPrev}
      endNavNext={endNavNext}
      formatNeighborChapterLabel={formatNeighborChapterLabel}
      onGoPrev={goPrevChrome}
      onGoNext={goNextChrome}
      onOpenCatalog={() => router.push("/read/catalog")}
    />
  );

  const completionPanels =
    chapterCompleted ? (
      <>
        {showTripleLoopAdvance ? (
          <ReadChapterReadingPlanAdvance bookId={chapterData.bookId} chapter={chapterData.chapter} />
        ) : null}
        <ReadChapterCompletionPlanPanel
          bookId={chapterData.bookId}
          chapter={chapterData.chapter}
          displayLocale={postReadingDisplayLocale}
        />
      </>
    ) : null;

  const postReadingEditions = postReadingReady ? (
    <ReadChapterPostReadingEditions
      bookId={chapterData.bookId}
      chapter={chapterData.chapter}
      displayLocale={postReadingDisplayLocale}
      infoRoleId={prefersEnglishInfoEdition ? INFO_EDITION_V1_EN_ROLE_ID : null}
      guideRoleId={prefersEnglishInfoEdition ? INFO_EDITION_GUIDE_V2_EN_ROLE_ID : null}
      spreadLayout={isSpread}
      onBackToTop={isSpread ? undefined : scrollToTop}
      onGoPrevChapter={isSpread ? undefined : endNavPrev ? goPrevChrome : undefined}
      onGoNextChapter={isSpread ? undefined : endNavNext ? goNextChrome : undefined}
    />
  ) : null;

  return (
    <ParchmentBottomFadeScrollView
      ref={scrollRef}
      fadePreset={isSpread ? "prose" : READ_TAB_SCROLL_FADE_PRESET}
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
        { paddingHorizontal: scrollPadX },
        !isSpread && scrollColumnMaxWidth != null ? { maxWidth: scrollColumnMaxWidth } : null,
        {
          paddingTop: READ_CHAPTER_SCROLL_TOP_PAD + insets.top,
          paddingBottom: readChapterScrollBottomPad(insets.bottom, true),
        },
      ]}
    >
      <View
        ref={scrollContentAnchorRef}
        collapsable={false}
        onLayout={() => onScrollContentAnchorLayout()}
      >
      {isSpread ? (
        <View style={spreadStyles.openBook}>
          <View style={spreadStyles.leftPage}>
            {chapterHeader}
            {verseList}
            {endingSection}
            {completionPanels}
          </View>
          <View style={spreadStyles.spine} />
          <View style={spreadStyles.rightPage}>{postReadingEditions}</View>
        </View>
      ) : (
        <>
          {chapterHeader}
          {verseList}
          {endingSection}
          {postReadingEditions}
          {completionPanels}
        </>
      )}
      </View>
    </ParchmentBottomFadeScrollView>
  );
}
