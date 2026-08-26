import { Platform, Text, View, type LayoutChangeEvent } from "react-native";
import type { LoadedChapter } from "../bible/types";
import { ReadChapterVerseText } from "./ReadChapterVerseText";
import type { ReadBibleTypographyPx } from "./read-bible-typography-prefs";
import { READ_VERSE_NUM_BODY_GAP, type ChapterHighlightMap, type ContrastVerseLine } from "./readChapterScreenConstants";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";
import type { VerseSpeechPart } from "../bible/verse-annotations";

type VerseRow = LoadedChapter["verses"][number];

type Props = {
  verse: VerseRow;
  verseIndex: number;
  chapterData: LoadedChapter;
  px: ReadBibleTypographyPx;
  segmentMeta: { headingByVerse: Map<number, string[]>; paragraphStarts: Set<number> };
  nextVerse: VerseRow | undefined;
  searchFocusVerse: number | null;
  searchQuery: string;
  selectedVerses: number[];
  verseSelectionMode: boolean;
  highlightedVerseIndexes: ChapterHighlightMap;
  xrefVerseNumbers: Set<number> | null;
  activeVerseIndex: number | null;
  speechPartsByVerse: Map<number, VerseSpeechPart[] | null> | null;
  contrastByVerse: Map<number, ContrastVerseLine[]> | null;
  localeZhText: (text: string) => string;
  verseXrefA11yLabel: string;
  verseSelectionTapA11yHint: string;
  verseBookmarkA11yHint: string;
  isBookmarked: (ref: {
    translationId: string;
    bookId: string;
    chapter: number;
    verse: number;
  }) => boolean;
  parentVersePressHandler: (verse: number, text: string) => (() => void) | undefined;
  parentVerseLongPressHandler: (verse: number, text: string) => (() => void) | undefined;
  verseBodyPressProps: (verse: number, text: string) => Record<string, unknown>;
  reportVerseLayoutFromEvent: (verse: number, e: LayoutChangeEvent) => void;
  registerVerseHost: (verse: number, node: unknown) => void;
  onXrefVersePress: (verse: number) => void;
};

export function ReadChapterScreenVerseRow({
  verse: v,
  verseIndex: i,
  chapterData,
  px,
  segmentMeta,
  nextVerse,
  searchFocusVerse,
  searchQuery,
  selectedVerses,
  verseSelectionMode,
  highlightedVerseIndexes,
  xrefVerseNumbers,
  activeVerseIndex,
  speechPartsByVerse,
  contrastByVerse,
  localeZhText,
  verseXrefA11yLabel,
  verseSelectionTapA11yHint,
  verseBookmarkA11yHint,
  isBookmarked,
  parentVersePressHandler,
  parentVerseLongPressHandler,
  verseBodyPressProps,
  reportVerseLayoutFromEvent,
  registerVerseHost,
  onXrefVersePress,
}: Props) {
  const headings = segmentMeta.headingByVerse.get(v.verse) ?? [];
  const showParagraphBreak = i > 0 && segmentMeta.paragraphStarts.has(v.verse);
  const showParagraphRule = showParagraphBreak && headings.length > 0;
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
  const suppressVerseMarker = searchFocus || audioActive;
  const highlightKind = selected
    ? "selection"
    : suppressVerseMarker
      ? undefined
      : bookmarked
        ? "bookmark"
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
    <>
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
      <View
        collapsable={false}
        ref={(node) => registerVerseHost(v.verse, node)}
        onLayout={(e) => reportVerseLayoutFromEvent(v.verse, e)}
        accessibilityRole="button"
        accessibilityHint={verseSelectionMode ? verseSelectionTapA11yHint : verseBookmarkA11yHint}
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
                hasXref && styles.verseNumXref,
              ]}
              onPress={hasXref ? () => onXrefVersePress(v.verse) : undefined}
              suppressHighlighting={!hasXref}
              accessibilityRole={hasXref ? "button" : undefined}
              accessibilityLabel={hasXref ? `${v.verse}, ${verseXrefA11yLabel}` : undefined}
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
      </View>
    </>
  );
}
