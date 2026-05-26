import { useCallback, useEffect, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

export const EXPLORE_WHEEL_ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;

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
  const listRef = useRef<FlatList<T>>(null);
  const paddingVertical = EXPLORE_WHEEL_ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
  const pickerHeight = EXPLORE_WHEEL_ROW_HEIGHT * VISIBLE_ROWS;

  const scrollToValue = useCallback(
    (target: T, animated: boolean) => {
      const index = options.indexOf(target);
      if (index < 0) return;
      listRef.current?.scrollToOffset({
        offset: index * EXPLORE_WHEEL_ROW_HEIGHT,
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

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T>) => {
      const selected = item === value;
      return (
        <Pressable
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
    },
    [value, onChange, scrollToValue, formatLabel],
  );

  return (
    <View style={[styles.wrap, { height: pickerHeight, flex }]}>
      <FlatList
        ref={listRef}
        data={options as T[]}
        keyExtractor={(item) => String(item)}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={EXPLORE_WHEEL_ROW_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: EXPLORE_WHEEL_ROW_HEIGHT,
          offset: EXPLORE_WHEEL_ROW_HEIGHT * index,
          index,
        })}
        contentContainerStyle={{ paddingVertical }}
        onLayout={onPickerLayout}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 0,
    overflow: "hidden",
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
