"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  READ_DONE_ACCENT,
  READ_NEW_TESTAMENT_ACCENT,
  READ_PARCHMENT_BORDER,
  READ_PARCHMENT_FAINT,
} from "@/lib/read/read-parchment-accents";
import type { ReadingHabitStatsSnapshot } from "@/lib/read/reading-habit-stats";

type Props = {
  yearDay: number;
  snapshot: ReadingHabitStatsSnapshot;
};

function StatBlock({
  value,
  label,
  valueColor,
}: {
  value: string;
  label: string;
  valueColor: string;
}) {
  return (
    <div className="read-bible-today-stat min-w-0 flex-1 text-center">
      <p
        className="read-bible-today-stat-value font-bold tabular-nums leading-none"
        style={{ color: valueColor }}
      >
        {value}
      </p>
      <p
        className="read-bible-today-stat-label mt-1 text-[11px] font-medium leading-[15px] tracking-[0.02em]"
        style={{ color: READ_PARCHMENT_FAINT }}
      >
        {label}
      </p>
    </div>
  );
}

export function ReadTodayReadingStats({ yearDay, snapshot }: Props) {
  const { t } = useLocale();

  return (
    <div className="read-bible-today-stats my-2 flex w-full items-stretch px-1 py-2" role="group">
      <StatBlock
        value={yearDay.toLocaleString()}
        label={t("pages.read.todayReadingStatYearDayLabel")}
        valueColor={READ_NEW_TESTAMENT_ACCENT}
      />
      <div
        className="read-bible-today-stats-divider mx-1 w-px self-stretch"
        style={{ backgroundColor: READ_PARCHMENT_BORDER }}
        aria-hidden
      />
      <StatBlock
        value={snapshot.readDays.toLocaleString()}
        label={t("pages.read.todayReadingStatReadLabel")}
        valueColor={READ_DONE_ACCENT}
      />
      <div
        className="read-bible-today-stats-divider mx-1 w-px self-stretch"
        style={{ backgroundColor: READ_PARCHMENT_BORDER }}
        aria-hidden
      />
      <StatBlock
        value={snapshot.streakDays.toLocaleString()}
        label={t("pages.read.todayReadingStatStreakLabel")}
        valueColor={READ_DONE_ACCENT}
      />
    </div>
  );
}
