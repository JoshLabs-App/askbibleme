import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Text,
  type LayoutRectangle,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
  type TextStyle,
} from "react-native";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import {
  tokenizeHighlightUnits,
  unitFullySelected,
} from "./readChapterVerseTextHelpers";
import {
  buildSpeechKindsByCharIndex,
  speechSegmentStyle,
} from "./readChapterVerseTextSpanBuilders";

export type EditableTokenUnit = {
  idx: number;
  unit: ReturnType<typeof tokenizeHighlightUnits>[number];
  kindStyle: TextStyle | undefined;
};

export type ReadChapterVerseTextHighlightDragArgs = {
  text: string;
  parts: VerseSpeechPart[] | null;
  highlightedCharIndexes: Map<number, string> | null;
  highlightEditMode: boolean;
  activeHighlightColor: string;
  verseLineHeight: number;
  layoutMeasureTick: number;
  onToggleHighlightUnit?: (start: number, end: number, color: string) => void;
  onReplaceHighlightSelection?: (next: Map<number, string>) => void;
  onPaintHighlightUnit?: (start: number, end: number, mode: "add" | "remove", color: string) => void;
};

export function useReadChapterVerseTextHighlightDrag({
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
}: ReadChapterVerseTextHighlightDragArgs) {
  const unitLayoutsRef = useRef<Map<number, LayoutRectangle>>(new Map());
  const unitNodeRefs = useRef<Map<number, Text | null>>(new Map());
  const rootTextRef = useRef<Text | null>(null);
  const rootWindowOriginRef = useRef<{ x: number; y: number } | null>(null);
  const rootLayoutRef = useRef<{ width: number; height: number } | null>(null);
  const lineRangesRef = useRef<Array<{ start: number; end: number }>>([]);
  const dragStateRef = useRef<{
    active: boolean;
    mode: "add" | "remove";
    lastUnit: number;
    selected: Map<number, string>;
    seen?: Set<number>;
  } | null>(null);

  const editableTokenUnits = useMemo((): EditableTokenUnit[] | null => {
    if (!highlightEditMode || (!onToggleHighlightUnit && !onReplaceHighlightSelection)) return null;
    const kinds = buildSpeechKindsByCharIndex(text, parts);
    return tokenizeHighlightUnits(text).map((unit, idx) => ({
      idx,
      unit,
      kindStyle: kinds[unit.start] ? speechSegmentStyle(kinds[unit.start]!) : undefined,
    }));
  }, [highlightEditMode, onReplaceHighlightSelection, onToggleHighlightUnit, parts, text]);

  const applyUnitToSelection = useCallback(
    (base: Map<number, string>, unitIndex: number, mode: "add" | "remove", color: string) => {
      const unitWrap = editableTokenUnits?.[unitIndex];
      if (!unitWrap?.unit.selectable) return base;
      const next = new Map(base);
      for (let i = unitWrap.unit.start; i < unitWrap.unit.end; i += 1) {
        if (mode === "add") next.set(i, color);
        else next.delete(i);
      }
      return next;
    },
    [editableTokenUnits],
  );

  const fallbackUnitIndexByPoint = useCallback(
    (x: number, y: number): number => {
      const units = editableTokenUnits ?? [];
      if (!units.length) return -1;
      const rootLayout = rootLayoutRef.current;
      const ranges = lineRangesRef.current;
      if (!rootLayout || rootLayout.width <= 0) return -1;
      const lineHeight = Math.max(1, verseLineHeight);
      const ratio = Math.min(1, Math.max(0, x / rootLayout.width));
      let charIndex = -1;
      if (ranges.length > 0) {
        const lineIndex = Math.min(ranges.length - 1, Math.max(0, Math.floor(y / lineHeight)));
        const line = ranges[lineIndex];
        if (line) {
          const lineLen = Math.max(1, line.end - line.start);
          charIndex = Math.min(text.length - 1, line.start + Math.floor(ratio * lineLen));
        }
      }
      if (charIndex < 0) {
        const estimatedLineCount = Math.max(1, Math.round((rootLayout.height || lineHeight) / lineHeight));
        const estimatedCharsPerLine = Math.max(1, Math.ceil(text.length / estimatedLineCount));
        const estLine = Math.max(0, Math.floor(y / lineHeight));
        charIndex = Math.min(
          text.length - 1,
          estLine * estimatedCharsPerLine + Math.floor(ratio * estimatedCharsPerLine),
        );
      }
      for (const { idx, unit } of units) {
        if (charIndex >= unit.start && charIndex < unit.end) return idx;
      }
      return -1;
    },
    [editableTokenUnits, verseLineHeight, text.length],
  );

  const hitTestUnitIndex = useCallback(
    (x: number, y: number): number => {
      for (const [idx, rect] of unitLayoutsRef.current.entries()) {
        if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
          return idx;
        }
      }
      return fallbackUnitIndexByPoint(x, y);
    },
    [fallbackUnitIndexByPoint],
  );

  const beginOrExtendDragSelection = useCallback(
    (x: number, y: number, begin: boolean) => {
      if (!highlightEditMode || !editableTokenUnits?.length) return;
      const unitIndex = hitTestUnitIndex(x, y);
      if (unitIndex < 0) return;
      const touched = editableTokenUnits[unitIndex]?.unit;
      if (!touched?.selectable) return;

      if (onPaintHighlightUnit) {
        if (begin || !dragStateRef.current) {
          const mode: "add" | "remove" = unitFullySelected(touched, highlightedCharIndexes)
            ? "remove"
            : "add";
          const seen = new Set<number>([unitIndex]);
          dragStateRef.current = {
            active: true,
            mode,
            lastUnit: unitIndex,
            selected: new Map<number, string>(),
            seen,
          };
          onPaintHighlightUnit(touched.start, touched.end, mode, activeHighlightColor);
          return;
        }

        const state = dragStateRef.current;
        if (!state.active || state.lastUnit === unitIndex) return;
        const step = unitIndex > state.lastUnit ? 1 : -1;
        let cursor = state.lastUnit + step;
        while ((step > 0 && cursor <= unitIndex) || (step < 0 && cursor >= unitIndex)) {
          if (!state.seen?.has(cursor)) {
            const wrap = editableTokenUnits[cursor];
            if (wrap?.unit.selectable) {
              onPaintHighlightUnit(wrap.unit.start, wrap.unit.end, state.mode, activeHighlightColor);
              state.seen?.add(cursor);
            }
          }
          cursor += step;
        }
        state.lastUnit = unitIndex;
        return;
      }

      if (!onReplaceHighlightSelection) return;

      if (begin || !dragStateRef.current) {
        const selectedNow = highlightedCharIndexes ?? new Map<number, string>();
        const mode: "add" | "remove" = unitFullySelected(touched, selectedNow) ? "remove" : "add";
        const next = applyUnitToSelection(selectedNow, unitIndex, mode, activeHighlightColor);
        dragStateRef.current = { active: true, mode, lastUnit: unitIndex, selected: next };
        onReplaceHighlightSelection(next);
        return;
      }

      const state = dragStateRef.current;
      if (!state.active || state.lastUnit === unitIndex) return;
      const step = unitIndex > state.lastUnit ? 1 : -1;
      let cursor = state.lastUnit + step;
      let next = new Map(state.selected);
      while ((step > 0 && cursor <= unitIndex) || (step < 0 && cursor >= unitIndex)) {
        next = applyUnitToSelection(next, cursor, state.mode, activeHighlightColor);
        cursor += step;
      }
      state.lastUnit = unitIndex;
      state.selected = next;
      onReplaceHighlightSelection(next);
    },
    [
      applyUnitToSelection,
      editableTokenUnits,
      highlightEditMode,
      highlightedCharIndexes,
      hitTestUnitIndex,
      onPaintHighlightUnit,
      onReplaceHighlightSelection,
      activeHighlightColor,
    ],
  );

  const endDragSelection = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const updateRootWindowOrigin = useCallback(() => {
    const root = rootTextRef.current;
    if (!root || typeof root.measureInWindow !== "function") return;
    root.measureInWindow((x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      rootWindowOriginRef.current = { x, y };
    });
  }, []);

  const onRootTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const lines = event.nativeEvent.lines ?? [];
      if (!lines.length) {
        lineRangesRef.current = [];
        return;
      }
      const ranges: Array<{ start: number; end: number }> = [];
      let cursor = 0;
      for (const line of lines) {
        const lineText = line.text ?? "";
        if (!lineText.length) {
          ranges.push({ start: cursor, end: cursor });
          continue;
        }
        const idx = text.indexOf(lineText, cursor);
        if (idx >= 0) {
          ranges.push({ start: idx, end: idx + lineText.length });
          cursor = idx + lineText.length;
        } else {
          const fallbackStart = cursor;
          const fallbackEnd = Math.min(text.length, fallbackStart + lineText.length);
          ranges.push({ start: fallbackStart, end: fallbackEnd });
          cursor = fallbackEnd;
        }
      }
      lineRangesRef.current = ranges;
    },
    [text],
  );

  useEffect(() => {
    if (!highlightEditMode) return;
    updateRootWindowOrigin();
    const timer = setTimeout(updateRootWindowOrigin, 120);
    return () => clearTimeout(timer);
  }, [highlightEditMode, layoutMeasureTick, updateRootWindowOrigin]);

  const onRootLayout = useCallback(
    (width: number, height: number) => {
      updateRootWindowOrigin();
      if (width > 0 && height > 0) rootLayoutRef.current = { width, height };
    },
    [updateRootWindowOrigin],
  );

  return {
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
  };
}
