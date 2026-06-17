import { useMemo } from "react";
import { Text, type TextStyle } from "react-native";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import {
  type VerseTextHighlightKind,
  verseTextHighlightStyle,
} from "./goldenVerseMarkerStyle";
import { parchmentSans } from "../fonts/parchmentType";
import { readTypography } from "./readTypography";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR } from "./read-verse-text-highlights";
import { splitTextByScriptureSearchKeyword } from "../bible/scripture-search";
import { readChapterVerseTextStyles as styles } from "./readChapterVerseTextStyles";
import {
  buildHighlightedCharSpans,
  buildSpeechSegments,
} from "./readChapterVerseTextSpanBuilders";
import { useReadChapterVerseTextHighlightEdit } from "./useReadChapterVerseTextHighlightEdit";

type Props = {
  text: string;
  parts: VerseSpeechPart[] | null;
  highlightedCharIndexes?: Map<number, string> | null;
  highlightEditMode?: boolean;
  onToggleHighlightUnit?: (start: number, end: number, color: string) => void;
  onReplaceHighlightSelection?: (next: Map<number, string>) => void;
  onPaintHighlightUnit?: (start: number, end: number, mode: "add" | "remove", color: string) => void;
  onHighlightUnitLayout?: (
    start: number,
    end: number,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  layoutMeasureTick?: number;
  onHighlightTracePoint?: (x: number, y: number, begin: boolean) => void;
  inline?: boolean;
  isGolden?: boolean;
  highlight?: VerseTextHighlightKind;
  textHighlightColor?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  preciseHighlightUnits?: boolean;
  searchKeyword?: string | null;
};

export function ReadChapterVerseText({
  text,
  parts,
  highlightedCharIndexes = null,
  highlightEditMode = false,
  onToggleHighlightUnit,
  onReplaceHighlightSelection,
  onPaintHighlightUnit,
  onHighlightUnitLayout,
  layoutMeasureTick = 0,
  onHighlightTracePoint,
  inline = false,
  isGolden = false,
  highlight,
  textHighlightColor,
  onPress,
  onLongPress,
  preciseHighlightUnits = false,
  searchKeyword = null,
}: Props) {
  const { px } = useReadBibleTypography();
  const kind = highlight ?? (isGolden ? "golden" : undefined);
  const marker = kind ? verseTextHighlightStyle(kind) : undefined;
  const activeHighlightColor = textHighlightColor ?? DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR;

  const baseStyle = useMemo(
    (): TextStyle => ({
      ...parchmentSans(500),
      fontSize: px.verseFontSize,
      lineHeight: px.verseLineHeight,
      color: readTypography.verseColor,
    }),
    [px.verseFontSize, px.verseLineHeight],
  );

  const segments = useMemo(() => buildSpeechSegments(parts), [parts]);

  const highlightedChars = useMemo(() => {
    if (!highlightedCharIndexes?.size) return null;
    return buildHighlightedCharSpans({
      text,
      parts,
      highlightedCharIndexes,
      activeHighlightColor,
    });
  }, [activeHighlightColor, highlightedCharIndexes, parts, text]);

  const {
    rootTextRef,
    editableUnits,
    preciseHighlightBody,
    deferredTouchProps,
    inlineTouchSpread,
    onRootTextLayout,
    onRootLayout,
  } = useReadChapterVerseTextHighlightEdit({
    text,
    parts,
    highlightedCharIndexes,
    highlightEditMode,
    preciseHighlightUnits,
    activeHighlightColor,
    baseStyle,
    verseLineHeight: px.verseLineHeight,
    layoutMeasureTick,
    onToggleHighlightUnit,
    onReplaceHighlightSelection,
    onPaintHighlightUnit,
    onHighlightUnitLayout,
    onHighlightTracePoint,
    onPress,
    onLongPress,
  });

  const searchKeywordBody = useMemo(() => {
    if (!searchKeyword) return null;
    return splitTextByScriptureSearchKeyword(text, searchKeyword).map((seg, i) =>
      seg.match ? (
        <Text key={`sk:${i}`} style={styles.searchKeyword}>
          {seg.text}
        </Text>
      ) : (
        seg.text
      ),
    );
  }, [searchKeyword, text]);

  if (inline) {
    if (preciseHighlightBody) {
      return preciseHighlightBody;
    }
    if (searchKeywordBody) {
      return (
        <Text style={baseStyle} {...inlineTouchSpread}>
          {searchKeywordBody}
        </Text>
      );
    }
    if (editableUnits) {
      return (
        <Text
          ref={rootTextRef}
          collapsable={false}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            onRootLayout(width, height);
          }}
          onTextLayout={onRootTextLayout}
          {...(deferredTouchProps as any)}
        >
          {editableUnits}
        </Text>
      );
    }
    if (highlightedChars) {
      return (
        <Text style={baseStyle} {...inlineTouchSpread}>
          {highlightedChars}
        </Text>
      );
    }
    if (!parts?.length) {
      return marker ? (
        <Text style={marker} {...inlineTouchSpread}>
          {text}
        </Text>
      ) : (
        <Text {...inlineTouchSpread}>{text}</Text>
      );
    }
    if (marker) {
      return (
        <Text style={marker} {...inlineTouchSpread}>
          {segments}
        </Text>
      );
    }
    return <Text {...inlineTouchSpread}>{segments}</Text>;
  }

  if (preciseHighlightBody) {
    return preciseHighlightBody;
  }

  if (searchKeywordBody) {
    return <Text style={baseStyle}>{searchKeywordBody}</Text>;
  }

  if (editableUnits) {
    return (
      <Text
        ref={rootTextRef}
        collapsable={false}
        style={baseStyle}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          onRootLayout(width, height);
        }}
        onTextLayout={onRootTextLayout}
        {...(deferredTouchProps as any)}
      >
        {editableUnits}
      </Text>
    );
  }

  if (highlightedChars) {
    return <Text style={baseStyle}>{highlightedChars}</Text>;
  }

  if (!parts?.length) {
    return <Text style={[baseStyle, marker]}>{text}</Text>;
  }

  return <Text style={[baseStyle, marker]}>{segments}</Text>;
}
