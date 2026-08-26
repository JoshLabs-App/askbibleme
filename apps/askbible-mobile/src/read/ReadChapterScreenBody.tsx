import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { LoadedChapter } from "../bible/types";
import type { ContrastVerseLine } from "./readChapterScreenConstants";
import { useReadChapterExploreReturnHandler } from "../explore/explore-read-chapter-nav";
import type { ReadBibleTypographyPx } from "./read-bible-typography-prefs";
import { ReadChapterScreenOverlays } from "./ReadChapterScreenOverlays";
import { ReadChapterScreenScrollContent } from "./ReadChapterScreenScrollContent";
import { useReadChapterScreenDisplay } from "./useReadChapterScreenDisplay";
import { useReadChapterScreenNav } from "./useReadChapterScreenNav";
import { useReadChapterVerseActions } from "./useReadChapterVerseActions";

type DisplayProps = Omit<ReturnType<typeof useReadChapterScreenDisplay>, "clearXrefOnRouteChange">;
type VerseActionsProps = ReturnType<typeof useReadChapterVerseActions>;
type NavProps = Omit<ReturnType<typeof useReadChapterScreenNav>, "onAdvanceChapterAudio">;

type Props = {
  insets: EdgeInsets;
  bookId: string;
  chapterData: LoadedChapter | null;
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
  registerVerseHost: (verse: number, node: unknown) => void;
  registerParagraphHost: (verses: number[], node: unknown) => void;
  reportParagraphVerseBoxes: (
    boxes: Map<number, { y: number; height: number }>,
    fractions?: Iterable<{ verse: number; start: number; end: number; total: number }>,
  ) => void;
  reportParagraphFrame: (verses: number[], layout: { y: number; height: number }) => void;
  returnToExplore: ReturnType<typeof useReadChapterExploreReturnHandler>;
  navigation: { canGoBack: () => boolean; goBack: () => void };
  primaryTranslationId: string;
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

export function ReadChapterScreenBody({
  insets,
  bookId,
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
  registerVerseHost,
  registerParagraphHost,
  reportParagraphVerseBoxes,
  reportParagraphFrame,
  returnToExplore,
  navigation,
  primaryTranslationId,
  isBookmarked,
  display,
  verseActions,
  nav,
}: Props) {
  return (
    <>
      {chapterData ? (
        <ReadChapterScreenScrollContent
          insets={insets}
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
          isBookmarked={isBookmarked}
          display={display}
          verseActions={verseActions}
          nav={nav}
        />
      ) : null}

      <ReadChapterScreenOverlays
        insets={insets}
        bookId={bookId}
        chapterData={chapterData}
        primaryTranslationId={primaryTranslationId}
        returnToExplore={returnToExplore}
        navigation={navigation}
        display={display}
        verseActions={verseActions}
        nav={nav}
      />
    </>
  );
}
