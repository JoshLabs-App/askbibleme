import { useRouter } from "expo-router";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { LoadedChapter } from "../bible/types";
import { useReadChapterExploreReturnHandler } from "../explore/explore-read-chapter-nav";
import { ReadChapterScreenJumpModal } from "./ReadChapterScreenJumpModal";
import { ReadChapterScreenTopChrome } from "./ReadChapterScreenTopChrome";
import { ReadChapterScreenVerseActionModal } from "./ReadChapterScreenVerseActionModal";
import { ReadChapterVerseXrefSheet } from "./ReadChapterVerseXrefSheet";
import { ReadVerseBookmarkFeedback } from "./ReadVerseBookmarkFeedback";
import { ReadVerseHighlightWordSheet } from "./ReadVerseHighlightWordSheet";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
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
  primaryTranslationId: string;
  returnToExplore: ReturnType<typeof useReadChapterExploreReturnHandler>;
  navigation: { canGoBack: () => boolean; goBack: () => void };
  display: DisplayProps;
  verseActions: VerseActionsProps;
  nav: NavProps;
};

export function ReadChapterScreenOverlays({
  insets,
  bookId,
  chapterData,
  primaryTranslationId,
  returnToExplore,
  navigation,
  display,
  verseActions,
  nav,
}: Props) {
  const router = useRouter();
  const { bumpSize, sizeAtMax, sizeAtMin } = useReadBibleTypography();
  const {
    readDisplayLocale,
    tr,
    localeZhText,
    displayBookName,
    catalogSections,
    xrefSheetBundle,
    xrefSheetLoading,
    xrefSheetVerse,
    setXrefSheetVerse,
    xrefBookName,
    speechPartsByVerse,
  } = display;
  const {
    bookmarkFeedback,
    clearBookmarkFeedback,
    verseSelectionMode,
    selectedVerses,
    highlightedVerseIndexes,
    verseActionMenu,
    setVerseActionMenu,
    highlightWordEditor,
    setHighlightWordEditor,
    verseActionMenuBookmarked,
    exitVerseSelectionMode,
    copySelectedVerses,
    runCopyCurrentVerse,
    runStartMultiCopy,
    runToggleVerseBookmarkFromMenu,
    runOpenHighlightEditor,
    handleHighlightWordSaved,
    runShareVerse,
    setBookmarkFeedback,
  } = verseActions;
  const {
    jumpOpen,
    setJumpOpen,
    jumpPickerBookId,
    setJumpPickerBookId,
    jumpToChapter,
    onJumpBookPress,
    goReadHomeFromCatalog,
  } = nav;

  return (
    <>
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
        <ReadChapterScreenTopChrome
          insets={insets}
          verseSelectionMode={verseSelectionMode}
          showSearch={false}
          showAudio={false}
          favoritesA11yLabel={tr("pages.read.chapterChromeFavorites")}
          increaseSizeA11yLabel={
            readDisplayLocale === "en" ? "Increase text size" : localeZhText("放大字号")
          }
          decreaseSizeA11yLabel={
            readDisplayLocale === "en" ? "Decrease text size" : localeZhText("缩小字号")
          }
          selectionCountLabel={tr("pages.read.verseSelectionPicked", { count: selectedVerses.length })}
          selectionClearLabel={tr("pages.read.verseSelectionClear")}
          selectionCopyLabel={tr("pages.read.verseSelectionCopy")}
          sizeAtMax={sizeAtMax}
          sizeAtMin={sizeAtMin}
          onBack={() => {
            if (returnToExplore()) return;
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            router.push("/read");
          }}
          onFavorites={() => router.push("/read/favorites")}
          onIncreaseSize={() => bumpSize(1)}
          onDecreaseSize={() => bumpSize(-1)}
          onExitSelection={exitVerseSelectionMode}
          onCopySelection={() => void copySelectedVerses()}
        />
      ) : null}

      {chapterData && verseActionMenu ? (
        <ReadChapterScreenVerseActionModal
          menu={verseActionMenu}
          title={
            readDisplayLocale === "en"
              ? `Verse ${verseActionMenu.verse}`
              : localeZhText(`第 ${verseActionMenu.verse} 节`)
          }
          bookmarked={verseActionMenuBookmarked}
          bookmarkLabel={tr("pages.read.verseActionBookmark")}
          copyLabel={localeZhText("本节复制")}
          multiCopyLabel={localeZhText("多选复制")}
          highlightLabel={localeZhText("划重点词")}
          shareLabel={localeZhText("分享")}
          closeLabel={localeZhText("关闭")}
          onClose={() => setVerseActionMenu(null)}
          onCopy={() => void runCopyCurrentVerse()}
          onMultiCopy={runStartMultiCopy}
          onToggleBookmark={() => void runToggleVerseBookmarkFromMenu()}
          onHighlight={runOpenHighlightEditor}
          onShare={runShareVerse}
        />
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

      <ReadChapterScreenJumpModal
        visible={jumpOpen}
        insets={insets}
        jumpPickerBookId={jumpPickerBookId}
        catalogSections={catalogSections}
        activeBookId={bookId}
        onClose={() => setJumpOpen(false)}
        onGoReadHome={goReadHomeFromCatalog}
        onPickBook={onJumpBookPress}
        onClearPickerBook={() => setJumpPickerBookId(null)}
        onPickChapter={jumpToChapter}
        jumpTitle={tr("pages.read.chapterJumpTitle")}
        closeLabel={tr("pages.read.chapterJumpClose")}
      />
    </>
  );
}
