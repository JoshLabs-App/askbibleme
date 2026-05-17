"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatReadingPlanRange, readingPlanChapterHref } from "@/lib/bible/reading-plans/format-reading-range";
import { stripReadingPlanHtml } from "@/lib/bible/reading-plans/strip-html-description";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import type { ReadingPlanBundle, ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import { ReadPlanActivateControl } from "@/components/bible/ReadPlanActivateControl";
import {
  getEffectiveReadingPlanPrefsServerSnapshot,
  getEffectiveReadingPlanPrefsSnapshot,
  resolveReadingPlanDayIndex,
  subscribeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import { useSyncExternalStore } from "react";

function planFieldKey(planId: string, field: "title" | "subtitle" | "blurb"): string {
  return `pages.read.plansCatalog.${planId}.${field}`;
}

/** Returns empty string when the key is missing in all locale fallbacks (translate returns path). */
function trPlanField(t: (path: string, vars?: Record<string, string>) => string, planId: string, field: "title" | "subtitle" | "blurb"): string {
  const key = planFieldKey(planId, field);
  const v = t(key);
  return v === key ? "" : v;
}

type ListProps = {
  plans: ReadingPlanRegistryEntry[];
};

export function ReadPlansPageClient({ plans }: ListProps) {
  const { t, locale } = useLocale();
  return (
    <div className="read-plans-root mx-auto w-full max-w-lg px-3 pb-10 pt-6 sm:px-4 sm:pt-8">
      <p className="mb-4 text-[11px] font-medium tracking-[0.12em] text-amber-900/55 dark:text-stone-500">
        <Link
          href="/read"
          className="text-amber-900/72 underline decoration-amber-800/25 underline-offset-[0.2em] hover:text-amber-950 dark:text-stone-400 dark:hover:text-stone-200"
        >
          {t("pages.read.catalogBack")}
        </Link>
      </p>
      <header className="text-center">
        <h1 className="text-balance text-[1.65rem] font-semibold tracking-tight text-amber-950 dark:text-stone-50 sm:text-[1.85rem]">
          {t("pages.read.plansTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-[0.9rem] leading-relaxed text-amber-900/78 dark:text-stone-400">
          {t("pages.read.plansLead")}
        </p>
      </header>

      {plans.length === 0 ? (
        <p className="mt-10 text-center text-sm text-amber-900/70 dark:text-stone-400">{t("pages.read.plansEmpty")}</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3 sm:mt-10 sm:gap-3.5">
          {plans.map((p) => {
            const titleZhOrEn = trPlanField(t, p.planId, "title") || p.name;
            const subtitleOther = trPlanField(t, p.planId, "subtitle");
            const blurb = trPlanField(t, p.planId, "blurb");
            const subLang = locale === "en" ? "zh-CN" : "en";
            return (
              <li key={p.planId}>
                <Link
                  href={`/read/plans/${encodeURIComponent(p.planId)}`}
                  className="block rounded-xl border border-amber-900/10 bg-amber-50/40 px-4 py-3.5 transition hover:border-amber-900/18 hover:bg-amber-50/70 dark:border-stone-600/25 dark:bg-stone-900/30 dark:hover:border-stone-500/40 dark:hover:bg-stone-900/45"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-medium text-amber-950 dark:text-stone-100">{titleZhOrEn}</div>
                      {subtitleOther ? (
                        <p
                          className="mt-0.5 text-[12px] font-normal leading-snug text-amber-800/65 dark:text-stone-400"
                          lang={subLang}
                        >
                          {subtitleOther}
                        </p>
                      ) : null}
                      {blurb ? (
                        <p className="mt-2 text-[12px] leading-snug text-amber-900/72 dark:text-stone-400">{blurb}</p>
                      ) : p.description ? (
                        <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-amber-900/62 dark:text-stone-400">
                          {stripReadingPlanHtml(p.description)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] tabular-nums tracking-wide text-amber-800/55 dark:text-stone-500">
                        {isTripleLoopPlanId(p.planId)
                          ? t("pages.read.tripleLoopPlansMeta")
                          : t("pages.read.plansMeta", { days: String(p.dayCount), max: String(p.maxReadingsPerDay) })}
                      </p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-[11px] font-medium text-amber-800/60 dark:text-stone-400">
                      {t("pages.read.plansOpen")}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type DetailProps = {
  bundle: ReadingPlanBundle;
};

export function ReadPlanDetailClient({ bundle }: DetailProps) {
  const { t, locale } = useLocale();
  const prefs = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getEffectiveReadingPlanPrefsSnapshot,
    getEffectiveReadingPlanPrefsServerSnapshot,
  );
  const title = trPlanField(t, bundle.planId, "title") || bundle.name;
  const subtitle = trPlanField(t, bundle.planId, "subtitle");
  const blurb = trPlanField(t, bundle.planId, "blurb");
  const subLang = locale === "en" ? "zh-CN" : "en";
  const strippedDesc = bundle.description ? stripReadingPlanHtml(bundle.description) : "";
  const todayIndex =
    prefs.planId === bundle.planId ? resolveReadingPlanDayIndex(prefs, bundle.days.length) : null;

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
        {strippedDesc ? (
          <p className="mt-3 text-pretty text-[11px] leading-relaxed text-amber-800/55 dark:text-stone-500" lang="en">
            {strippedDesc}
          </p>
        ) : null}
        <p className="mt-3 text-[11px] leading-relaxed text-amber-800/55 dark:text-stone-500">{t("pages.read.planDetailHint")}</p>
        <ReadPlanActivateControl planId={bundle.planId} dayCount={bundle.days.length} />
      </header>

      <ol className="mt-6 flex list-none flex-col gap-5 sm:mt-8 sm:gap-6">
        {bundle.days.map((day) => {
          const isToday = todayIndex === day.dayIndex;
          return (
          <li
            key={day.dayIndex}
            id={isToday ? "read-plan-today" : undefined}
            className={`scroll-mt-4 ${isToday ? "rounded-lg bg-amber-100/45 px-2 py-2 -mx-2 dark:bg-stone-800/40" : ""}`}
          >
            <h2 className="text-[12px] font-semibold tracking-[0.14em] text-amber-900/72 dark:text-stone-400">
              {t("pages.read.planDetailDay", { n: String(day.dayIndex + 1) })}
              {isToday ? (
                <span className="ml-2 font-normal tracking-normal text-amber-800/70 dark:text-stone-400">
                  {t("pages.read.planDetailTodayMark")}
                </span>
              ) : null}
            </h2>
            <ul className="mt-2 flex flex-col gap-1.5 border-l border-amber-900/12 pl-3 dark:border-stone-600/30">
              {day.readings.map((r, idx) => (
                <li key={`${day.dayIndex}-${idx}`} className="text-[13px] leading-snug">
                  <Link
                    href={readingPlanChapterHref(r.bookId, r.startChapter)}
                    className="font-medium text-amber-950 underline decoration-amber-800/25 underline-offset-[0.15em] hover:decoration-amber-800/50 dark:text-stone-100 dark:decoration-stone-500/35 dark:hover:decoration-stone-400/55"
                  >
                    {formatReadingPlanRange(r)}
                  </Link>
                  <span className="mt-0.5 block text-[11px] text-amber-800/48 dark:text-stone-500" lang="en">
                    {r.label}
                  </span>
                </li>
              ))}
            </ul>
          </li>
          );
        })}
      </ol>
    </div>
  );
}
