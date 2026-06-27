import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { Platform, type GestureResponderEvent } from "react-native";
import type { EditableTokenUnit } from "./useReadChapterVerseTextHighlightDrag";

const USE_DEFERRED_VERSE_TOUCH = Platform.OS === "android";
const VERSE_TOUCH_SLOP_PX = 10;
const VERSE_LONG_PRESS_MS = 280;

export type ReadChapterVerseTextHighlightTouchArgs = {
  highlightEditMode: boolean;
  activeHighlightColor: string;
  editableTokenUnits: EditableTokenUnit[] | null;
  rootWindowOriginRef: RefObject<{ x: number; y: number } | null>;
  onToggleHighlightUnit?: (start: number, end: number, color: string) => void;
  onReplaceHighlightSelection?: (next: Map<number, string>) => void;
  onPaintHighlightUnit?: (start: number, end: number, mode: "add" | "remove", color: string) => void;
  onHighlightTracePoint?: (x: number, y: number, begin: boolean) => void;
  onPress?: () => void;
  onLongPress?: () => void;
  hitTestUnitIndex: (x: number, y: number) => number;
  beginOrExtendDragSelection: (x: number, y: number, begin: boolean) => void;
  endDragSelection: () => void;
};

export function useReadChapterVerseTextHighlightTouch({
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
}: ReadChapterVerseTextHighlightTouchArgs) {
  const touchGestureRef = useRef<{
    startLocalX: number;
    startLocalY: number;
    dragged: boolean;
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const resolveLocalPoint = useCallback(
    (e: GestureResponderEvent) => {
      const rootOrigin = rootWindowOriginRef.current;
      const pageX = e.nativeEvent.pageX;
      const pageY = e.nativeEvent.pageY;
      if (
        rootOrigin &&
        Number.isFinite(pageX) &&
        Number.isFinite(pageY) &&
        Number.isFinite(rootOrigin.x) &&
        Number.isFinite(rootOrigin.y)
      ) {
        return { localX: pageX - rootOrigin.x, localY: pageY - rootOrigin.y, pageX, pageY };
      }
      return {
        localX: e.nativeEvent.locationX,
        localY: e.nativeEvent.locationY,
        pageX: Number.isFinite(pageX) ? pageX : e.nativeEvent.locationX,
        pageY: Number.isFinite(pageY) ? pageY : e.nativeEvent.locationY,
      };
    },
    [rootWindowOriginRef],
  );

  const handleTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      const pt = resolveLocalPoint(e);
      touchGestureRef.current = {
        startLocalX: pt.localX,
        startLocalY: pt.localY,
        dragged: false,
      };
      longPressTriggeredRef.current = false;
      clearLongPressTimer();
      if (highlightEditMode) {
        if (!USE_DEFERRED_VERSE_TOUCH) {
          beginOrExtendDragSelection(pt.localX, pt.localY, true);
        }
      } else if (USE_DEFERRED_VERSE_TOUCH && onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          longPressTriggeredRef.current = true;
          onLongPress();
        }, VERSE_LONG_PRESS_MS);
      }
      if (onHighlightTracePoint) {
        onHighlightTracePoint(pt.pageX, pt.pageY, true);
      }
    },
    [
      beginOrExtendDragSelection,
      clearLongPressTimer,
      highlightEditMode,
      onHighlightTracePoint,
      onLongPress,
      resolveLocalPoint,
    ],
  );

  const handleTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      const pt = resolveLocalPoint(e);
      const touch = touchGestureRef.current;
      if (touch && !touch.dragged) {
        const dx = pt.localX - touch.startLocalX;
        const dy = pt.localY - touch.startLocalY;
        if (dx * dx + dy * dy >= VERSE_TOUCH_SLOP_PX * VERSE_TOUCH_SLOP_PX) {
          touch.dragged = true;
          clearLongPressTimer();
          if (highlightEditMode && USE_DEFERRED_VERSE_TOUCH) {
            beginOrExtendDragSelection(pt.localX, pt.localY, true);
          }
        }
      }
      if (highlightEditMode && (!USE_DEFERRED_VERSE_TOUCH || touch?.dragged)) {
        beginOrExtendDragSelection(pt.localX, pt.localY, false);
      }
      if (onHighlightTracePoint) {
        onHighlightTracePoint(pt.pageX, pt.pageY, false);
      }
    },
    [beginOrExtendDragSelection, clearLongPressTimer, highlightEditMode, onHighlightTracePoint, resolveLocalPoint],
  );

  const handleTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      clearLongPressTimer();
      const pt = resolveLocalPoint(e);
      const touch = touchGestureRef.current;
      if (highlightEditMode) {
        if (USE_DEFERRED_VERSE_TOUCH && onToggleHighlightUnit && touch && !touch.dragged) {
          const unitIndex = hitTestUnitIndex(pt.localX, pt.localY);
          const unitWrap = editableTokenUnits?.[unitIndex];
          if (unitWrap?.unit.selectable) {
            onToggleHighlightUnit(unitWrap.unit.start, unitWrap.unit.end, activeHighlightColor);
          }
        }
      } else if (
        USE_DEFERRED_VERSE_TOUCH &&
        onPress &&
        touch &&
        !touch.dragged &&
        !longPressTriggeredRef.current
      ) {
        const unitIndex = hitTestUnitIndex(pt.localX, pt.localY);
        if (unitIndex >= 0) {
          onPress();
        }
      }
      touchGestureRef.current = null;
      longPressTriggeredRef.current = false;
      endDragSelection();
    },
    [
      activeHighlightColor,
      clearLongPressTimer,
      editableTokenUnits,
      endDragSelection,
      highlightEditMode,
      hitTestUnitIndex,
      onPress,
      onToggleHighlightUnit,
      resolveLocalPoint,
    ],
  );

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  const highlightTouchEnabled =
    highlightEditMode &&
    (onToggleHighlightUnit || onReplaceHighlightSelection || onPaintHighlightUnit);

  const androidVersePressEnabled =
    USE_DEFERRED_VERSE_TOUCH && !highlightEditMode && Boolean(onPress || onLongPress);

  const verseBodyPressProps = useMemo(
    () =>
      highlightEditMode || !onPress || androidVersePressEnabled
        ? null
        : ({
            onPress,
            onLongPress,
            suppressHighlighting: true,
          } as const),
    [androidVersePressEnabled, highlightEditMode, onLongPress, onPress],
  );

  const deferredTouchProps = useMemo(
    () =>
      highlightTouchEnabled || androidVersePressEnabled
        ? ({
            onStartShouldSetResponder: () => true,
            onMoveShouldSetResponder: () => true,
            onResponderGrant: handleTouchStart,
            onResponderMove: handleTouchMove,
            onResponderRelease: handleTouchEnd,
            onResponderTerminate: handleTouchEnd,
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd,
          } as const)
        : null,
    [
      androidVersePressEnabled,
      handleTouchEnd,
      handleTouchMove,
      handleTouchStart,
      highlightTouchEnabled,
    ],
  );

  const inlineTouchSpread = useMemo(
    () => ({
      ...(verseBodyPressProps as object),
      ...(deferredTouchProps as object),
    }),
    [deferredTouchProps, verseBodyPressProps],
  );

  return {
    verseBodyPressProps,
    deferredTouchProps,
    inlineTouchSpread,
  };
}
