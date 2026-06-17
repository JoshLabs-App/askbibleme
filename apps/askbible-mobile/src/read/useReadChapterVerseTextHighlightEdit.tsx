import type { TextStyle } from "react-native";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import { useReadChapterVerseTextHighlightUnits } from "./ReadChapterVerseTextHighlightUnits";
import { useReadChapterVerseTextHighlightDrag } from "./useReadChapterVerseTextHighlightDrag";
import { useReadChapterVerseTextHighlightTouch } from "./useReadChapterVerseTextHighlightTouch";

type Args = {
  text: string;
  parts: VerseSpeechPart[] | null;
  highlightedCharIndexes: Map<number, string> | null;
  highlightEditMode: boolean;
  preciseHighlightUnits: boolean;
  activeHighlightColor: string;
  baseStyle: TextStyle;
  verseLineHeight: number;
  layoutMeasureTick: number;
  onToggleHighlightUnit?: (start: number, end: number, color: string) => void;
  onReplaceHighlightSelection?: (next: Map<number, string>) => void;
  onPaintHighlightUnit?: (start: number, end: number, mode: "add" | "remove", color: string) => void;
  onHighlightUnitLayout?: (
    start: number,
    end: number,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  onHighlightTracePoint?: (x: number, y: number, begin: boolean) => void;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function useReadChapterVerseTextHighlightEdit({
  text,
  parts,
  highlightedCharIndexes,
  highlightEditMode,
  preciseHighlightUnits,
  activeHighlightColor,
  baseStyle,
  verseLineHeight,
  layoutMeasureTick,
  onToggleHighlightUnit,
  onReplaceHighlightSelection,
  onPaintHighlightUnit,
  onHighlightUnitLayout,
  onHighlightTracePoint,
  onPress,
  onLongPress,
}: Args) {
  const {
    rootTextRef,
    unitNodeRefs,
    unitLayoutsRef,
    rootWindowOriginRef,
    editableTokenUnits,
    hitTestUnitIndex,
    beginOrExtendDragSelection,
    endDragSelection,
    onRootTextLayout,
    onRootLayout,
  } = useReadChapterVerseTextHighlightDrag({
    text,
    parts,
    highlightedCharIndexes,
    highlightEditMode,
    activeHighlightColor,
    verseLineHeight,
    layoutMeasureTick,
    onToggleHighlightUnit,
    onReplaceHighlightSelection,
    onPaintHighlightUnit,
  });

  const { editableUnits, preciseHighlightBody } = useReadChapterVerseTextHighlightUnits({
    editableTokenUnits,
    highlightedCharIndexes,
    highlightEditMode,
    preciseHighlightUnits,
    activeHighlightColor,
    baseStyle,
    layoutMeasureTick,
    onToggleHighlightUnit,
    onHighlightUnitLayout,
    unitNodeRefs,
    unitLayoutsRef,
    rootWindowOriginRef,
  });

  const { verseBodyPressProps, deferredTouchProps, inlineTouchSpread } =
    useReadChapterVerseTextHighlightTouch({
      highlightEditMode,
      activeHighlightColor,
      editableTokenUnits,
      rootWindowOriginRef,
      onToggleHighlightUnit,
      onReplaceHighlightSelection,
      onPaintHighlightUnit,
      onHighlightTracePoint,
      onPress,
      onLongPress,
      hitTestUnitIndex,
      beginOrExtendDragSelection,
      endDragSelection,
    });

  return {
    rootTextRef,
    editableUnits,
    preciseHighlightBody,
    verseBodyPressProps,
    deferredTouchProps,
    inlineTouchSpread,
    onRootTextLayout,
    onRootLayout,
  };
}
