"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ReadingPlanStartDayPicker } from "@/components/explore/reading-planner/ReadingPlanStartDayPicker";
import { NtDeepRepeatPaceSection } from "@/components/bible/NtDeepRepeatPaceSection";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { isNtDeepRepeatPlanId } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { isPointerReadingPlanId } from "@/lib/bible/reading-plans/pointer-reading-plan";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { activateNtDeepRepeatPlan } from "@/lib/read/nt-deep-repeat-plan-sync";
import { resolveEffectiveEpochDay } from "@/lib/read/reading-plan-ahead";
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
import { readPlanPlayHref } from "@/lib/read/read-plan-play-route";

type Props = {
  planId: string;
  dayCount: number;
};

function maxStartDayForPlan(planId: string, dayCount: number, isNtDeepRepeat: boolean): number {
  if (isNtDeepRepeat) return 365;
  return Math.max(1, Number.isFinite(dayCount) ? dayCount : 365);
}

export function ReadPlanActivateControl({ planId, dayCount }: Props) {
  const { t, locale } = useLocale();
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
  const isTripleLoop = isTripleLoopPlanId(planId);
  const isNtDeepRepeat = isNtDeepRepeatPlanId(planId);
  const isPointerPlan = isPointerReadingPlanId(planId);
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
  const [pace, setPace] = useState<NtDeepRepeatPace>(
    stored?.ntDeepRepeatPace ?? effective.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE,
  );
  const maxStartDay = maxStartDayForPlan(planId, dayCount, isNtDeepRepeat);
  const supportsStartDay =
    isNtDeepRepeat || (!isPointerPlan && !isTripleLoop && anchor === "from-today");
  const [startDay, setStartDay] = useState(1);

  useEffect(() => {
    if (isActive) setAnchor(effective.anchor);
  }, [isActive, effective.anchor]);

  useEffect(() => {
    if (isActive && effective.ntDeepRepeatPace) setPace(effective.ntDeepRepeatPace);
    else if (stored?.ntDeepRepeatPace) setPace(stored.ntDeepRepeatPace);
  }, [isActive, effective.ntDeepRepeatPace, stored?.ntDeepRepeatPace]);

  const currentPlanDay = useMemo(() => {
    if (!isActive) return null;
    if (isNtDeepRepeat) return resolveEffectiveEpochDay(effective);
    if (isTripleLoop) return null;
    return resolveReadingPlanDayIndex(effective, dayCount) + 1;
  }, [isActive, effective, dayCount, isNtDeepRepeat, isTripleLoop]);

  useEffect(() => {
    if (!supportsStartDay) return;
    if (isActive && currentPlanDay != null) {
      setStartDay(Math.min(maxStartDay, Math.max(1, currentPlanDay)));
    }
  }, [supportsStartDay, isActive, currentPlanDay, maxStartDay]);

  const todayDayIndex = currentPlanDay;

  const activate = () => {
    const safeStartDay = Math.min(maxStartDay, Math.max(1, Math.floor(startDay)));
    if (isNtDeepRepeat) {
      activateNtDeepRepeatPlan({ dayCount, pace, startDay: safeStartDay });
    } else if (isTripleLoop) {
      setActiveReadingPlan(planId, "calendar-easter", { dayCount });
    } else if (supportsStartDay) {
      const backDated = new Date();
      backDated.setDate(backDated.getDate() - (safeStartDay - 1));
      setActiveReadingPlan(planId, anchor, { dayCount, now: backDated });
    } else {
      setActiveReadingPlan(planId, anchor, { dayCount });
    }
    if (!isActive) {
      router.push(readPlanPlayHref());
    } else {
      router.refresh();
    }
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
      {isTripleLoop ? (
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-amber-900/78 dark:text-stone-400">
          {t("pages.read.tripleLoopActivateHint")}
        </p>
      ) : isNtDeepRepeat ? (
        <>
          <p className="mt-3 text-pretty text-[12px] leading-relaxed text-amber-900/78 dark:text-stone-400">
            {t("pages.read.ntDeepRepeatActivateHint")}
          </p>
          <NtDeepRepeatPaceSection value={pace} onChange={setPace} />
        </>
      ) : (
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
      )}

      {supportsStartDay ? (
        <ReadingPlanStartDayPicker locale={locale} value={startDay} max={maxStartDay} onChange={setStartDay} />
      ) : null}

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
          <Link href={readPlanPlayHref()} className="underline decoration-amber-800/25 underline-offset-[0.15em]">
            {t("pages.read.todayPlanSeeHome")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
