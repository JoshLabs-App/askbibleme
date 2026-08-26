import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { BibleCatalogOutlineContent } from "./BibleCatalogOutlineContent";
import {
  BibleChapterPickerPanel,
  ChapterPickerModal,
} from "./BibleChapterPickerPanel";
import {
  PARCHMENT_CATALOG_MAX_WIDTH_PHONE,
  useParchmentColumnMaxWidth,
} from "./parchmentColumnLayout";
import {
  groupCanonSectionsByTestament,
  type ScriptureCanonCatalogBook,
  type ScriptureCanonCatalogSection,
} from "./canonCatalog";
import { useBibleCatalogChapterPicker } from "./useBibleCatalogChapterPicker";
import type { AppLocale } from "../i18n/config";

type Props = {
  sections: ScriptureCanonCatalogSection[];
  activeBookId?: string;
  onPickChapter: (bookId: string, chapter: number) => void;
  showBookSummary?: boolean;
  /** 首页双栏：提供开关，打开后各卷书名下显示简介 */
  enableBookSummaryToggle?: boolean;
  completedChaptersByBook?: Record<string, number>;
  paginateByTestament?: boolean;
  splitByTestamentColumns?: boolean;
  bookMetaMode?: "progress" | "chapterCount" | "none";
  compactMode?: boolean;
  showSectionTint?: boolean;
  sectionGapPx?: number;
  sectionStripeFullHeight?: boolean;
  lockTextScale?: boolean;
  onBookPress?: (book: ScriptureCanonCatalogBook) => void;
  onTestamentChange?: () => void;
  displayLocale?: AppLocale;
};

export function BibleCatalogOutline({
  sections,
  activeBookId,
  onPickChapter,
  showBookSummary = false,
  enableBookSummaryToggle = false,
  completedChaptersByBook,
  paginateByTestament = false,
  splitByTestamentColumns = false,
  bookMetaMode = "progress",
  compactMode = false,
  showSectionTint = true,
  sectionGapPx,
  sectionStripeFullHeight = false,
  lockTextScale = true,
  onBookPress,
  onTestamentChange,
  displayLocale = "zh-CN",
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const catalogMaxWidth = useParchmentColumnMaxWidth(PARCHMENT_CATALOG_MAX_WIDTH_PHONE);
  const catalogNarrowStyle =
    catalogMaxWidth != null ? { maxWidth: catalogMaxWidth } : null;
  const groups = groupCanonSectionsByTestament(sections);
  const [activeTestament, setActiveTestament] = useState<"old" | "new">("old");
  const [summaryToggleOn, setSummaryToggleOn] = useState(false);
  const didAutoPickTestamentRef = useRef(false);
  const appliedHomeDefaultTestamentRef = useRef(false);

  const {
    picker,
    chapterPickerLayout,
    chapterPickerModalHeight,
    chapterPickerViewportHeight,
    closePicker,
    closePickerFromBackdrop,
    openBook,
    onPickChapterFromPicker,
    setMeasuredModalViewportH,
  } = useBibleCatalogChapterPicker({
    windowWidth,
    windowHeight,
    onBookPress,
    onPickChapter,
  });

  useEffect(() => {
    if (!paginateByTestament) return;
    if (appliedHomeDefaultTestamentRef.current) return;
    appliedHomeDefaultTestamentRef.current = true;
    setActiveTestament("new");
  }, [paginateByTestament]);

  const selectTestament = useCallback(
    (testament: "old" | "new") => {
      setActiveTestament(testament);
      closePicker();
      onTestamentChange?.();
    },
    [closePicker, onTestamentChange],
  );

  useEffect(() => {
    if (paginateByTestament) return;
    if (didAutoPickTestamentRef.current) return;
    if (!activeBookId) return;
    for (const group of groups) {
      if (group.sections.some((section) => section.books.some((book) => book.bookId === activeBookId))) {
        setActiveTestament(group.testament);
        didAutoPickTestamentRef.current = true;
        return;
      }
    }
    didAutoPickTestamentRef.current = true;
  }, [activeBookId, groups, paginateByTestament]);

  const columnLayout = splitByTestamentColumns && !paginateByTestament;
  const effectiveShowBookSummary = showBookSummary || (enableBookSummaryToggle && summaryToggleOn);

  return (
    <>
      <BibleCatalogOutlineContent
        groups={groups}
        activeBookId={activeBookId}
        activeTestament={activeTestament}
        paginateByTestament={paginateByTestament}
        splitByTestamentColumns={splitByTestamentColumns}
        columnLayout={columnLayout}
        compactMode={compactMode}
        showBookSummary={effectiveShowBookSummary}
        enableBookSummaryToggle={enableBookSummaryToggle}
        bookSummaryToggleOn={summaryToggleOn}
        onBookSummaryToggleChange={setSummaryToggleOn}
        completedChaptersByBook={completedChaptersByBook}
        bookMetaMode={bookMetaMode}
        showSectionTint={showSectionTint}
        sectionGapPx={sectionGapPx}
        sectionStripeFullHeight={sectionStripeFullHeight}
        lockTextScale={lockTextScale}
        catalogNarrowStyle={catalogNarrowStyle}
        displayLocale={displayLocale}
        onSelectTestament={selectTestament}
        onBookPress={openBook}
      />
      {!onBookPress && picker && chapterPickerLayout ? (
        <ChapterPickerModal
          visible
          sheetHeight={chapterPickerLayout.sheetHeight}
          onRequestClose={closePicker}
          onBackdropPress={closePickerFromBackdrop}
          onBackdropLayout={(h) => {
            setMeasuredModalViewportH(Math.max(chapterPickerModalHeight, Math.round(h * 0.82)));
          }}
        >
          <BibleChapterPickerPanel
            bookId={picker.bookId}
            viewportHeight={chapterPickerViewportHeight}
            lockTextScale={lockTextScale}
            onBack={closePicker}
            onPickChapter={onPickChapterFromPicker}
          />
        </ChapterPickerModal>
      ) : null}
    </>
  );
}
