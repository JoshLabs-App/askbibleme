"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { isPointerReadingPlanId } from "@/lib/bible/reading-plans/pointer-reading-plan";
import { resolveReadingPlanDayIndex, type ReadingPlanPrefs } from "@/lib/read/reading-plan-prefs";
import type { AppLocale } from "@/lib/i18n/config";

const DAY_MS = 86_400_000;
const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"] as const;
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

type Props = {
  prefs: ReadingPlanPrefs;
  dayCount: number | undefined;
  viewAhead: number;
  onSelectAhead: (ahead: number) => void;
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
  return `${year}年${monthIndex + 1}月`;
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

/** 读经计划播放页：本月日历（对齐 App）。 */
export function ReadPlanPlayMonthCalendar({
  prefs,
  dayCount,
  viewAhead,
  onSelectAhead,
  listenedDates,
}: Props) {
  const { t, locale } = useLocale();
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

  return (
    <div className="read-plan-play-calendar">
      <div className="read-plan-play-calendar__month-bar">
        <button
          type="button"
          className="read-plan-play-calendar__nav"
          aria-label={t("pages.read.planPlayCalendarPrevMonth")}
          onClick={() => {
            const d = new Date(cursorYear, cursorMonth - 1, 1);
            setCursorYear(d.getFullYear());
            setCursorMonth(d.getMonth());
          }}
        >
          <ShellMaterialIcon name="chevron-left" size={28} color="currentColor" />
        </button>
        <p className="read-plan-play-calendar__month-title">{monthLabel(locale, cursorYear, cursorMonth)}</p>
        <button
          type="button"
          className="read-plan-play-calendar__nav"
          aria-label={t("pages.read.planPlayCalendarNextMonth")}
          onClick={() => {
            const d = new Date(cursorYear, cursorMonth + 1, 1);
            setCursorYear(d.getFullYear());
            setCursorMonth(d.getMonth());
          }}
        >
          <ShellMaterialIcon name="chevron-right" size={28} color="currentColor" />
        </button>
      </div>

      <div className="read-plan-play-calendar__week-row">
        {weekdays.map((label) => (
          <span key={label} className="read-plan-play-calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      {rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="read-plan-play-calendar__week-row">
          {row.map((cell) => {
            if (cell.day == null) {
              return <span key={cell.key} className="read-plan-play-calendar__cell read-plan-play-calendar__cell--pad" />;
            }
            const disabled = !cell.selectable;
            const todayFill = cell.isToday;
            const accentFill = !todayFill && (cell.isSelected || cell.isListened);
            const fadeDisabled = disabled && !cell.isListened;
            return (
              <button
                key={cell.key}
                type="button"
                disabled={disabled}
                className={[
                  "read-plan-play-calendar__cell",
                  todayFill ? "read-plan-play-calendar__cell--today" : "",
                  accentFill ? "read-plan-play-calendar__cell--accent" : "",
                  fadeDisabled ? "read-plan-play-calendar__cell--disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={cell.isSelected}
                aria-label={String(cell.day)}
                onClick={() => onSelectAhead(cell.ahead)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
