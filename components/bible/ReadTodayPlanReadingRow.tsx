"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatReadingPlanRange, readingPlanChapterHref } from "@/lib/bible/reading-plans/format-reading-range";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import { READ_NEW_TESTAMENT_ACCENT, READ_PARCHMENT_INK, READ_PARCHMENT_MUTED } from "@/lib/read/read-parchment-accents";

type Props = {
  reading: ReadingPlanRange;
  done: boolean;
  progress: number;
  onToggleDone: () => void;
  checkboxDisabled?: boolean;
  showCheckbox?: boolean;
  dimDoneText?: boolean;
};

export function ReadTodayPlanReadingRow({
  reading,
  done,
  progress,
  onToggleDone,
  checkboxDisabled = false,
  showCheckbox = true,
  dimDoneText = true,
}: Props) {
  const { t, locale } = useLocale();
  const pct = Math.min(1, Math.max(0, progress));
  const fillWidth = `${Math.round(pct * 100)}%`;

  return (
    <div className="read-bible-today-reading-row flex items-start gap-2 py-1">
      {showCheckbox ? (
        <button
          type="button"
          disabled={checkboxDisabled}
          aria-checked={done}
          role="checkbox"
          aria-label={done ? t("pages.read.todayPlanMarkUndone") : t("pages.read.todayPlanMarkDone")}
          onClick={checkboxDisabled ? undefined : onToggleDone}
          className={[
            "mt-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center text-[16px]",
            checkboxDisabled ? "opacity-55" : "",
          ].join(" ")}
          style={{ color: done ? READ_PARCHMENT_INK : READ_PARCHMENT_MUTED }}
        >
          {done ? "☑" : "☐"}
        </button>
      ) : (
        <span className="mt-0.5 inline-block h-[22px] w-[22px] shrink-0" aria-hidden />
      )}
      <Link
        href={readingPlanChapterHref(reading.bookId, reading.startChapter, true)}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className="block text-[15px] font-medium leading-5 text-left"
          style={{ color: dimDoneText && done ? READ_PARCHMENT_MUTED : READ_PARCHMENT_INK }}
        >
          {formatReadingPlanRange(reading, locale)}
        </span>
        <span
          className="read-bible-today-reading-bar mt-1 block h-1 w-full max-w-[calc(100%-1.875rem)] overflow-hidden rounded-sm"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 100)}
        >
          <span
            className={["block h-full rounded-sm", pct > 0 && pct < 1 ? "min-w-[3px]" : ""].join(" ")}
            style={{ width: fillWidth, backgroundColor: READ_NEW_TESTAMENT_ACCENT }}
          />
        </span>
      </Link>
    </div>
  );
}
