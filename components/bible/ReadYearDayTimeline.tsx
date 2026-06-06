"use client";

import { useMemo } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { READ_NEW_TESTAMENT_ACCENT } from "@/lib/read/read-parchment-accents";
import { getYearDayTimeline } from "@/lib/read/year-day-timeline";

export function ReadYearDayTimeline() {
  const { t } = useLocale();
  const { dayOfYear, daysInYear, progress } = useMemo(() => getYearDayTimeline(), []);
  const markerLeftPct = `${progress * 100}%`;

  return (
    <div
      className="read-bible-year-timeline relative mt-1.5 mb-0.5 h-5 w-full"
      aria-label={t("pages.read.yearTimelineA11y", {
        day: String(dayOfYear),
        total: String(daysInYear),
      })}
    >
      <div className="read-bible-year-timeline-track absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2" />
      <span
        className="read-bible-year-timeline-dot absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]"
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
