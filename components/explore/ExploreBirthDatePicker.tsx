"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  buildBirthDayOptions,
  buildBirthMonthOptions,
  buildBirthYearOptions,
  clampBirthDate,
  clampBirthDateToToday,
  type ExploreBirthDate,
} from "@/lib/explore/explore-birth-date";
import {
  PARCHMENT_CONTROL_SURFACE_CLASS,
  PARCHMENT_CONTROL_SURFACE_TOKENS,
} from "@/lib/shell/parchment-control-surface";

const EN_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const ROW_HEIGHT = PARCHMENT_CONTROL_SURFACE_TOKENS.wheelRowHeight;
const PAD_ROWS = Math.floor(PARCHMENT_CONTROL_SURFACE_TOKENS.wheelVisibleRows / 2);

type ColumnProps<T extends string | number> = {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  formatLabel?: (item: T) => string;
  columnClassName?: string;
};

function BirthDateWheelColumn<T extends string | number>({
  options,
  value,
  onChange,
  formatLabel = (item) => String(item),
  columnClassName,
}: ColumnProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToValue = useCallback(
    (target: T, behavior: ScrollBehavior = "auto") => {
      const index = options.indexOf(target);
      if (index < 0 || !listRef.current) return;
      listRef.current.scrollTo({ top: index * ROW_HEIGHT, behavior });
    },
    [options],
  );

  const scrollToValueRef = useRef(scrollToValue);
  scrollToValueRef.current = scrollToValue;

  useLayoutEffect(() => {
    scrollToValueRef.current(value, "auto");
  }, [value, options]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      scrollToValueRef.current(value, "auto");
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, options]);

  const scrollEndTimerRef = useRef<number | null>(null);

  const settleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const index = Math.min(
      options.length - 1,
      Math.max(0, Math.round(el.scrollTop / ROW_HEIGHT)),
    );
    const snappedTop = index * ROW_HEIGHT;
    if (Math.abs(el.scrollTop - snappedTop) > 1) {
      el.scrollTo({ top: snappedTop, behavior: "auto" });
    }
    const next = options[index];
    if (next != null && next !== value) onChange(next);
  }, [options, value, onChange]);

  const onScroll = useCallback(() => {
    if (scrollEndTimerRef.current != null) {
      window.clearTimeout(scrollEndTimerRef.current);
    }
    scrollEndTimerRef.current = window.setTimeout(() => {
      scrollEndTimerRef.current = null;
      settleScroll();
    }, 80);
  }, [settleScroll]);

  useEffect(
    () => () => {
      if (scrollEndTimerRef.current != null) {
        window.clearTimeout(scrollEndTimerRef.current);
      }
    },
    [],
  );

  return (
    <div
      ref={listRef}
      className={[PARCHMENT_CONTROL_SURFACE_CLASS.pickerColumn, columnClassName].filter(Boolean).join(" ")}
      onScroll={onScroll}
    >
      {Array.from({ length: PAD_ROWS }, (_, index) => (
        <div key={`pad-top-${index}`} className="parchment-control-picker__pad" aria-hidden />
      ))}
      {options.map((item) => {
        const selected = item === value;
        return (
          <button
            key={String(item)}
            type="button"
            className={[
              PARCHMENT_CONTROL_SURFACE_CLASS.pickerRow,
              selected ? PARCHMENT_CONTROL_SURFACE_CLASS.pickerRowSelected : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              onChange(item);
              scrollToValue(item, "smooth");
            }}
          >
            {formatLabel(item)}
          </button>
        );
      })}
      {Array.from({ length: PAD_ROWS }, (_, index) => (
        <div key={`pad-bottom-${index}`} className="parchment-control-picker__pad" aria-hidden />
      ))}
    </div>
  );
}

type Props = {
  value: ExploreBirthDate;
  onChange: (date: ExploreBirthDate) => void;
};

export function ExploreBirthDatePicker({ value, onChange }: Props) {
  const { locale } = useLocale();
  const now = useMemo(() => new Date(), []);
  const years = useMemo(() => buildBirthYearOptions(now.getFullYear()), [now]);
  const months = useMemo(() => buildBirthMonthOptions(value.year, now), [value.year, now]);
  const days = useMemo(
    () => buildBirthDayOptions(value.year, value.month, now),
    [value.year, value.month, now],
  );

  const formatMonth = useCallback(
    (month: number) => {
      if (!/^en\b/i.test(locale)) return `${month}月`;
      return EN_MONTH_SHORT[month - 1] ?? String(month);
    },
    [locale],
  );

  const apply = useCallback(
    (next: ExploreBirthDate) => onChange(clampBirthDateToToday(next, now)),
    [onChange, now],
  );
  const setYear = useCallback((year: number) => apply(clampBirthDate({ ...value, year })), [value, apply]);
  const setMonth = useCallback((month: number) => apply(clampBirthDate({ ...value, month })), [value, apply]);
  const setDay = useCallback((day: number) => apply({ ...value, day }), [value, apply]);

  return (
    <div className={PARCHMENT_CONTROL_SURFACE_CLASS.picker}>
      <div className="parchment-control-picker__band" aria-hidden />
      <div className="parchment-control-picker__columns">
        <BirthDateWheelColumn
          options={years}
          value={value.year}
          onChange={setYear}
          columnClassName="parchment-control-picker__column--year"
        />
        <BirthDateWheelColumn
          options={months}
          value={value.month}
          onChange={setMonth}
          formatLabel={formatMonth}
          columnClassName="parchment-control-picker__column--month"
        />
        <BirthDateWheelColumn
          options={days}
          value={value.day}
          onChange={setDay}
          columnClassName="parchment-control-picker__column--day"
        />
      </div>
    </div>
  );
}
