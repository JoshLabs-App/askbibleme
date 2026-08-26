import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import type { AppLocale } from "../i18n/config";
import { t, tFormat } from "../i18n/site-copy";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { isPointerReadingPlanId } from "./reading-plan/pointer-reading-plan";
import {
  resolveReadingPlanDayIndex,
  type ReadingPlanPrefs,
} from "./reading-plan/reading-plan-prefs";

const DAY_MS = 86_400_000;

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"] as const;
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

type Props = {
  locale: AppLocale;
  prefs: ReadingPlanPrefs;
  dayCount: number | undefined;
  viewAhead: number;
  onSelectAhead: (ahead: number) => void;
  /** 日历日 YYYY-MM-DD：曾读过（点听/开章/金句等），标 LOGO 黄底；与当前计划无关 */
  listenedDates?: ReadonlySet<string>;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function daysBetweenLocal(from: Date, to: Date): number {
  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS);
}

function monthLabel(locale: AppLocale, year: number, monthIndex: number): string {
  if (locale === "en") {
    return new Date(year, monthIndex, 1).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  return tFormat("pages.read.planPlayCalendarMonth", { y: year, m: monthIndex + 1 });
}

function isAheadSelectable(
  prefs: ReadingPlanPrefs,
  dayCount: number | undefined,
  ahead: number,
  now: Date,
): boolean {
  if (isPointerReadingPlanId(prefs.planId)) return true;
  const count = dayCount ?? prefs.dayCount ?? 365;
  if (!Number.isFinite(count) || count < 1) return false;
  const calendarIndex = resolveReadingPlanDayIndex(prefs, count, now);
  const dayIndex = calendarIndex + ahead;
  return dayIndex >= 0 && dayIndex < count;
}

/**
 * 读经计划播放页：本月日历。
 * 选中日相对真实今天（ahead=0 即今天）；超前进度由外层 contentAhead 处理，不把选中日推到未来。
 */
export function ReadPlanPlayMonthCalendar({
  locale,
  prefs,
  dayCount,
  viewAhead,
  onSelectAhead,
  listenedDates,
}: Props) {
  // 每次渲染取系统当天，避免挂载时冻住导致「今天」错位
  const today = startOfLocalDay(new Date());
  const selected = addLocalDays(today, viewAhead);

  const [cursorYear, setCursorYear] = useState(selected.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(selected.getMonth());

  useEffect(() => {
    setCursorYear(selected.getFullYear());
    setCursorMonth(selected.getMonth());
  }, [selected]);

  const weekdays = locale === "en" ? WEEKDAYS_EN : WEEKDAYS_ZH;

  const rows = useMemo(() => {
    const first = new Date(cursorYear, cursorMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const cells: Array<{
      key: string;
      day: number | null;
      ahead: number;
      selectable: boolean;
      isToday: boolean;
      isSelected: boolean;
      isListened: boolean;
    }> = [];

    for (let i = 0; i < total; i += 1) {
      const dayNum = i - startPad + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push({
          key: `pad-${i}`,
          day: null,
          ahead: 0,
          selectable: false,
          isToday: false,
          isSelected: false,
          isListened: false,
        });
        continue;
      }
      const date = new Date(cursorYear, cursorMonth, dayNum);
      const ahead = daysBetweenLocal(today, date);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      const iso = `${y}-${m}-${d}`;
      cells.push({
        key: `${cursorYear}-${cursorMonth}-${dayNum}`,
        day: dayNum,
        ahead,
        selectable: isAheadSelectable(prefs, dayCount, ahead, today),
        isToday: ahead === 0,
        isSelected: ahead === viewAhead,
        isListened: Boolean(listenedDates?.has(iso)),
      });
    }

    const out: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      out.push(cells.slice(i, i + 7));
    }
    return out;
  }, [cursorMonth, cursorYear, dayCount, listenedDates, prefs, today, viewAhead]);

  const onPrevMonth = () => {
    const d = new Date(cursorYear, cursorMonth - 1, 1);
    setCursorYear(d.getFullYear());
    setCursorMonth(d.getMonth());
  };

  const onNextMonth = () => {
    const d = new Date(cursorYear, cursorMonth + 1, 1);
    setCursorYear(d.getFullYear());
    setCursorMonth(d.getMonth());
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.monthBar}>
        <Pressable
          onPress={onPrevMonth}
          hitSlop={8}
          style={({ pressed }) => [styles.monthNavBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("pages.read.planPlayCalendarPrevMonth")}
        >
          <MaterialIcons name="chevron-left" size={28} color={c.ink} />
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel(locale, cursorYear, cursorMonth)}</Text>
        <Pressable
          onPress={onNextMonth}
          hitSlop={8}
          style={({ pressed }) => [styles.monthNavBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("pages.read.planPlayCalendarNextMonth")}
        >
          <MaterialIcons name="chevron-right" size={28} color={c.ink} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {weekdays.map((label) => (
          <Text key={label} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.weekRow}>
          {row.map((cell) => {
            if (cell.day == null) {
              return <View key={cell.key} style={styles.cell} />;
            }
            const disabled = !cell.selectable;
            /** 黑底 = 系统今天（不随「进度设置为今日」移动）；黄底 = 选中浏览日或已读过。 */
            const todayFill = cell.isToday;
            const accentFill = !todayFill && (cell.isSelected || cell.isListened);
            /** 已读日长期保留黄标全不透明度，换计划后不可选也不冲淡历史。 */
            const fadeDisabled = disabled && !cell.isListened;
            return (
              <Pressable
                key={cell.key}
                disabled={disabled}
                onPress={() => onSelectAhead(cell.ahead)}
                style={({ pressed }) => [
                  styles.cell,
                  todayFill && styles.cellToday,
                  accentFill && styles.cellAccent,
                  pressed && !disabled && styles.pressed,
                  fadeDisabled && styles.cellDisabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: cell.isSelected, disabled }}
                accessibilityLabel={`${cell.day}`}
              >
                <Text
                  style={[
                    styles.cellText,
                    todayFill && styles.cellTextToday,
                    accentFill && styles.cellTextAccent,
                    fadeDisabled && styles.cellTextDisabled,
                  ]}
                >
                  {cell.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 2,
  },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  monthNavBtn: {
    width: 36,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    fontSize: 20,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.ink,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 18,
    paddingVertical: 1,
    ...parchmentSans(500),
    color: c.muted,
  },
  cell: {
    flex: 1,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    /** 有底色时上下留缝，避免周与周贴成一整块 */
    marginVertical: 2,
  },
  cellToday: {
    backgroundColor: c.ink,
  },
  cellAccent: {
    backgroundColor: LOGO_YELLOW,
  },
  cellDisabled: {
    opacity: 0.35,
  },
  cellText: {
    fontSize: 18,
    ...parchmentSans(500),
    color: c.ink,
    fontVariant: ["tabular-nums"],
  },
  cellTextToday: {
    color: c.surfaceSolid,
    ...parchmentSans(700),
  },
  cellTextAccent: {
    color: c.ink,
    ...parchmentSans(700),
  },
  cellTextDisabled: {
    color: c.faint,
  },
  pressed: { opacity: 0.75 },
});
