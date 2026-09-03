"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadPlanActivateControl } from "@/components/bible/ReadPlanActivateControl";
import { formatReadingPlanRange, readingPlanChapterHref } from "@/lib/bible/reading-plans/format-reading-range";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import {
  type TripleLoopTrack,
} from "@/lib/bible/reading-plans/triple-loop-reading";
import {
  NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG,
  NT_DEEP_REPEAT_PLAN_ID,
} from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { TRIPLE_LOOP_EXPLORE_ARTICLE_SLUG, TRIPLE_LOOP_PLAN_DAY_COUNT, TRIPLE_LOOP_PLAN_ID } from "@/lib/bible/reading-plans/triple-loop-plan";
import { exploreArticleHref } from "@/lib/explore/explore-featured-article-slugs";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import {
  getTripleLoopProgressServerSnapshot,
  getTripleLoopProgressSnapshot,
  hasUserTripleLoopProgress,
  subscribeTripleLoopProgress,
} from "@/lib/read/triple-loop-progress";
import { resetTripleLoopPlanToEasterDefault } from "@/lib/read/triple-loop-plan-sync";

const TRACKS: TripleLoopTrack[] = ["ot", "nt", "wisdom"];

function planFieldKey(field: "title" | "subtitle" | "blurb"): string {
  return `pages.read.plansCatalog.${TRIPLE_LOOP_PLAN_ID}.${field}`;
}

const TRACK_TITLE_KEY: Record<TripleLoopTrack, string> = {
  ot: "pages.read.tripleLoopTrackOt",
  nt: "pages.read.tripleLoopTrackNt",
  wisdom: "pages.read.tripleLoopTrackWisdom",
};

export function ReadTripleLoopPlanDetailClient() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const progress = useSyncExternalStore(
    subscribeTripleLoopProgress,
    getTripleLoopProgressSnapshot,
    getTripleLoopProgressServerSnapshot,
  );

  const title = t(planFieldKey("title"));
  const subtitle = t(planFieldKey("subtitle"));
  const blurb = t(planFieldKey("blurb"));
  const subLang = locale === "en" ? "zh-CN" : "en";

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
        <ReadPlanActivateControl planId={TRIPLE_LOOP_PLAN_ID} dayCount={TRIPLE_LOOP_PLAN_DAY_COUNT} />
        <p className="mt-3 text-pretty text-[11px] leading-relaxed text-amber-800/55 dark:text-stone-500">
          {t("pages.read.tripleLoopEpochNote")} {t("pages.read.todayPlanDayMeta", { n: String(getReadingPlanDaySinceEpoch()) })}
        </p>
        <p className="mt-2 text-center">
          <Link
            href={exploreArticleHref(TRIPLE_LOOP_EXPLORE_ARTICLE_SLUG)}
            className="text-[12px] font-medium text-amber-800/70 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
          >
            {t("pages.read.tripleLoopWhyArticleLink")} →
          </Link>
        </p>
      </header>

      <section className="mt-6" aria-labelledby="triple-loop-today-heading">
        <h2
          id="triple-loop-today-heading"
          className="text-[12px] font-semibold tracking-[0.14em] text-amber-900/72 dark:text-stone-400"
        >
          {t("pages.read.tripleLoopTodayTitle")}
        </h2>
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-amber-900/75 dark:text-stone-400">
          {t("pages.read.tripleLoopTodaySummary")}
        </p>
        <ul className="mt-4 flex flex-col gap-3 border-l border-amber-900/12 pl-3 dark:border-stone-600/30">
          {TRACKS.map((track) => {
            const ptr = progress[track];
            const range = {
              bookId: ptr.bookId,
              startChapter: ptr.chapter,
              endChapter: ptr.chapter,
              label: "",
              planChapterTotal: 1,
            };
            return (
              <li key={track} className="text-[13px] leading-snug">
                <span className="block text-[11px] font-medium text-amber-800/65 dark:text-stone-500">
                  {t(TRACK_TITLE_KEY[track])}
                </span>
                <Link
                  href={readingPlanChapterHref(ptr.bookId, ptr.chapter)}
                  className="mt-0.5 inline-block font-medium text-amber-950 underline decoration-amber-800/25 underline-offset-[0.15em] hover:decoration-amber-800/50 dark:text-stone-100 dark:decoration-stone-500/35"
                >
                  {formatReadingPlanRange(range, locale)}
                </Link>
                <span className="mt-0.5 block text-[11px] text-amber-800/48 dark:text-stone-500">
                  {t("pages.read.tripleLoopReadingLine", {
                    name: getScriptureBookDisplayName(ptr.bookId, locale),
                    chapter: String(ptr.chapter),
                    unit: t(
                      ptr.bookId === "PSA"
                        ? "pages.read.tripleLoopPsalmUnit"
                        : "pages.read.tripleLoopChapterUnit",
                    ),
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className="mt-8 rounded-xl border border-amber-900/10 bg-amber-50/35 px-4 py-4 dark:border-stone-600/25 dark:bg-stone-900/30"
        aria-labelledby="triple-loop-deep-read-heading"
      >
        <h2
          id="triple-loop-deep-read-heading"
          className="text-[11px] font-semibold tracking-[0.12em] text-amber-900/72 dark:text-stone-400"
        >
          {t("pages.read.tripleLoopDeepReadTitle")}
        </h2>
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-amber-900/78 dark:text-stone-400">
          {t("pages.read.tripleLoopDeepReadLead")}
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[12px]">
          <Link
            href={`/read/plans/${NT_DEEP_REPEAT_PLAN_ID}`}
            className="font-medium text-amber-950 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 dark:text-stone-100"
          >
            {t("pages.read.tripleLoopDeepReadPlanLink")} →
          </Link>
          <span className="text-amber-800/35 dark:text-stone-600">·</span>
          <Link
            href={exploreArticleHref(NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG)}
            className="font-medium text-amber-800/70 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
          >
            {t("pages.read.tripleLoopDeepReadArticleLink")} →
          </Link>
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-amber-900/10 bg-amber-50/35 px-4 py-4 dark:border-stone-600/25 dark:bg-stone-900/30">
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-amber-900/72 dark:text-stone-400">
          {t("pages.read.tripleLoopPrinciplesTitle")}
        </h3>
        <ul className="mt-3 list-disc space-y-2 ps-4 text-[12px] leading-relaxed text-amber-900/78 dark:text-stone-400">
          <li>{t("pages.read.tripleLoopPrinciple1")}</li>
          <li>{t("pages.read.tripleLoopPrinciple2")}</li>
          <li>{t("pages.read.tripleLoopPrinciple3")}</li>
        </ul>
        <p className="mt-3">
          <Link
            href={exploreArticleHref(TRIPLE_LOOP_EXPLORE_ARTICLE_SLUG)}
            className="text-[12px] font-medium text-amber-800/70 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
          >
            {t("pages.read.tripleLoopWhyArticleLink")} →
          </Link>
        </p>
        {hasUserTripleLoopProgress() ? (
          <button
            type="button"
            disabled={resetting}
            onClick={() => {
              setResetting(true);
              try {
                resetTripleLoopPlanToEasterDefault();
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
