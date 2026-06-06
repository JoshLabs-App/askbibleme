"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatReadingPlanRange, readingPlanChapterHref } from "@/lib/bible/reading-plans/format-reading-range";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import {
  buildReadingPlanChapterQueue,
  chapterRefKey,
  indexInReadingPlanQueue,
} from "@/lib/read/reading-plan-chapter-queue";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import {
  getEffectiveReadingPlanPrefsServerSnapshot,
  getEffectiveReadingPlanPrefsSnapshot,
  resolveReadingPlanDayIndex,
  subscribeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import {
  getTripleLoopProgressServerSnapshot,
  getTripleLoopProgressSnapshot,
  subscribeTripleLoopProgress,
} from "@/lib/read/triple-loop-progress";
import { loadTodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";

type Props = {
  bookId: string;
  chapter: number;
};

function planTitleKey(planId: string): string {
  return `pages.read.plansCatalog.${planId}.title`;
}

export function ReadChapterTodayPlanBlock({ bookId, chapter }: Props) {
  const { t } = useLocale();
  const prefs = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getEffectiveReadingPlanPrefsSnapshot,
    getEffectiveReadingPlanPrefsServerSnapshot,
  );

  const [readings, setReadings] = useState<ReadingPlanRange[] | null>(null);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState<number | null>(null);

  const isTripleLoop = isTripleLoopPlanId(prefs.planId);

  const tripleProgress = useSyncExternalStore(
    subscribeTripleLoopProgress,
    getTripleLoopProgressSnapshot,
    getTripleLoopProgressServerSnapshot,
  );
  const tripleProgressKey = isTripleLoop
    ? `${tripleProgress.ot.bookId}:${tripleProgress.ot.chapter}|${tripleProgress.nt.bookId}:${tripleProgress.nt.chapter}|${tripleProgress.wisdom.bookId}:${tripleProgress.wisdom.chapter}`
    : "";

  useEffect(() => {
    let cancelled = false;
    const dayCount = prefs.dayCount ?? 365;
    const idx = isTripleLoop ? 0 : resolveReadingPlanDayIndex(prefs, dayCount);
    void (async () => {
      const payload = await loadTodayReadingPlanPayload(prefs, { dayCount });
      if (cancelled) return;
      setDayIndex(isTripleLoop ? null : idx);
      const titleKey = planTitleKey(prefs.planId);
      const localized = t(titleKey);
      setPlanTitle(localized === titleKey ? payload?.name ?? prefs.planId : localized);
      setReadings(payload?.day?.readings ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [prefs, t, isTripleLoop, tripleProgressKey]);

  const queue = useMemo(() => (readings?.length ? buildReadingPlanChapterQueue(readings) : []), [readings]);
  const currentInQueue = indexInReadingPlanQueue(queue, bookId, chapter);

  if (!readings?.length || currentInQueue < 0) return null;

  const currentKey = chapterRefKey({ bookId, chapter });

  return (
    <section
      className="read-chapter-today-plan mt-10 border-t border-amber-900/10 pt-6 text-center dark:border-stone-600/25"
      aria-labelledby="read-chapter-today-plan-heading"
    >
      <h2
        id="read-chapter-today-plan-heading"
        className="text-[11px] font-semibold tracking-[0.18em] text-amber-900/72 dark:text-stone-400"
      >
        {t("pages.read.chapterTodayPlanTitle")}
      </h2>
      {planTitle ? (
        <p className="mx-auto mt-2 max-w-[20rem] text-pretty text-[0.875rem] font-medium text-amber-950 dark:text-stone-100">
          {planTitle}
        </p>
      ) : null}
      {isTripleLoop ? (
        <p className="mt-1 text-[11px] tabular-nums text-amber-800/58 dark:text-stone-500">
          {t("pages.read.todayPlanDayMeta", { n: String(getReadingPlanDaySinceEpoch()) })}
          <span className="mx-1.5 text-amber-800/35 dark:text-stone-600">·</span>
          {t("pages.read.todayPlanAnchorEaster")}
        </p>
      ) : dayIndex != null ? (
        <p className="mt-1 text-[11px] tabular-nums text-amber-800/58 dark:text-stone-500">
          {t("pages.read.todayPlanDayMeta", { n: String(dayIndex + 1) })}
        </p>
      ) : null}
      <p className="mx-auto mt-2 max-w-[22rem] text-pretty text-[11px] leading-relaxed text-amber-800/62 dark:text-stone-500">
        {t("pages.read.chapterTodayPlanAudioHint")}
      </p>

      <ul className="mx-auto mt-4 flex max-w-[20rem] flex-col items-center gap-2">
        {queue.map((ref) => {
          const key = chapterRefKey(ref);
          const isCurrent = key === currentKey;
          const label = formatReadingPlanRange({
            bookId: ref.bookId,
            startChapter: ref.chapter,
            endChapter: ref.chapter,
            label: "",
          });
          return (
            <li key={key} className="w-full text-[13px] leading-snug">
              <Link
                href={readingPlanChapterHref(ref.bookId, ref.chapter, true)}
                className={[
                  "font-medium underline decoration-amber-800/25 underline-offset-[0.15em] hover:decoration-amber-800/50 dark:decoration-stone-500/35",
                  isCurrent
                    ? "text-amber-950 decoration-amber-900/45 dark:text-stone-50"
                    : "text-amber-900/82 dark:text-stone-300/90",
                ].join(" ")}
                aria-current={isCurrent ? "page" : undefined}
              >
                {label}
                {isCurrent ? (
                  <span className="ms-1.5 text-[11px] font-normal text-amber-800/65 dark:text-stone-400">
                    {t("pages.read.planDetailTodayMark")}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[11px]">
        <Link
          href={`/read/plans/${encodeURIComponent(prefs.planId)}`}
          className="font-medium text-amber-900/78 underline decoration-amber-800/25 underline-offset-[0.2em] hover:text-amber-950 dark:text-stone-400"
        >
          {t("pages.read.todayPlanChange")}
        </Link>
      </p>
    </section>
  );
}
