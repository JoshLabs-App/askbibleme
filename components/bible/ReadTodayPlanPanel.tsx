"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatReadingPlanRange, readingPlanChapterHref } from "@/lib/bible/reading-plans/format-reading-range";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
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
import { loadTodayReadingPlanPayload, type TodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";

function planTitleKey(planId: string): string {
  return `pages.read.plansCatalog.${planId}.title`;
}

type DayPayload = TodayReadingPlanPayload;

type Props = {
  registryPlans: ReadingPlanRegistryEntry[];
};

export function ReadTodayPlanPanel({ registryPlans }: Props) {
  const { t } = useLocale();
  const prefs = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getEffectiveReadingPlanPrefsSnapshot,
    getEffectiveReadingPlanPrefsServerSnapshot,
  );

  const registryById = useMemo(() => new Map(registryPlans.map((p) => [p.planId, p])), [registryPlans]);

  const [payload, setPayload] = useState<DayPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const dayCount = registryById.get(prefs.planId)?.dayCount ?? prefs.dayCount;
  const dayIndex = !isTripleLoop && dayCount ? resolveReadingPlanDayIndex(prefs, dayCount) : null;

  const loadToday = useCallback(async () => {
    if (!isTripleLoop && dayIndex == null) {
      setPayload(null);
      return;
    }
    setLoading(true);
    try {
      const j = await loadTodayReadingPlanPayload(prefs, { dayCount: dayCount ?? undefined });
      setPayload(j);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [prefs, dayIndex, dayCount, isTripleLoop]);

  const tripleProgress = useSyncExternalStore(
    subscribeTripleLoopProgress,
    getTripleLoopProgressSnapshot,
    getTripleLoopProgressServerSnapshot,
  );
  const tripleProgressKey = isTripleLoop
    ? `${tripleProgress.ot.bookId}:${tripleProgress.ot.chapter}|${tripleProgress.nt.bookId}:${tripleProgress.nt.chapter}|${tripleProgress.wisdom.bookId}:${tripleProgress.wisdom.chapter}`
    : "";

  useEffect(() => {
    void loadToday();
  }, [loadToday, tripleProgressKey]);

  const titleKey = planTitleKey(prefs.planId);
  const localizedTitle = t(titleKey);
  const planTitle = localizedTitle === titleKey ? payload?.name ?? prefs.planId : localizedTitle;
  const anchorHint =
    prefs.anchor === "calendar-jan1" ? t("pages.read.todayPlanAnchorJan1") : t("pages.read.todayPlanAnchorToday");

  return (
    <section
      className="read-bible-today-plan mx-auto mt-6 w-full max-w-md shrink-0 border-t border-amber-900/10 px-1 pt-4 text-center dark:border-stone-500/20 sm:mt-7 sm:pt-5"
      aria-labelledby="read-bible-today-plan-heading"
    >
      <h2
        id="read-bible-today-plan-heading"
        className="text-[11px] font-semibold tracking-[0.18em] text-amber-900/72 dark:text-stone-400"
      >
        {t("pages.read.todayPlanTitle")}
      </h2>

      <p className="mx-auto mt-3 max-w-[20rem] text-pretty text-[0.9rem] font-medium leading-snug text-amber-950 dark:text-stone-100">
        {planTitle}
      </p>
      {isTripleLoop ? (
        <p className="mt-2 text-[11px] tabular-nums tracking-wide text-amber-800/58 dark:text-stone-500">
          {t("pages.read.todayPlanDayMeta", { n: String(getReadingPlanDaySinceEpoch()) })}
          <span className="mx-1.5 text-amber-800/35 dark:text-stone-600">·</span>
          {t("pages.read.todayPlanAnchorEaster")}
        </p>
      ) : dayIndex != null ? (
        <p className="mt-2 text-[11px] tabular-nums tracking-wide text-amber-800/58 dark:text-stone-500">
          {t("pages.read.todayPlanDayMeta", { n: String(dayIndex + 1) })}
          <span className="mx-1.5 text-amber-800/35 dark:text-stone-600">·</span>
          {anchorHint}
        </p>
      ) : null}

      <p className="mt-3 text-[11px]">
        <Link
          href={`/read/plans/${encodeURIComponent(prefs.planId)}`}
          className="font-medium text-amber-900/78 underline decoration-amber-800/25 underline-offset-[0.2em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
        >
          {t("pages.read.todayPlanChange")}
        </Link>
        <span className="mx-2 text-amber-800/35 dark:text-stone-600">·</span>
        <Link
          href="/read/plans"
          className="font-medium text-amber-900/78 underline decoration-amber-800/25 underline-offset-[0.2em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
        >
          {t("pages.read.todayPlanAllPlans")}
        </Link>
      </p>

      {loading ? (
        <p className="mt-4 text-[12px] text-amber-900/60 dark:text-stone-500">{t("pages.read.todayPlanLoading")}</p>
      ) : payload?.day?.readings.length ? (
        <ul className="mx-auto mt-4 flex max-w-[20rem] flex-col items-center gap-2.5">
          {payload.day.readings.map((r, idx) => (
            <li key={idx} className="w-full text-[13px] leading-snug">
              <Link
                href={readingPlanChapterHref(r.bookId, r.startChapter)}
                className="font-medium text-amber-950 underline decoration-amber-800/25 underline-offset-[0.15em] hover:decoration-amber-800/50 dark:text-stone-100 dark:decoration-stone-500/35"
              >
                {formatReadingPlanRange(r)}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[12px] text-amber-900/60 dark:text-stone-500">{t("pages.read.todayPlanEmpty")}</p>
      )}
    </section>
  );
}
