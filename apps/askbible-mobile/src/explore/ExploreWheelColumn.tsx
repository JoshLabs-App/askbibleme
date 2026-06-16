import { useCallback, useEffect, useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { parchmentControlSurface } from "../shell/parchmentControlSurface";

export const EXPLORE_WHEEL_ROW_HEIGHT = parchmentControlSurface.wheelRowHeight;
const VISIBLE_ROWS = parchmentControlSurface.wheelVisibleRows;
const PAD_ROWS = Math.floor(VISIBLE_ROWS / 2);

type Props<T extends string | number> = {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  formatLabel?: (item: T) => string;
  flex?: number;
};

export function ExploreWheelColumn<T extends string | number>({
  options,
  value,
  onChange,
  formatLabel = (item) => String(item),
  flex = 1,
}: Props<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const pickerHeight = EXPLORE_WHEEL_ROW_HEIGHT * VISIBLE_ROWS;

  const scrollToValue = useCallback(
    (target: T, animated: boolean) => {
      const index = options.indexOf(target);
      if (index < 0) return;
      scrollRef.current?.scrollTo({
        y: index * EXPLORE_WHEEL_ROW_HEIGHT,
        animated,
      });
    },
    [options],
  );

  const scrollToValueRef = useRef(scrollToValue);
  scrollToValueRef.current = scrollToValue;

  useEffect(() => {
    const id = requestAnimationFrame(() => scrollToValueRef.current(value, false));
    return () => cancelAnimationFrame(id);
  }, [value, options]);

  const onPickerLayout = useCallback(() => {
    scrollToValueRef.current(value, false);
  }, [value]);

  const onContentSizeChange = useCallback(() => {
    scrollToValueRef.current(value, false);
  }, [value]);

  const syncFromOffset = useCallback(
    (offsetY: number) => {
      const index = Math.min(
        options.length - 1,
        Math.max(0, Math.round(offsetY / EXPLORE_WHEEL_ROW_HEIGHT)),
      );
      const next = options[index];
      if (next != null && next !== value) onChange(next);
    },
    [options, value, onChange],
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncFromOffset(e.nativeEvent.contentOffset.y);
    },
    [syncFromOffset],
  );

  return (
    <View
      style={[styles.wrap, { height: pickerHeight, flex }]}
      onStartShouldSetResponder={() => Platform.OS === "android"}
      onMoveShouldSetResponder={(_, gestureState) =>
        Platform.OS === "android" && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      }
    >
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        snapToInterval={EXPLORE_WHEEL_ROW_HEIGHT}
        decelerationRate="fast"
        onLayout={onPickerLayout}
        onContentSizeChange={onContentSizeChange}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        keyboardShouldPersistTaps="handled"
      >
        {Array.from({ length: PAD_ROWS }, (_, index) => (
          <View key={`pad-top-${index}`} style={styles.padRow} />
        ))}
        {options.map((item) => {
          const selected = item === value;
          return (
            <Pressable
              key={String(item)}
              delayPressIn={120}
              onPress={() => {
                onChange(item);
                scrollToValue(item, true);
              }}
              style={styles.row}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.rowText, selected && styles.rowTextSelected]} numberOfLines={1}>
                {formatLabel(item)}
              </Text>
            </Pressable>
          );
        })}
        {Array.from({ length: PAD_ROWS }, (_, index) => (
          <View key={`pad-bottom-${index}`} style={styles.padRow} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 0,
    overflow: "hidden",
  },
  list: {
    flex: 1,
  },
  padRow: {
    height: EXPLORE_WHEEL_ROW_HEIGHT,
  },
  row: {
    height: EXPLORE_WHEEL_ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  rowText: {
    fontSize: 18,
    ...parchmentSans(500),
    color: c.faint,
  },
  rowTextSelected: {
    fontSize: 20,
    ...parchmentSans(700),
    color: c.ink,
  },
});
