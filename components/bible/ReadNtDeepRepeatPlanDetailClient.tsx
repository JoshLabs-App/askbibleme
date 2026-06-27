"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadPlanActivateControl } from "@/components/bible/ReadPlanActivateControl";
import { formatReadingPlanRange, readingPlanChapterHref } from "@/lib/bible/reading-plans/format-reading-range";
import {
  NT_DEEP_REPEAT_CURRICULUM,
  ntDeepRepeatSegmentKey,
  ntDeepRepeatSegmentPrimaryRange,
} from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import { ntDeepRepeatOneCycleDays } from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { formatNtDeepRepeatSegmentStageRange } from "@/lib/bible/reading-plans/nt-deep-repeat-segment-display";
import {
  NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG,
  NT_DEEP_REPEAT_PLAN_DAY_COUNT,
  NT_DEEP_REPEAT_PLAN_ID,
} from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { TRIPLE_LOOP_PLAN_ID } from "@/lib/bible/reading-plans/triple-loop-plan";
import { exploreArticleHref } from "@/lib/explore/explore-featured-article-slugs";
import {
  currentNtDeepRepeatSegment,
  resolveNtDeepRepeatSegmentDayTarget,
} from "@/lib/bible/reading-plans/nt-deep-repeat-reading";
import { resolveEffectiveEpochDay } from "@/lib/read/reading-plan-ahead";
import {
  getEffectiveReadingPlanPrefsServerSnapshot,
  getEffectiveReadingPlanPrefsSnapshot,
  subscribeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import {
  getNtDeepRepeatProgressServerSnapshot,
  getNtDeepRepeatProgressSnapshot,
  hasUserNtDeepRepeatProgress,
  resetNtDeepRepeatProgress,
  subscribeNtDeepRepeatProgress,
} from "@/lib/read/nt-deep-repeat-progress";

function planFieldKey(field: "title" | "subtitle" | "blurb"): string {
  return `pages.read.plansCatalog.${NT_DEEP_REPEAT_PLAN_ID}.${field}`;
}

export function ReadNtDeepRepeatPlanDetailClient() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const progress = useSyncExternalStore(
    subscribeNtDeepRepeatProgress,
    getNtDeepRepeatProgressSnapshot,
    getNtDeepRepeatProgressServerSnapshot,
  );
  const prefs = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getEffectiveReadingPlanPrefsSnapshot,
    getEffectiveReadingPlanPrefsServerSnapshot,
  );
  const planDay = resolveEffectiveEpochDay(prefs);

  const title = t(planFieldKey("title"));
  const subtitle = t(planFieldKey("subtitle"));
  const blurb = t(planFieldKey("blurb"));
  const subLang = locale === "en" ? "zh-CN" : "en";
  const ntSegment = currentNtDeepRepeatSegment(progress);
  const stageCount = NT_DEEP_REPEAT_CURRICULUM.length;
  const segmentTotal = resolveNtDeepRepeatSegmentDayTarget(progress);
  const cycleDays = ntDeepRepeatOneCycleDays(
    progress.pace,
    progress.startedAt ? new Date(`${progress.startedAt}T12:00:00`) : new Date(),
  );

  return (
    <div className="read-plans-root mx-auto w-full max-w-lg px-3 pb-12 pt-6 sm:px-4 sm:pt-8">
      <p className="mb-4 text-[11px] font-medium tracking-[0.12em] text-amber-900/55 dark:text-stone-500">
        <Link
          href="/read/plans"
          className="text-amber-900/72 underline decoration-amber-800/25 underline-offset-[0.2em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
        >
          {t("pages.read.planDetailBackPlans")}
        </Link>
        <span className="mx-2 text-amber-800/35 dark:text-stone-600">·</span>
        <Link
          href="/read"
          className="text-amber-900/72 underline decoration-amber-800/25 underline-offset-[0.2em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
        >
          {t("pages.read.catalogBack")}
        </Link>
      </p>

      <header className="border-b border-amber-900/10 pb-5 dark:border-stone-600/25">
        <h1 className="text-balance text-[1.5rem] font-semibold tracking-tight text-amber-950 dark:text-stone-50 sm:text-[1.65rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-pretty text-[0.9rem] text-amber-800/72 dark:text-stone-400" lang={subLang}>
            {subtitle}
          </p>
        ) : null}
        {blurb ? (
          <p className="mt-4 text-pretty text-[0.875rem] leading-relaxed text-amber-900/80 dark:text-stone-300">{blurb}</p>
        ) : null}
        <ReadPlanActivateControl planId={NT_DEEP_REPEAT_PLAN_ID} dayCount={NT_DEEP_REPEAT_PLAN_DAY_COUNT} />
        <p className="mt-3 text-pretty text-[11px] leading-relaxed text-amber-800/55 dark:text-stone-500">
          {t("pages.read.ntDeepRepeatStartNote")}{" "}
          {t("pages.read.todayPlanDayMeta", { n: String(planDay) })}
        </p>
        <p className="mt-2 text-center">
          <Link
            href={exploreArticleHref(NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG)}
            className="text-[12px] font-medium text-amber-800/70 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
          >
            {t("pages.read.ntDeepRepeatWhyArticleLink")} →
          </Link>
        </p>
      </header>

      <section
        className="mt-6 rounded-xl border border-amber-900/10 bg-amber-50/35 px-4 py-4 dark:border-stone-600/25 dark:bg-stone-900/30"
        aria-labelledby="nt-deep-repeat-lighter-path-heading"
      >
        <h2
          id="nt-deep-repeat-lighter-path-heading"
          className="text-[11px] font-semibold tracking-[0.12em] text-amber-900/72 dark:text-stone-400"
        >
          {t("pages.read.ntDeepRepeatLighterPathTitle")}
        </h2>
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-amber-900/78 dark:text-stone-400">
          {t("pages.read.ntDeepRepeatLighterPathLead")}
        </p>
        <p className="mt-3 text-center">
          <Link
            href={`/read/plans/${TRIPLE_LOOP_PLAN_ID}`}
            className="text-[12px] font-medium text-amber-800/70 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
          >
            {t("pages.read.ntDeepRepeatLighterPathLink")} →
          </Link>
        </p>
      </section>

      <section className="mt-6" aria-labelledby="nt-deep-repeat-today-heading">
        <h2
          id="nt-deep-repeat-today-heading"
          className="text-[12px] font-semibold tracking-[0.14em] text-amber-900/72 dark:text-stone-400"
        >
          {t("pages.read.ntDeepRepeatTodayTitle")}
        </h2>
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-amber-900/75 dark:text-stone-400">
          {t("pages.read.ntDeepRepeatTodaySummary")}
        </p>
        <ul className="mt-4 flex flex-col gap-3 border-l border-amber-900/12 pl-3 dark:border-stone-600/30">
          {ntSegment ? (
            <li className="text-[13px] leading-snug">
              <span className="block text-[11px] font-medium text-amber-800/65 dark:text-stone-500">
                {t("pages.read.ntDeepRepeatTrackNt")}
              </span>
              {ntSegment.ranges.map((range) => (
                <Link
                  key={`${range.bookId}:${range.startChapter}-${range.endChapter}`}
                  href={readingPlanChapterHref(range.bookId, range.startChapter)}
                  className="mt-0.5 block font-medium text-amber-950 underline decoration-amber-800/25 underline-offset-[0.15em] hover:decoration-amber-800/50 dark:text-stone-100"
                >
                  {formatReadingPlanRange({
                    bookId: range.bookId,
                    startChapter: range.startChapter,
                    endChapter: range.endChapter,
                    label: "",
                    planChapterTotal: 1,
                  })}
                </Link>
              ))}
              <span className="mt-0.5 block text-[11px] text-amber-800/48 dark:text-stone-500">
                {t("pages.read.ntDeepRepeatStageCurrent", {
                  day: String(progress.dayInSegment),
                  total: String(segmentTotal),
                })}
              </span>
            </li>
          ) : null}
          <li className="text-[13px] leading-snug">
            <span className="block text-[11px] font-medium text-amber-800/65 dark:text-stone-500">
              {t("pages.read.ntDeepRepeatTrackOt")}
            </span>
            <Link
              href={readingPlanChapterHref(progress.ot.bookId, progress.ot.chapter)}
              className="mt-0.5 inline-block font-medium text-amber-950 underline decoration-amber-800/25 underline-offset-[0.15em] hover:decoration-amber-800/50 dark:text-stone-100"
            >
              {formatReadingPlanRange({
                bookId: progress.ot.bookId,
                startChapter: progress.ot.chapter,
                endChapter: progress.ot.chapter,
                label: "",
                planChapterTotal: 1,
              })}
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="nt-deep-repeat-ladder-heading">
        <h2
          id="nt-deep-repeat-ladder-heading"
          className="text-[12px] font-semibold tracking-[0.14em] text-amber-900/72 dark:text-stone-400"
        >
          {t("pages.read.ntDeepRepeatLadderTitle")}
        </h2>
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-amber-900/75 dark:text-stone-400">
          {t("pages.read.ntDeepRepeatLadderLead", {
            stages: String(stageCount),
            days: String(progress.pace),
            cycle: String(cycleDays),
          })}
        </p>
        <ol className="mt-4 overflow-hidden rounded-xl border border-amber-900/10 dark:border-stone-600/25">
          {NT_DEEP_REPEAT_CURRICULUM.map((segment, index) => {
            const isCurrent = index === progress.curriculumIndex;
            const isDone = index < progress.curriculumIndex;
            const primary = ntDeepRepeatSegmentPrimaryRange(segment);
            return (
              <li
                key={ntDeepRepeatSegmentKey(segment)}
                className={`flex gap-3 border-b border-amber-900/8 px-3 py-2.5 last:border-b-0 dark:border-stone-600/20 ${
                  isCurrent ? "bg-amber-50/70 dark:bg-stone-900/45" : isDone ? "opacity-75" : ""
                }`}
              >
                <span
                  className={`w-14 shrink-0 pt-0.5 text-[11px] font-semibold tabular-nums ${
                    isCurrent ? "text-amber-950 dark:text-stone-100" : "text-amber-800/55 dark:text-stone-500"
                  }`}
                >
                  {t("pages.read.ntDeepRepeatStageLabel", { n: String(index + 1) })}
                </span>
                <div className="min-w-0 flex-1">
                  {isCurrent ? (
                    <Link
                      href={readingPlanChapterHref(primary.bookId, primary.startChapter)}
                      className="text-[13px] font-medium text-amber-950 underline decoration-amber-800/25 underline-offset-[0.12em] dark:text-stone-100"
                    >
                      {formatNtDeepRepeatSegmentStageRange(segment, locale)}
                    </Link>
                  ) : (
                    <span className="text-[13px] text-amber-900/78 dark:text-stone-400">
                      {formatNtDeepRepeatSegmentStageRange(segment, locale)}
                    </span>
                  )}
                  {isCurrent ? (
                    <p className="mt-0.5 text-[11px] text-amber-800/55 dark:text-stone-500">
                      {t("pages.read.ntDeepRepeatStageCurrent", {
                        day: String(progress.dayInSegment),
                        total: String(segmentTotal),
                      })}
                    </p>
                  ) : isDone ? (
                    <p className="mt-0.5 text-[11px] text-amber-800/45 dark:text-stone-600">
                      {t("pages.read.ntDeepRepeatStageDone")}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-8 rounded-xl border border-amber-900/10 bg-amber-50/35 px-4 py-4 dark:border-stone-600/25 dark:bg-stone-900/30">
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-amber-900/72 dark:text-stone-400">
          {t("pages.read.ntDeepRepeatPrinciplesTitle")}
        </h3>
        <ul className="mt-3 list-disc space-y-2 ps-4 text-[12px] leading-relaxed text-amber-900/78 dark:text-stone-400">
          <li>{t("pages.read.ntDeepRepeatPrinciple1")}</li>
          <li>{t("pages.read.ntDeepRepeatPrinciple2")}</li>
          <li>{t("pages.read.ntDeepRepeatPrinciple3")}</li>
        </ul>
        <p className="mt-3">
          <Link
            href={exploreArticleHref(NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG)}
            className="text-[12px] font-medium text-amber-800/70 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
          >
            {t("pages.read.ntDeepRepeatWhyArticleLink")} →
          </Link>
        </p>
        {hasUserNtDeepRepeatProgress() ? (
          <button
            type="button"
            disabled={resetting}
            onClick={() => {
              setResetting(true);
              try {
                resetNtDeepRepeatProgress();
                router.refresh();
              } finally {
                setResetting(false);
              }
            }}
            className="mt-4 text-[12px] font-medium text-amber-800/70 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 disabled:opacity-60 dark:text-stone-400"
          >
            {t("pages.read.tripleLoopResetToDefault")}
          </button>
        ) : null}
      </section>
    </div>
  );
}
