import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  type NativeSyntheticEvent,
  Platform,
  Text,
  type TextLayoutEventData,
  type GestureResponderEvent,
  type LayoutRectangle,
  type TextStyle,
} from "react-native";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import {
  type VerseTextHighlightKind,
  verseTextHighlightStyle,
} from "./goldenVerseMarkerStyle";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readTypography } from "./readTypography";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR } from "./read-verse-text-highlights";

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
  /** 嵌在父级 `Text` 内与节号同一行流动排版 */
  inline?: boolean;
  /** @deprecated 用 highlight */
  isGolden?: boolean;
  highlight?: VerseTextHighlightKind;
  textHighlightColor?: string;
  /** Android 嵌套 Text 有字下色带时会吞掉父级 onPress；收藏双击改由此传入 */
  onPress?: () => void;
  onLongPress?: () => void;
};

function speechSegmentStyle(kind: VerseSpeechPart["kind"]) {
  if (kind === "divine") return styles.divine;
  if (kind === "human") return styles.human;
  return undefined;
}

function isHanChar(char: string): boolean {
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(char);
}

function isLatinWordChar(char: string): boolean {
  return /[A-Za-z0-9]/.test(char);
}

function isLatinWordConnector(char: string): boolean {
  return char === "'" || char === "-";
}

type HighlightUnit = {
  text: string;
  start: number;
  end: number;
  selectable: boolean;
};

function tokenizeHighlightUnits(text: string): HighlightUnit[] {
  const chars = text.split("");
  const units: HighlightUnit[] = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (/\s/.test(ch)) {
      const start = i;
      i += 1;
      while (i < chars.length && /\s/.test(chars[i]!)) i += 1;
      units.push({ text: chars.slice(start, i).join(""), start, end: i, selectable: false });
      continue;
    }
    if (isHanChar(ch)) {
      units.push({ text: ch, start: i, end: i + 1, selectable: true });
      i += 1;
      continue;
    }
    if (isLatinWordChar(ch)) {
      const start = i;
      i += 1;
      while (i < chars.length) {
        const next = chars[i]!;
        if (isLatinWordChar(next)) {
          i += 1;
          continue;
        }
        if (
          isLatinWordConnector(next) &&
          i + 1 < chars.length &&
          isLatinWordChar(chars[i + 1]!)
        ) {
          i += 1;
          continue;
        }
        break;
      }
      units.push({ text: chars.slice(start, i).join(""), start, end: i, selectable: true });
      continue;
    }
    // 标点等符号允许单独选中，避免短语高亮在标点处断开。
    units.push({ text: ch, start: i, end: i + 1, selectable: true });
    i += 1;
  }
  return units;
}

/** Android 嵌套 Text 的 onPress 常失效；轻点改由 responder 在抬手时处理。 */
const USE_DEFERRED_HIGHLIGHT_TOUCH = Platform.OS === "android";
const HIGHLIGHT_TAP_SLOP_PX = 10;

function unitFullySelected(
  unit: HighlightUnit,
  selected: Map<number, string> | null | undefined,
): boolean {
  if (!unit.selectable || !selected?.size) return false;
  for (let i = unit.start; i < unit.end; i += 1) {
    if (!selected.has(i)) return false;
  }
  return true;
}

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

  const segments = useMemo(
    () =>
      parts?.map((seg, i) => (
        <Text key={i} style={speechSegmentStyle(seg.kind)}>
          {seg.text}
        </Text>
      )),
    [parts],
  );

  const highlightedChars = useMemo(() => {
    if (!highlightedCharIndexes?.size) return null;
    const chars = text.split("");
    if (!chars.length) return null;
    const kinds = new Array<VerseSpeechPart["kind"] | null>(chars.length).fill(null);
    if (parts?.length) {
      let cursor = 0;
      for (const seg of parts) {
        const segChars = seg.text.split("");
        for (let i = 0; i < segChars.length && cursor + i < kinds.length; i += 1) {
          kinds[cursor + i] = seg.kind;
        }
        cursor += segChars.length;
        if (cursor >= kinds.length) break;
      }
    }

    const spans: ReactNode[] = [];
    let runStart = 0;
    let runColor = highlightedCharIndexes.get(0) ?? null;
    let runMarked = Boolean(runColor);
    let runKind = kinds[0];

    for (let i = 1; i <= chars.length; i += 1) {
      const nextColor = i < chars.length ? (highlightedCharIndexes.get(i) ?? null) : null;
      const nextMarked = Boolean(nextColor);
      const nextKind = i < chars.length ? kinds[i] : null;
      const sameRun =
        i < chars.length &&
        nextMarked === runMarked &&
        nextKind === runKind &&
        nextColor === runColor;
      if (sameRun) continue;

      const chunk = chars.slice(runStart, i).join("");
      const kindStyle = runKind ? speechSegmentStyle(runKind) : undefined;
      spans.push(
        <Text
          key={`h:${runStart}-${i}:${runMarked ? "m" : "n"}:${runKind ?? "none"}`}
          style={[
            kindStyle,
            runMarked && styles.savedHighlight,
            runMarked && { backgroundColor: runColor ?? activeHighlightColor },
          ]}
        >
          {chunk}
        </Text>,
      );

      runStart = i;
      runMarked = Boolean(nextMarked);
      runColor = nextColor;
      runKind = nextKind;
    }

    return spans;
  }, [activeHighlightColor, highlightedCharIndexes, parts, text]);

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
  const touchGestureRef = useRef<{
    startLocalX: number;
    startLocalY: number;
    dragged: boolean;
  } | null>(null);

  const editableTokenUnits = useMemo(() => {
    if (!highlightEditMode || (!onToggleHighlightUnit && !onReplaceHighlightSelection)) return null;
    const chars = text.split("");
    if (!chars.length) return [];
    const kinds = new Array<VerseSpeechPart["kind"] | null>(chars.length).fill(null);
    if (parts?.length) {
      let cursor = 0;
      for (const seg of parts) {
        const segChars = seg.text.split("");
        for (let i = 0; i < segChars.length && cursor + i < kinds.length; i += 1) {
          kinds[cursor + i] = seg.kind;
        }
        cursor += segChars.length;
        if (cursor >= kinds.length) break;
      }
    }
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
      const lineHeight = Math.max(1, px.verseLineHeight);
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
      // Fallback when onTextLayout doesn't provide usable lines in nested Text.
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
    [editableTokenUnits, px.verseLineHeight, text.length],
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
              onPaintHighlightUnit(
                wrap.unit.start,
                wrap.unit.end,
                state.mode,
                activeHighlightColor,
              );
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

  const editableUnits = useMemo(() => {
    if (!editableTokenUnits) return null;
    const selectedIndexes = highlightedCharIndexes ?? new Map<number, string>();
    const canTapToggle = Boolean(onToggleHighlightUnit);
    const toggle = onToggleHighlightUnit;
    return editableTokenUnits.map(({ idx, unit, kindStyle }) => {
      const unitSelected =
        unit.selectable &&
        Array.from({ length: unit.end - unit.start }).every((_, offset) =>
          selectedIndexes.has(unit.start + offset),
        );
      const unitHighlightColor =
        selectedIndexes.get(unit.start) ?? activeHighlightColor;
      return (
        <Text
          key={`u:${idx}:${unit.start}`}
          ref={(node) => {
            unitNodeRefs.current.set(idx, node);
          }}
          onLayout={(e) => {
            unitLayoutsRef.current.set(idx, e.nativeEvent.layout);
            if (onHighlightUnitLayout) {
              const local = e.nativeEvent.layout;
              const rootOrigin = rootWindowOriginRef.current;
              if (rootOrigin) {
                onHighlightUnitLayout(unit.start, unit.end, {
                  x: rootOrigin.x + local.x,
                  y: rootOrigin.y + local.y,
                  width: local.width,
                  height: local.height,
                });
              } else {
                const node = unitNodeRefs.current.get(idx);
                if (node && typeof node.measureInWindow === "function") {
                  node.measureInWindow((x, y, width, height) => {
                    onHighlightUnitLayout(unit.start, unit.end, { x, y, width, height });
                  });
                }
              }
            }
          }}
          onPress={
            unit.selectable && canTapToggle && toggle
              ? () => toggle(unit.start, unit.end, activeHighlightColor)
              : undefined
          }
          style={[
            kindStyle,
            unitSelected && styles.charHighlight,
            unitSelected && { backgroundColor: unitHighlightColor },
          ]}
        >
          {unit.text}
        </Text>
      );
    });
  }, [
    editableTokenUnits,
    highlightedCharIndexes,
    activeHighlightColor,
    onHighlightUnitLayout,
    onReplaceHighlightSelection,
    onToggleHighlightUnit,
  ]);

  const resolveLocalPoint = useCallback((e: GestureResponderEvent) => {
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
  }, []);

  const handleTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      const pt = resolveLocalPoint(e);
      touchGestureRef.current = {
        startLocalX: pt.localX,
        startLocalY: pt.localY,
        dragged: false,
      };
      if (!USE_DEFERRED_HIGHLIGHT_TOUCH) {
        beginOrExtendDragSelection(pt.localX, pt.localY, true);
      }
      if (onHighlightTracePoint) {
        onHighlightTracePoint(pt.pageX, pt.pageY, true);
      }
    },
    [beginOrExtendDragSelection, onHighlightTracePoint, resolveLocalPoint],
  );

  const handleTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      const pt = resolveLocalPoint(e);
      const touch = touchGestureRef.current;
      if (touch && !touch.dragged) {
        const dx = pt.localX - touch.startLocalX;
        const dy = pt.localY - touch.startLocalY;
        if (dx * dx + dy * dy >= HIGHLIGHT_TAP_SLOP_PX * HIGHLIGHT_TAP_SLOP_PX) {
          touch.dragged = true;
          if (USE_DEFERRED_HIGHLIGHT_TOUCH) {
            beginOrExtendDragSelection(pt.localX, pt.localY, true);
          }
        }
      }
      if (!USE_DEFERRED_HIGHLIGHT_TOUCH || touch?.dragged) {
        beginOrExtendDragSelection(pt.localX, pt.localY, false);
      }
      if (onHighlightTracePoint) {
        onHighlightTracePoint(pt.pageX, pt.pageY, false);
      }
    },
    [beginOrExtendDragSelection, onHighlightTracePoint, resolveLocalPoint],
  );

  const handleTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      if (USE_DEFERRED_HIGHLIGHT_TOUCH && onToggleHighlightUnit) {
        const pt = resolveLocalPoint(e);
        const touch = touchGestureRef.current;
        if (touch && !touch.dragged) {
          const unitIndex = hitTestUnitIndex(pt.localX, pt.localY);
          const unitWrap = editableTokenUnits?.[unitIndex];
          if (unitWrap?.unit.selectable) {
            onToggleHighlightUnit(
              unitWrap.unit.start,
              unitWrap.unit.end,
              activeHighlightColor,
            );
          }
        }
      }
      touchGestureRef.current = null;
      endDragSelection();
    },
    [
      activeHighlightColor,
      editableTokenUnits,
      endDragSelection,
      hitTestUnitIndex,
      onToggleHighlightUnit,
      resolveLocalPoint,
    ],
  );

  const highlightTouchEnabled =
    highlightEditMode &&
    (onToggleHighlightUnit || onReplaceHighlightSelection || onPaintHighlightUnit);

  const verseBodyPressProps = useMemo(
    () =>
      highlightEditMode || !onPress
        ? null
        : ({
            onPress,
            onLongPress,
            suppressHighlighting: true,
          } as const),
    [highlightEditMode, onLongPress, onPress],
  );

  const dragGestureProps = useMemo(
    () =>
      highlightTouchEnabled
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
      handleTouchEnd,
      handleTouchMove,
      handleTouchStart,
      highlightTouchEnabled,
    ],
  );

  useEffect(() => {
    if (!highlightEditMode || !onHighlightUnitLayout || !editableTokenUnits?.length) return;
    const timer = setTimeout(() => {
      editableTokenUnits.forEach(({ idx, unit }) => {
        const node = unitNodeRefs.current.get(idx);
        if (!node || typeof node.measureInWindow !== "function") return;
        node.measureInWindow((x, y, width, height) => {
          if (!(Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0)) return;
          onHighlightUnitLayout(unit.start, unit.end, { x, y, width, height });
        });
      });
    }, 30);
    return () => clearTimeout(timer);
  }, [editableTokenUnits, highlightEditMode, layoutMeasureTick, onHighlightUnitLayout]);

  if (inline) {
    if (editableUnits) {
      return (
        <Text
          ref={rootTextRef}
          collapsable={false}
          onLayout={(e) => {
            updateRootWindowOrigin();
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) rootLayoutRef.current = { width, height };
          }}
          onTextLayout={onRootTextLayout}
          {...(dragGestureProps as any)}
        >
          {editableUnits}
        </Text>
      );
    }
    if (highlightedChars) {
      return (
        <Text style={baseStyle} {...(verseBodyPressProps as object)}>
          {highlightedChars}
        </Text>
      );
    }
    if (!parts?.length) {
      return marker ? (
        <Text style={marker} {...(verseBodyPressProps as object)}>
          {text}
        </Text>
      ) : (
        <Text {...(verseBodyPressProps as object)}>{text}</Text>
      );
    }
    if (marker) {
      return (
        <Text style={marker} {...(verseBodyPressProps as object)}>
          {segments}
        </Text>
      );
    }
    return <Text {...(verseBodyPressProps as object)}>{segments}</Text>;
  }

  if (editableUnits) {
    return (
      <Text
        ref={rootTextRef}
        collapsable={false}
        style={baseStyle}
        onLayout={(e) => {
          updateRootWindowOrigin();
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) rootLayoutRef.current = { width, height };
        }}
        onTextLayout={onRootTextLayout}
        {...(dragGestureProps as any)}
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

  // 金句底色包在外层 Text，避免 iOS 上分段各自铺底几乎看不见。
  return <Text style={[baseStyle, marker]}>{segments}</Text>;
}

const styles = {
  divine: {
    ...parchmentSans(700),
    color: c.divineSpeech,
  },
  human: {
    // Keep human speech in regular weight; only divine speech is bold.
    color: c.humanSpeech,
  },
  charHighlight: {
    borderRadius: 2,
  },
  savedHighlight: {
    borderRadius: 2,
    paddingHorizontal: 1,
    paddingVertical: 0,
  },
};
