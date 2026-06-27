"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  NT_DEEP_REPEAT_PACE_OPTIONS,
  buildNtDeepRepeatPaceTimeline,
  firstSegmentDayCount,
  firstSegmentEndDate,
  formatApproxDurationEn,
  formatApproxDurationZh,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";

type Props = {
  value?: NtDeepRepeatPace;
  onChange?: (pace: NtDeepRepeatPace) => void;
  previewStart?: Date;
};

function paceSummaryKey(pace: NtDeepRepeatPace): string {
  return `pages.read.ntDeepRepeatPace${pace}Summary`;
}

function paceTitleKey(pace: NtDeepRepeatPace): string {
  if (pace === 7) return "pages.read.ntDeepRepeatPace7Title";
  if (pace === 14) return "pages.read.ntDeepRepeatPace14Title";
  return "pages.read.ntDeepRepeatPace28Title";
}

function formatDuration(days: number, locale: string): string {
  return locale === "en" ? formatApproxDurationEn(days) : formatApproxDurationZh(days);
}

function formatEndDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function NtDeepRepeatPaceSection({ value, onChange, previewStart }: Props) {
  const { t, locale } = useLocale();
  const [internalPace, setInternalPace] = useState<NtDeepRepeatPace>(NT_DEEP_REPEAT_DEFAULT_PACE);
  const pace = value ?? internalPace;
  const start = previewStart ?? new Date();

  const setPace = (next: NtDeepRepeatPace) => {
    if (onChange) onChange(next);
    else setInternalPace(next);
  };

  const timeline = useMemo(() => buildNtDeepRepeatPaceTimeline(pace, start), [pace, start]);
  const firstDays = firstSegmentDayCount(start, pace);
  const firstEnd = firstSegmentEndDate(start, pace);

  return (
    <section className="mt-5 space-y-4" aria-labelledby="nt-deep-repeat-pace-heading">
      <div>
        <h3
          id="nt-deep-repeat-pace-heading"
          className="text-[11px] font-semibold tracking-[0.12em] text-amber-900/72 dark:text-stone-400"
        >
          {t("pages.read.ntDeepRepeatPaceTitle")}
        </h3>
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-amber-900/78 dark:text-stone-400">
          {t("pages.read.ntDeepRepeatPaceIntro")}
        </p>
        <p className="mt-2 text-pretty text-[11px] leading-relaxed text-amber-800/58 dark:text-stone-500">
          {t("pages.read.ntDeepRepeatPaceWeekAlignNote")}
        </p>
      </div>

      <fieldset className="space-y-2 border-0 p-0">
        <legend className="sr-only">{t("pages.read.ntDeepRepeatPaceTitle")}</legend>
        {NT_DEEP_REPEAT_PACE_OPTIONS.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-900/10 px-3 py-2.5 dark:border-stone-600/25"
          >
            <input
              type="radio"
              name="nt-deep-repeat-pace"
              className="mt-0.5"
              checked={pace === option}
              onChange={() => setPace(option)}
            />
            <span className="min-w-0 flex-1 text-[13px] text-amber-950 dark:text-stone-200">
              <span className="font-medium">{t(paceTitleKey(option))}</span>
              <span className="mt-0.5 block text-[11px] text-amber-800/62 dark:text-stone-500">
                {t(paceSummaryKey(option))}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="text-pretty text-[11px] leading-relaxed text-amber-800/58 dark:text-stone-500">
        {t("pages.read.ntDeepRepeatPaceFirstSegmentNote", {
          days: String(firstDays),
          endDate: formatEndDate(firstEnd, locale),
        })}
      </p>

      <div className="overflow-hidden rounded-lg border border-amber-900/10 dark:border-stone-600/25">
        <p className="border-b border-amber-900/8 bg-amber-50/40 px-3 py-2 text-[11px] font-medium text-amber-900/72 dark:border-stone-600/20 dark:bg-stone-900/35 dark:text-stone-400">
          {t("pages.read.ntDeepRepeatPaceTimelineHeader")}
        </p>
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-amber-900/8 text-[11px] text-amber-800/55 dark:border-stone-600/20 dark:text-stone-500">
              <th className="px-3 py-2 font-medium">{t("pages.read.ntDeepRepeatPaceTimelinePass")}</th>
              <th className="px-3 py-2 font-medium">{t("pages.read.ntDeepRepeatPaceTimelineDuration")}</th>
            </tr>
          </thead>
          <tbody>
            {timeline.passRows.map((row) => (
              <tr
                key={row.depthDays}
                className="border-b border-amber-900/6 last:border-b-0 dark:border-stone-600/15"
              >
                <td className="px-3 py-2 text-amber-950 dark:text-stone-200">
                  {t(paceSummaryKey(row.depthDays))}
                </td>
                <td className="px-3 py-2 tabular-nums text-amber-900/80 dark:text-stone-400">
                  {formatDuration(row.days, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-amber-900/8 px-3 py-2 text-[11px] text-amber-800/55 dark:border-stone-600/20 dark:text-stone-500">
          {t("pages.read.ntDeepRepeatPaceOtNote", {
            years: timeline.otPassApproxYears.toFixed(1),
          })}
        </p>
      </div>
    </section>
  );
}
