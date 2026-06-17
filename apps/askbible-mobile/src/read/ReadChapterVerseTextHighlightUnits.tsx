import { useEffect, useMemo, type MutableRefObject, type RefObject } from "react";
import { Pressable, Text, View, type LayoutRectangle, type TextStyle } from "react-native";
import type { EditableTokenUnit } from "./useReadChapterVerseTextHighlightDrag";
import { readChapterVerseTextStyles as styles } from "./readChapterVerseTextStyles";

export type ReadChapterVerseTextHighlightUnitsArgs = {
  editableTokenUnits: EditableTokenUnit[] | null;
  highlightedCharIndexes: Map<number, string> | null;
  highlightEditMode: boolean;
  preciseHighlightUnits: boolean;
  activeHighlightColor: string;
  baseStyle: TextStyle;
  layoutMeasureTick: number;
  onToggleHighlightUnit?: (start: number, end: number, color: string) => void;
  onHighlightUnitLayout?: (
    start: number,
    end: number,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  unitNodeRefs: MutableRefObject<Map<number, Text | null>>;
  unitLayoutsRef: MutableRefObject<Map<number, LayoutRectangle>>;
  rootWindowOriginRef: RefObject<{ x: number; y: number } | null>;
};

export function useReadChapterVerseTextHighlightUnits({
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
}: ReadChapterVerseTextHighlightUnitsArgs) {
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
      const unitHighlightColor = selectedIndexes.get(unit.start) ?? activeHighlightColor;
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
    onToggleHighlightUnit,
    rootWindowOriginRef,
    unitLayoutsRef,
    unitNodeRefs,
  ]);

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
  }, [editableTokenUnits, highlightEditMode, layoutMeasureTick, onHighlightUnitLayout, unitNodeRefs]);

  const preciseHighlightBody = useMemo(() => {
    if (!highlightEditMode || !preciseHighlightUnits || !editableTokenUnits?.length || !onToggleHighlightUnit) {
      return null;
    }
    const selectedIndexes = highlightedCharIndexes ?? new Map<number, string>();
    return (
      <View style={styles.preciseHighlightFlow}>
        {editableTokenUnits.map(({ idx, unit, kindStyle }) => {
          const unitSelected =
            unit.selectable &&
            Array.from({ length: unit.end - unit.start }).every((_, offset) =>
              selectedIndexes.has(unit.start + offset),
            );
          const unitHighlightColor = selectedIndexes.get(unit.start) ?? activeHighlightColor;
          const toggle = onToggleHighlightUnit;
          return (
            <Pressable
              key={`pu:${idx}:${unit.start}`}
              disabled={!unit.selectable}
              onPress={
                unit.selectable
                  ? () => toggle(unit.start, unit.end, activeHighlightColor)
                  : undefined
              }
              style={({ pressed }) => [
                styles.preciseHighlightUnit,
                unitSelected && { backgroundColor: unitHighlightColor },
                unit.selectable && pressed && styles.preciseHighlightUnitPressed,
              ]}
            >
              <Text style={[baseStyle, kindStyle, styles.preciseHighlightUnitText]}>{unit.text}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }, [
    activeHighlightColor,
    baseStyle,
    editableTokenUnits,
    highlightEditMode,
    highlightedCharIndexes,
    onToggleHighlightUnit,
    preciseHighlightUnits,
  ]);

  return {
    editableUnits,
    preciseHighlightBody,
  };
}
