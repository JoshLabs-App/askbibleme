"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReadTodayPlanReadingRow } from "@/components/bible/ReadTodayPlanReadingRow";
import { ReadTodayReadingStats } from "@/components/bible/ReadTodayReadingStats";
import { ReadYearDayTimeline } from "@/components/bible/ReadYearDayTimeline";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadingHabitStats } from "@/hooks/useReadingHabitStats";
import { useTodayReadingChapterFractions } from "@/hooks/useTodayReadingChapterFractions";
import { useTodayReadingDone } from "@/hooks/useTodayReadingDone";
import { planTitleKey, useTodayReadingPlan, type TodayReadingPlanState } from "@/hooks/useTodayReadingPlan";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import { READ_PARCHMENT_FAINT, READ_PARCHMENT_MUTED } from "@/lib/read/read-parchment-accents";
import { TODAY_READING_AUTO_DONE_FRACTION } from "@/lib/read/today-reading-chapter-fraction";
import {
  readCompletedChapterKeySet,
  subscribeReadChapterCompletion,
} from "@/lib/read/read-chapter-completion";
import { todayReadingItemKey } from "@/lib/read/today-reading-done";

type ReadingsProps = {
  plan: TodayReadingPlanState;
};

export function ReadTodayPlanReadings({ plan }: ReadingsProps) {
  const { t } = useLocale();
  const { payload, loading, isTripleLoop } = plan;
  const { isDone, allDone, toggleDone } = useTodayReadingDone(plan);
  const { fractions } = useTodayReadingChapterFractions(plan);
  const { yearDay, snapshot, syncTodayComplete } = useReadingHabitStats();
  const readings = payload?.day?.readings ?? [];
  const [completedChapterKeys, setCompletedChapterKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const reload = () => setCompletedChapterKeys(readCompletedChapterKeySet());
    reload();
    return subscribeReadChapterCompletion(reload);
  }, []);

  const chapterCompletionProgress = useMemo(() => {
    const progressByItem = new Map<string, number>();
    if (isTripleLoop) return progressByItem;
    for (const r of readings) {
      const start = Math.max(1, Math.trunc(r.startChapter));
      const end = Math.max(start, Math.trunc(r.endChapter));
      const total = end - start + 1;
      let completed = 0;
      for (let ch = start; ch <= end; ch += 1) {
        if (completedChapterKeys.has(`${r.bookId}:${ch}`)) completed += 1;
      }
      progressByItem.set(todayReadingItemKey(r), total > 0 ? completed / total : 0);
    }
    return progressByItem;
  }, [completedChapterKeys, isTripleLoop, readings]);

  const isReadingDone = useMemo(() => {
    const doneByItem = new Map<string, boolean>();
    for (const r of readings) {
      const itemKey = todayReadingItemKey(r);
      doneByItem.set(
        itemKey,
        isTripleLoop
          ? isDone(r) || (fractions[itemKey] ?? 0) >= TODAY_READING_AUTO_DONE_FRACTION
          : (chapterCompletionProgress.get(itemKey) ?? 0) >= 1,
      );
    }
    return doneByItem;
  }, [chapterCompletionProgress, fractions, isDone, isTripleLoop, readings]);

  const todayAllDone = useMemo(
    () =>
      !loading &&
      readings.length > 0 &&
      (isTripleLoop
        ? allDone(readings)
        : readings.every((r) => (chapterCompletionProgress.get(todayReadingItemKey(r)) ?? 0) >= 1)),
    [loading, readings, isTripleLoop, allDone, chapterCompletionProgress],
  );

  useEffect(() => {
    void syncTodayComplete(todayAllDone);
  }, [todayAllDone, syncTodayComplete]);

  return (
    <div className="read-bible-today-readings mx-auto w-full max-w-[340px]">
      <ReadYearDayTimeline />
      <ReadTodayReadingStats yearDay={yearDay} snapshot={snapshot} />

      {loading ? (
        <p className="mt-2 text-[12px] text-amber-900/60 dark:text-stone-500">{t("pages.read.todayPlanLoading")}</p>
      ) : readings.length ? (
        <>
          <h2 className="read-bible-today-readings-heading">{t("pages.read.todayPlanTitle")}</h2>
          <div className="read-bible-today-readings-list mt-0.5 w-full pl-[30px]">
            {readings.map((r) => {
              const itemKey = todayReadingItemKey(r);
              const done = isReadingDone.get(itemKey) ?? false;
              return (
                <ReadTodayPlanReadingRow
                  key={itemKey}
                  reading={r}
                  done={done}
                  showCheckbox={isTripleLoop}
                  dimDoneText={isTripleLoop}
                  checkboxDisabled={!isTripleLoop}
                  onToggleDone={() => toggleDone(r)}
                />
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-amber-900/60 dark:text-stone-500">{t("pages.read.todayPlanEmpty")}</p>
      )}
    </div>
  );
}

type FooterProps = {
  plan: TodayReadingPlanState;
  variant?: "home" | "panel";
};

export function ReadTodayPlanFooter({ plan, variant = "panel" }: FooterProps) {
  const { t, locale } = useLocale();
  const { prefs, payload, loading, isTripleLoop, dayIndex, epochDay } = plan;

  const titleKey = planTitleKey(prefs.planId);
  const localizedTitle = t(titleKey);
  const planTitle = localizedTitle === titleKey ? payload?.name ?? prefs.planId : localizedTitle;
  const anchorHint =
    prefs.anchor === "calendar-jan1" ? t("pages.read.todayPlanAnchorJan1") : t("pages.read.todayPlanAnchorToday");

  if (loading) return null;

  const home = variant === "home";

  return (
    <footer
      className={
        home
          ? "read-bible-today-plan-footer read-bible-today-plan-footer--home mx-auto mt-7 max-w-[340px] px-1 pb-2 pt-5 text-center"
          : "read-bible-today-plan-footer mx-auto mt-7 max-w-md border-t border-amber-900/10 px-1 pt-5 text-center dark:border-stone-500/20"
      }
    >
      <p
        className={[
          "mx-auto max-w-[20rem] text-[15px] font-medium leading-5",
          home ? "" : "text-amber-900/72 dark:text-stone-400",
        ].join(" ")}
        style={home ? { color: READ_PARCHMENT_MUTED } : undefined}
      >
        {planTitle}
      </p>
      {isTripleLoop ? (
        <p
          className={[
            "mt-1.5 text-[12px] tabular-nums tracking-[0.04em]",
            home ? "" : "text-amber-800/58 dark:text-stone-500",
          ].join(" ")}
          style={home ? { color: READ_PARCHMENT_FAINT } : undefined}
        >
          {t("pages.read.todayPlanDayMeta", { n: String(epochDay) })}
          <span className="mx-1.5 opacity-60">·</span>
          {t("pages.read.todayPlanAnchorEaster")}
        </p>
      ) : dayIndex != null ? (
        <p
          className={[
            "mt-1.5 text-[12px] tabular-nums tracking-[0.04em]",
            home ? "" : "text-amber-800/58 dark:text-stone-500",
          ].join(" ")}
          style={home ? { color: READ_PARCHMENT_FAINT } : undefined}
        >
          {t("pages.read.todayPlanDayMeta", { n: String(dayIndex + 1) })}
          <span className="mx-1.5 opacity-60">·</span>
          {anchorHint}
        </p>
      ) : null}
      <p className="mt-2 text-[12px]">
        <Link
          href="/read/plans"
          className={
            home
              ? "font-medium no-underline hover:opacity-80"
              : "font-medium text-amber-900/78 underline decoration-amber-800/25 underline-offset-[0.2em] hover:text-amber-950 dark:text-stone-400"
          }
          style={home ? { color: READ_PARCHMENT_MUTED } : undefined}
        >
          {locale === "en"
            ? "Tap to view more plans"
            : locale === "zh-TW"
              ? "點按查看更多計畫"
              : "点击查看更多计划"}
        </Link>
      </p>
    </footer>
  );
}

type Props = {
  registryPlans: ReadingPlanRegistryEntry[];
};

export function ReadTodayPlanPanel({ registryPlans }: Props) {
  const plan = useTodayReadingPlan(registryPlans);
  const { t } = useLocale();

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
      <ReadTodayPlanReadings plan={plan} />
      <ReadTodayPlanFooter plan={plan} />
    </section>
  );
}
