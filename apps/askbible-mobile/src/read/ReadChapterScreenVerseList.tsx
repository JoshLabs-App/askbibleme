import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Platform,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from "react-native";
import type { LoadedChapter } from "../bible/types";
import { ReadChapterVerseText } from "./ReadChapterVerseText";
import { ReadChapterScreenVerseRow } from "./ReadChapterScreenVerseRow";
import type { ReadBibleTypographyPx } from "./read-bible-typography-prefs";
import { READ_VERSE_NUM_BODY_GAP, type ChapterHighlightMap, type ContrastVerseLine } from "./readChapterScreenConstants";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import {
  paragraphVerseCharRanges,
  verseBoxesFromParagraphTextLayout,
  verseRelativeInParagraphGroup,
} from "./read-chapter-verse-layout";
import {
  computeReadChapterWindowRange,
  estimateReadChapterVerseHeight,
  type ReadChapterWindowRange,
} from "./readChapterVerseWindow";
import {
  getReadChapterScrollWindowSnapshot,
  subscribeReadChapterScrollWindow,
} from "./readChapterScrollWindowStore";

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
  registerVerseHost: (verse: number, node: unknown) => void;
  registerParagraphHost: (verses: number[], node: unknown) => void;
  reportParagraphVerseBoxes: (
    boxes: Map<number, { y: number; height: number }>,
    fractions?: Iterable<{ verse: number; start: number; end: number; total: number }>,
  ) => void;
  reportParagraphFrame: (verses: number[], layout: { y: number; height: number }) => void;
  onXrefVersePress: (verse: number) => void;
};

type VerseBox = { y: number; height: number };

function audioFollowBox(
  verseNum: number,
  verses: number[],
  paragraphHeight: number,
  measured: VerseBox | undefined,
): VerseBox | null {
  const usable =
    measured &&
    measured.height > 8 &&
    (verses.length <= 1 || measured.height <= Math.max(paragraphHeight, measured.height) * 0.72);
  return verseRelativeInParagraphGroup(
    verseNum,
    verses,
    paragraphHeight,
    usable ? measured : null,
  );
}

function ParagraphVerseFlowBlock({
  group,
  chapterData,
  px,
  searchFocusVerse,
  searchQuery,
  selectedVerses,
  highlightedVerseIndexes,
  xrefVerseNumbers,
  activeVerseIndex,
  verseIndexByVerse,
  speechPartsByVerse,
  localeZhText,
  verseXrefA11yLabel,
  isBookmarked,
  parentVersePressHandler,
  parentVerseLongPressHandler,
  verseBodyPressProps,
  reportVerseLayoutFromEvent,
  registerVerseHost,
  registerParagraphHost,
  reportParagraphVerseBoxes,
  reportParagraphFrame,
  onXrefVersePress,
}: Props & { group: { verses: VerseRow[] } }) {
  const [verseBoxes, setVerseBoxes] = useState<Map<number, VerseBox>>(() => new Map());
  const [paragraphHeight, setParagraphHeight] = useState(0);
  const verseNums = group.verses.map((v) => v.verse);
  const audioVerseNum =
    group.verses.find((v) => {
      const verseIndex = verseIndexByVerse.get(v.verse) ?? -1;
      const searchFocus = searchFocusVerse === v.verse;
      const bookmarked = isBookmarked({
        translationId: chapterData.translationId,
        bookId: chapterData.bookId,
        chapter: chapterData.chapter,
        verse: v.verse,
      });
      return !searchFocus && !bookmarked && verseIndex >= 0 && activeVerseIndex === verseIndex;
    })?.verse ?? null;
  const iosAudioBox =
    Platform.OS === "ios" && audioVerseNum != null
      ? audioFollowBox(audioVerseNum, verseNums, paragraphHeight, verseBoxes.get(audioVerseNum))
      : null;

  return (
    <View
      style={styles.verseParagraphBlock}
      collapsable={false}
      ref={(node) => registerParagraphHost(verseNums, node)}
      onLayout={(e) => {
        const verses = group.verses.map((v) => ({
          verse: v.verse,
          text: localeZhText(v.text),
        }));
        const { fullText, ranges } = paragraphVerseCharRanges(verses, READ_VERSE_NUM_BODY_GAP);
        const height = e.nativeEvent.layout.height;
        setParagraphHeight(height);
        reportParagraphFrame(verseNums, {
          y: e.nativeEvent.layout.y,
          height,
        });
        reportParagraphVerseBoxes(
          new Map(),
          ranges.map((range) => ({
            verse: range.verse,
            start: range.start,
            end: range.end,
            total: fullText.length,
          })),
        );
      }}
    >
      {iosAudioBox ? (
        <View pointerEvents="none" style={[styles.verseAudioFollowOverlay, iosAudioBox]} />
      ) : null}
      <View collapsable={false}>
      <Text
        onTextLayout={(event: NativeSyntheticEvent<TextLayoutEventData>) => {
          const { fullText, ranges } = paragraphVerseCharRanges(
            group.verses.map((v) => ({ verse: v.verse, text: localeZhText(v.text) })),
            READ_VERSE_NUM_BODY_GAP,
          );
          const boxes = verseBoxesFromParagraphTextLayout(
            ranges,
            event.nativeEvent.lines ?? [],
            fullText,
          );
          setVerseBoxes(boxes);
          reportParagraphVerseBoxes(
            boxes,
            ranges.map((range) => ({
              verse: range.verse,
              start: range.start,
              end: range.end,
              total: fullText.length,
            })),
          );
        }}
        style={[
          styles.versePrimaryLine,
          {
            fontSize: px.verseFontSize,
            lineHeight: px.verseLineHeight,
            backgroundColor: "transparent",
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
          const verseAudioChunkKey = `pv:${v.verse}`;
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
              : audioActive && Platform.OS !== "ios"
                ? styles.verseInlineChunkAudioActive
                : styles.verseInlineChunkAudioIdle;
          const hasXref = Boolean(xrefVerseNumbers?.has(v.verse));
          return (
            <Text
              key={verseAudioChunkKey}
              ref={(node) => registerVerseHost(v.verse, node)}
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
    </View>
  );
}

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
  registerVerseHost,
  registerParagraphHost,
  reportParagraphVerseBoxes,
  reportParagraphFrame,
  onXrefVersePress,
}: Props) {
  const chapterKey = `${chapterData.bookId}:${chapterData.chapter}:${chapterData.translationId}`;
  const itemCount = useParagraphFlowLayout
    ? paragraphGroups.length
    : chapterData.verses.length;
  /** 搜索定位需要量布局：暂时挂满，避免窗口外节量不到。 */
  const windowDisabled = searchFocusVerse != null || itemCount <= 18;

  const estimateAt = useMemo(() => {
    return (index: number): number => {
      if (useParagraphFlowLayout) {
        const group = paragraphGroups[index];
        if (!group) return 80;
        const first = group.verses[0];
        const headings = first ? (segmentMeta.headingByVerse.get(first.verse)?.length ?? 0) : 0;
        const textLen = group.verses.reduce(
          (sum, v) => sum + localeZhText(v.text).length + 4,
          0,
        );
        return estimateReadChapterVerseHeight({
          textLen,
          fontSize: px.verseFontSize,
          lineHeight: px.verseLineHeight,
          headingCount: headings,
          hasParagraphBreak: index > 0,
        });
      }
      const v = chapterData.verses[index];
      if (!v) return 72;
      const headings = segmentMeta.headingByVerse.get(v.verse)?.length ?? 0;
      return estimateReadChapterVerseHeight({
        textLen: localeZhText(v.text).length,
        fontSize: px.verseFontSize,
        lineHeight: px.verseLineHeight,
        headingCount: headings,
        hasParagraphBreak: index > 0 && segmentMeta.paragraphStarts.has(v.verse),
      });
    };
  }, [
    chapterData.verses,
    localeZhText,
    paragraphGroups,
    px.verseFontSize,
    px.verseLineHeight,
    segmentMeta.headingByVerse,
    segmentMeta.paragraphStarts,
    useParagraphFlowLayout,
  ]);

  const estimateAtRef = useRef(estimateAt);
  estimateAtRef.current = estimateAt;
  const measuredHeightsRef = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    measuredHeightsRef.current = new Map();
  }, [chapterKey, useParagraphFlowLayout]);

  const scrollSnap = useSyncExternalStore(
    subscribeReadChapterScrollWindow,
    getReadChapterScrollWindowSnapshot,
    getReadChapterScrollWindowSnapshot,
  );

  const [range, setRange] = useState<ReadChapterWindowRange>(() =>
    computeReadChapterWindowRange({
      itemCount,
      heightAt: estimateAt,
      scrollY: 0,
      viewportH: 640,
    }),
  );
  const [heightEpoch, setHeightEpoch] = useState(0);

  useEffect(() => {
    if (windowDisabled) {
      setRange({
        start: 0,
        end: itemCount - 1,
        topSpacer: 0,
        bottomSpacer: 0,
      });
      return;
    }
    const next = computeReadChapterWindowRange({
      itemCount,
      heightAt: (index) =>
        measuredHeightsRef.current.get(index) ?? estimateAtRef.current(index),
      scrollY: scrollSnap.scrollY,
      viewportH: scrollSnap.viewportH || 640,
    });
    setRange((prev) =>
      prev.start === next.start &&
      prev.end === next.end &&
      prev.topSpacer === next.topSpacer &&
      prev.bottomSpacer === next.bottomSpacer
        ? prev
        : next,
    );
  }, [
    itemCount,
    scrollSnap.scrollY,
    scrollSnap.viewportH,
    windowDisabled,
    chapterKey,
    heightEpoch,
  ]);

  const noteItemLayout = (index: number, height: number) => {
    if (!(height > 0)) return;
    const prev = measuredHeightsRef.current.get(index);
    const next = Math.round(height);
    if (prev != null && Math.abs(prev - next) < 2) return;
    measuredHeightsRef.current.set(index, next);
    if (prev == null || Math.abs(prev - next) >= 24) {
      setHeightEpoch((n) => n + 1);
    }
  };

  const listProps = {
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
    registerVerseHost,
    registerParagraphHost,
    reportParagraphVerseBoxes,
    reportParagraphFrame,
    onXrefVersePress,
  } satisfies Props;

  const start = windowDisabled ? 0 : Math.max(0, range.start);
  const end = windowDisabled ? itemCount - 1 : Math.min(itemCount - 1, range.end);

  if (useParagraphFlowLayout) {
    const nodes: ReactNode[] = [];
    if (!windowDisabled && range.topSpacer > 0) {
      nodes.push(<View key="win-top" style={{ height: range.topSpacer }} />);
    }
    for (let groupIndex = start; groupIndex <= end; groupIndex += 1) {
      const group = paragraphGroups[groupIndex];
      const firstVerse = group?.verses[0];
      if (!group || !firstVerse) continue;
      const headings = segmentMeta.headingByVerse.get(firstVerse.verse) ?? [];
      const showParagraphBreak = groupIndex > 0;
      const showParagraphRule = showParagraphBreak && headings.length > 0;
      nodes.push(
        <Fragment key={`pg:${firstVerse.verse}`}>
          <View
            onLayout={(e) => noteItemLayout(groupIndex, e.nativeEvent.layout.height)}
            collapsable={false}
          >
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
            <ParagraphVerseFlowBlock group={group} {...listProps} />
          </View>
        </Fragment>,
      );
    }
    if (!windowDisabled && range.bottomSpacer > 0) {
      nodes.push(<View key="win-bot" style={{ height: range.bottomSpacer }} />);
    }
    return <View collapsable={false}>{nodes}</View>;
  }

  const verseNodes: ReactNode[] = [];
  if (!windowDisabled && range.topSpacer > 0) {
    verseNodes.push(<View key="win-top" style={{ height: range.topSpacer }} />);
  }
  for (let i = start; i <= end; i += 1) {
    const v = chapterData.verses[i];
    if (!v) continue;
    const searchFocus = searchFocusVerse === v.verse;
    const bookmarked = isBookmarked({
      translationId: chapterData.translationId,
      bookId: chapterData.bookId,
      chapter: chapterData.chapter,
      verse: v.verse,
    });
    const audioActive = !searchFocus && !bookmarked && activeVerseIndex === i;
    const selected = selectedVerses.includes(v.verse);
    const verseBlockKey = `${v.verse}`;
    verseNodes.push(
      <View
        key={verseBlockKey}
        onLayout={(e) => noteItemLayout(i, e.nativeEvent.layout.height)}
        collapsable={false}
      >
        <ReadChapterScreenVerseRow
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
          registerVerseHost={registerVerseHost}
          onXrefVersePress={onXrefVersePress}
        />
      </View>,
    );
  }
  if (!windowDisabled && range.bottomSpacer > 0) {
    verseNodes.push(<View key="win-bot" style={{ height: range.bottomSpacer }} />);
  }
  return <>{verseNodes}</>;
}
