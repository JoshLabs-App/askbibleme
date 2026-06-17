import { Fragment } from "react";
import { Platform, Text, View, type LayoutChangeEvent } from "react-native";
import type { LoadedChapter } from "../bible/types";
import { ReadChapterVerseText } from "./ReadChapterVerseText";
import { ReadChapterScreenVerseRow } from "./ReadChapterScreenVerseRow";
import type { ReadBibleTypographyPx } from "./read-bible-typography-prefs";
import { READ_VERSE_NUM_BODY_GAP, type ChapterHighlightMap, type ContrastVerseLine } from "./readChapterScreenConstants";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";
import type { VerseSpeechPart } from "../bible/verse-annotations";

type VerseRow = LoadedChapter["verses"][number];

type Props = {
  chapterData: LoadedChapter;
  px: ReadBibleTypographyPx;
  useParagraphFlowLayout: boolean;
  paragraphGroups: Array<{ verses: VerseRow[] }>;
  segmentMeta: { headingByVerse: Map<number, string[]>; paragraphStarts: Set<number> };
  searchFocusVerse: number | null;
  searchQuery: string;
  selectedVerses: number[];
  verseSelectionMode: boolean;
  highlightedVerseIndexes: ChapterHighlightMap;
  xrefVerseNumbers: Set<number> | null;
  activeVerseIndex: number | null;
  verseIndexByVerse: Map<number, number>;
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
  onXrefVersePress: (verse: number) => void;
};

export function ReadChapterScreenVerseList({
  chapterData,
  px,
  useParagraphFlowLayout,
  paragraphGroups,
  segmentMeta,
  searchFocusVerse,
  searchQuery,
  selectedVerses,
  verseSelectionMode,
  highlightedVerseIndexes,
  xrefVerseNumbers,
  activeVerseIndex,
  verseIndexByVerse,
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
  onXrefVersePress,
}: Props) {
  if (useParagraphFlowLayout) {
    return (
      <>
        {paragraphGroups.map((group, groupIndex) => {
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
                        style={[styles.verseInlineChunk, verseChunkBackgroundStyle]}
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
                          accessibilityLabel={
                            hasXref ? `${v.verse}, ${verseXrefA11yLabel}` : undefined
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
        })}
      </>
    );
  }

  return (
    <>
      {chapterData.verses.map((v, i) => {
        const searchFocus = searchFocusVerse === v.verse;
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
        return (
          <ReadChapterScreenVerseRow
            key={verseBlockKey}
            verse={v}
            verseIndex={i}
            chapterData={chapterData}
            px={px}
            segmentMeta={segmentMeta}
            nextVerse={chapterData.verses[i + 1]}
            searchFocusVerse={searchFocusVerse}
            searchQuery={searchQuery}
            selectedVerses={selectedVerses}
            verseSelectionMode={verseSelectionMode}
            highlightedVerseIndexes={highlightedVerseIndexes}
            xrefVerseNumbers={xrefVerseNumbers}
            activeVerseIndex={activeVerseIndex}
            speechPartsByVerse={speechPartsByVerse}
            contrastByVerse={contrastByVerse}
            localeZhText={localeZhText}
            verseXrefA11yLabel={verseXrefA11yLabel}
            verseSelectionTapA11yHint={verseSelectionTapA11yHint}
            verseBookmarkA11yHint={verseBookmarkA11yHint}
            isBookmarked={isBookmarked}
            parentVersePressHandler={parentVersePressHandler}
            parentVerseLongPressHandler={parentVerseLongPressHandler}
            verseBodyPressProps={verseBodyPressProps}
            reportVerseLayoutFromEvent={reportVerseLayoutFromEvent}
            onXrefVersePress={onXrefVersePress}
          />
        );
      })}
    </>
  );
}
