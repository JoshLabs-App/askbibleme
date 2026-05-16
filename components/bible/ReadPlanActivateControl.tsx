"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ReadingPlanAnchor } from "@/lib/read/reading-plan-prefs";
import {
  DEFAULT_READING_PLAN_ANCHOR,
  DEFAULT_READING_PLAN_ID,
  getReadingPlanPrefsServerSnapshot,
  getReadingPlanPrefsSnapshot,
  isImplicitDefaultReadingPlan,
  resolveEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  setActiveReadingPlan,
  subscribeReadingPlanPrefs,
  writeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";

type Props = {
  planId: string;
  dayCount: number;
};

export function ReadPlanActivateControl({ planId, dayCount }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const stored = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getReadingPlanPrefsSnapshot,
    getReadingPlanPrefsServerSnapshot,
  );

  const effective = useMemo(
    () => resolveEffectiveReadingPlanPrefs(stored, { dayCount }),
    [stored, dayCount],
  );
  const isActive = effective.planId === planId;
  const isImplicitDefault =
    planId === DEFAULT_READING_PLAN_ID && isImplicitDefaultReadingPlan(stored);
  const [anchor, setAnchor] = useState<ReadingPlanAnchor>(
    stored?.planId === planId
      ? stored.anchor
      : planId === DEFAULT_READING_PLAN_ID
        ? DEFAULT_READING_PLAN_ANCHOR
        : "from-today",
  );

  useEffect(() => {
    if (isActive) setAnchor(effective.anchor);
  }, [isActive, effective.anchor]);

  const todayDayIndex = useMemo(() => {
    if (!isActive) return null;
    return resolveReadingPlanDayIndex(effective, dayCount) + 1;
  }, [isActive, effective, dayCount]);

  const activate = () => {
    setActiveReadingPlan(planId, anchor, { dayCount });
    router.push("/read");
    router.refresh();
  };

  const clear = () => {
    writeReadingPlanPrefs(null);
    router.refresh();
  };

  return (
    <div className="mt-5 rounded-xl border border-amber-900/12 bg-amber-50/50 px-4 py-4 dark:border-stone-600/30 dark:bg-stone-900/35">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-amber-900/72 dark:text-stone-400">
        {t("pages.read.planActivateHeading")}
      </p>
      <fieldset className="mt-3 space-y-2 border-0 p-0">
        <legend className="sr-only">{t("pages.read.planActivateHeading")}</legend>
        <label className="flex cursor-pointer items-start gap-2.5 text-left text-[13px] text-amber-950 dark:text-stone-200">
          <input
            type="radio"
            name="plan-anchor"
            className="mt-0.5"
            checked={anchor === "from-today"}
            onChange={() => setAnchor("from-today")}
          />
          <span>
            <span className="font-medium">{t("pages.read.planAnchorFromToday")}</span>
            <span className="mt-0.5 block text-[11px] text-amber-800/62 dark:text-stone-500">
              {t("pages.read.planAnchorFromTodayHint")}
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-left text-[13px] text-amber-950 dark:text-stone-200">
          <input
            type="radio"
            name="plan-anchor"
            className="mt-0.5"
            checked={anchor === "calendar-jan1"}
            onChange={() => setAnchor("calendar-jan1")}
          />
          <span>
            <span className="font-medium">{t("pages.read.planAnchorJan1")}</span>
            <span className="mt-0.5 block text-[11px] text-amber-800/62 dark:text-stone-500">
              {t("pages.read.planAnchorJan1Hint")}
            </span>
          </span>
        </label>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={activate}
          className="rounded-lg bg-amber-900/88 px-3.5 py-2 text-[12px] font-medium text-amber-50 transition hover:bg-amber-950 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100"
        >
          {isActive ? t("pages.read.planActivateUpdate") : t("pages.read.planActivateUse")}
        </button>
        {isActive && !isImplicitDefault ? (
          <button
            type="button"
            onClick={clear}
            className="text-[12px] font-medium text-amber-800/65 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 dark:text-stone-400"
          >
            {t("pages.read.planActivateClear")}
          </button>
        ) : null}
        {isActive && todayDayIndex != null ? (
          <span className="text-[11px] text-amber-800/55 dark:text-stone-500">
            {t("pages.read.planActivateCurrentDay", { n: String(todayDayIndex) })}
          </span>
        ) : null}
      </div>

      {isActive ? (
        <p className="mt-3 text-[11px] text-amber-800/55 dark:text-stone-500">
          <Link href="/read" className="underline decoration-amber-800/25 underline-offset-[0.15em]">
            {t("pages.read.todayPlanSeeHome")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
