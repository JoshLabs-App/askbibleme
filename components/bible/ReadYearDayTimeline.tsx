"use client";

import { useMemo } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { READ_NEW_TESTAMENT_ACCENT } from "@/lib/read/read-parchment-accents";
import {
  buildYearReadRangesBeforeToday,
  getYearDayTimeline,
  yearDayRangeToTrackFraction,
} from "@/lib/read/year-day-timeline";

type Props = {
  completedDates?: readonly string[];
};

/** 全年进度横轴：淡底轨 + 实色已读 + 今日橙点（对齐 App `ReadYearDayTimeline`） */
export function ReadYearDayTimeline({ completedDates = [] }: Props) {
  const { t } = useLocale();
  const now = useMemo(() => new Date(), []);
  const { dayOfYear, daysInYear, progress } = useMemo(() => getYearDayTimeline(now), [now]);
  const ranges = useMemo(
    () => buildYearReadRangesBeforeToday(completedDates, now),
    [completedDates, now],
  );
  const markerLeftPct = `${progress * 100}%`;

  return (
    <div
      className="read-bible-year-timeline relative mt-1.5 mb-0.5 h-[22px] w-full"
      aria-label={t("pages.read.yearTimelineA11y", {
        day: String(dayOfYear),
        total: String(daysInYear),
      })}
    >
      <div className="read-bible-year-timeline-track absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-amber-900/20 to-transparent" />
      {ranges.map((range) => {
        const { left, width } = yearDayRangeToTrackFraction(range, daysInYear);
        if (width <= 0) return null;
        const minW = 2 / Math.max(daysInYear, 1);
        const drawW = Math.max(width, minW);
        const drawLeft = Math.min(left, Math.max(0, 1 - drawW));
        return (
          <span
            key={`${range.startDay}-${range.endDay}`}
            className="read-bible-year-timeline-read-range absolute top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-[#E8A017]"
            style={{ left: `${drawLeft * 100}%`, width: `${drawW * 100}%` }}
            aria-hidden
          />
        );
      })}
      <span
        className="read-bible-year-timeline-dot absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]"
        style={{
          left: markerLeftPct,
          borderColor: READ_NEW_TESTAMENT_ACCENT,
          backgroundColor: READ_NEW_TESTAMENT_ACCENT,
        }}
        aria-hidden
      />
    </div>
  );
}
