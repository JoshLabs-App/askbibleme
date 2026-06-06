import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { getLocale } from "../i18n/locale-store";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import {
  buildBirthDayOptions,
  buildBirthMonthOptions,
  buildBirthYearOptions,
  clampBirthDate,
  clampBirthDateToToday,
  type ExploreBirthDate,
} from "./explore-birth-date";
import { EXPLORE_WHEEL_ROW_HEIGHT, ExploreWheelColumn } from "./ExploreWheelColumn";

const EN_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

type Props = {
  value: ExploreBirthDate;
  onChange: (date: ExploreBirthDate) => void;
};

export function ExploreBirthDatePicker({ value, onChange }: Props) {
  const now = useMemo(() => new Date(), []);
  const years = useMemo(() => buildBirthYearOptions(now.getFullYear()), [now]);
  const months = useMemo(() => buildBirthMonthOptions(value.year, now), [value.year, now]);
  const days = useMemo(
    () => buildBirthDayOptions(value.year, value.month, now),
    [value.year, value.month, now],
  );

  const formatMonth = useCallback((month: number) => {
    if (getLocale() !== "en") return `${month}月`;
    return EN_MONTH_SHORT[month - 1] ?? String(month);
  }, []);

  const apply = useCallback(
    (next: ExploreBirthDate) => onChange(clampBirthDateToToday(next, now)),
    [onChange, now],
  );
  const setYear = useCallback(
    (year: number) => apply(clampBirthDate({ ...value, year })),
    [value, apply],
  );
  const setMonth = useCallback(
    (month: number) => apply(clampBirthDate({ ...value, month })),
    [value, apply],
  );
  const setDay = useCallback((day: number) => apply({ ...value, day }), [value, apply]);

  const pickerHeight = EXPLORE_WHEEL_ROW_HEIGHT * 5;

  return (
    <View style={[styles.wrap, { height: pickerHeight }]}>
      <View style={styles.selectionBand} pointerEvents="none" />
      <View style={styles.columns}>
        <ExploreWheelColumn options={years} value={value.year} onChange={setYear} flex={1.15} />
        <ExploreWheelColumn
          options={months}
          value={value.month}
          onChange={setMonth}
          formatLabel={formatMonth}
          flex={0.95}
        />
        <ExploreWheelColumn options={days} value={value.day} onChange={setDay} flex={0.85} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.72)",
  },
  selectionBand: {
    position: "absolute",
    left: 8,
    right: 8,
    top: "50%",
    marginTop: -EXPLORE_WHEEL_ROW_HEIGHT / 2,
    height: EXPLORE_WHEEL_ROW_HEIGHT,
    borderRadius: 10,
    backgroundColor: "rgba(42, 36, 28, 0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    zIndex: 0,
  },
  columns: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    zIndex: 1,
  },
});
