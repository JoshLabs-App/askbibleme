import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { getLocale } from "../i18n/locale-store";
import {
  parchmentControlStyles,
  parchmentModalControlStyles,
  parchmentOverlayControlStyles,
} from "../shell/parchmentControlSurface";
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
  /** 叠在羊皮卷 overlay 上时用更透明的控件面 */
  onParchment?: boolean;
  /** 探索弹层内：实底滚轮 */
  inModal?: boolean;
};

export function ExploreBirthDatePicker({ value, onChange, onParchment = false, inModal = false }: Props) {
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
  const surface = inModal
    ? parchmentModalControlStyles
    : onParchment
      ? parchmentOverlayControlStyles
      : parchmentControlStyles;

  return (
    <View style={[surface.pickerWrap, { height: pickerHeight }]}>
      <View style={surface.pickerSelectionBand} pointerEvents="none" />
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
  columns: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    zIndex: 1,
  },
});
