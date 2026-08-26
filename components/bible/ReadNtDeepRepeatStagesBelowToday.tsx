"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  NT_DEEP_REPEAT_CURRICULUM,
  ntDeepRepeatSegmentKey,
} from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import { ntDeepRepeatOneCycleDays } from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { formatNtDeepRepeatSegmentStageRange } from "@/lib/bible/reading-plans/nt-deep-repeat-segment-display";
import {
  getNtDeepRepeatProgressServerSnapshot,
  getNtDeepRepeatProgressSnapshot,
  setNtDeepRepeatCurriculumStageAsToday,
  subscribeNtDeepRepeatProgress,
} from "@/lib/read/nt-deep-repeat-progress";

type Props = {
  onStageSet?: () => void;
};

function fmt(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{{${k}}}`, v),
    template,
  );
}

/** 深度读经：今日列表下方的 52 版块（对齐 App）。 */
export function ReadNtDeepRepeatStagesBelowToday({ onStageSet }: Props) {
  const { t, locale } = useLocale();
  const progress = useSyncExternalStore(
    subscribeNtDeepRepeatProgress,
    getNtDeepRepeatProgressSnapshot,
    getNtDeepRepeatProgressServerSnapshot,
  );
  const [busyIndex, setBusyIndex] = useState<number | null>(null);

  const stageCount = NT_DEEP_REPEAT_CURRICULUM.length;
  const cycleDays = ntDeepRepeatOneCycleDays(
    progress.pace,
    progress.startedAt ? new Date(`${progress.startedAt}T12:00:00`) : new Date(),
  );

  const applyStage = useCallback(
    async (index: number) => {
      if (busyIndex != null) return;
      setBusyIndex(index);
      try {
        setNtDeepRepeatCurriculumStageAsToday(index);
        onStageSet?.();
      } finally {
        setBusyIndex(null);
      }
    },
    [busyIndex, onStageSet],
  );

  const onPressStage = useCallback(
    (index: number, rangeLabel: string) => {
      if (index === progress.curriculumIndex) return;
      const body = fmt(t("pages.read.ntDeepRepeatSetStageAsTodayBody"), {
        n: String(index + 1),
        range: rangeLabel,
      });
      if (!window.confirm(`${t("pages.read.ntDeepRepeatSetStageAsTodayTitle")}\n\n${body}`)) return;
      void applyStage(index);
    },
    [applyStage, progress.curriculumIndex, t],
  );

  return (
    <section className="read-plan-play-ndr-stages mt-7 mb-3">
      <h3 className="text-lg font-semibold tracking-wide text-[var(--bc-read-book)]">
        {t("pages.read.ntDeepRepeatLadderTitle")}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--bc-read-muted)]">
        {fmt(t("pages.read.ntDeepRepeatLadderLead"), {
          stages: String(stageCount),
          days: String(progress.pace),
          cycle: String(cycleDays),
        })}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--bc-read-faint,rgba(61,46,36,0.45))]">
        {t("pages.read.ntDeepRepeatStagesBelowHint")}
      </p>
      <ul className="read-plan-play-ndr-stages__list mt-3 overflow-hidden rounded-xl border border-[var(--bc-read-border,rgba(92,64,48,0.14))]">
        {NT_DEEP_REPEAT_CURRICULUM.map((segment, index) => {
          const isCurrent = index === progress.curriculumIndex;
          const rangeLabel = formatNtDeepRepeatSegmentStageRange(segment, locale);
          const busy = busyIndex === index;
          return (
            <li key={ntDeepRepeatSegmentKey(segment)}>
              <button
                type="button"
                disabled={busy || busyIndex != null}
                className={[
                  "read-plan-play-ndr-stages__row flex w-full items-start gap-3 border-b border-[var(--bc-read-border,rgba(92,64,48,0.14))] px-3.5 py-3.5 text-left last:border-b-0",
                  isCurrent ? "read-plan-play-ndr-stages__row--current" : "bg-[rgba(255,252,245,0.35)]",
                  busy ? "opacity-60" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={isCurrent}
                onClick={() => onPressStage(index, rangeLabel)}
              >
                <span
                  className={[
                    "w-16 shrink-0 pt-0.5 text-[15px] font-semibold",
                    isCurrent ? "text-[var(--bc-read-book)]" : "text-[var(--bc-read-faint,rgba(61,46,36,0.45))]",
                  ].join(" ")}
                >
                  {fmt(t("pages.read.ntDeepRepeatStageLabel"), { n: String(index + 1) })}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      "block text-lg leading-relaxed",
                      isCurrent ? "font-semibold text-[var(--bc-read-book)]" : "text-[var(--bc-read-muted)]",
                    ].join(" ")}
                  >
                    {rangeLabel}
                  </span>
                  {isCurrent ? (
                    <span className="mt-1 block text-sm text-[var(--bc-read-muted)]">
                      {fmt(t("pages.read.ntDeepRepeatStageCurrent"), {
                        day: String(progress.dayInSegment),
                        total: String(progress.segmentDayTarget || progress.pace),
                      })}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
