"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import {
  pointerMatchesTrack,
  tripleLoopTrackTitle,
  trackForBookId,
} from "@/lib/bible/reading-plans/triple-loop-reading";
import {
  getEffectiveReadingPlanPrefsServerSnapshot,
  getEffectiveReadingPlanPrefsSnapshot,
  subscribeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import {
  advanceTripleLoopProgressTrack,
  getTripleLoopProgressServerSnapshot,
  getTripleLoopProgressSnapshot,
  hasUserTripleLoopProgress,
  subscribeTripleLoopProgress,
} from "@/lib/read/triple-loop-progress";
import { resetTripleLoopPlanToEasterDefault } from "@/lib/read/triple-loop-plan-sync";
import { markTodayReadingChapterVisit } from "@/lib/read/today-reading-done";

type Props = {
  bookId: string;
  chapter: number;
};

export function ReadChapterTripleLoopAdvance({ bookId, chapter }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const prefs = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getEffectiveReadingPlanPrefsSnapshot,
    getEffectiveReadingPlanPrefsServerSnapshot,
  );
  const progress = useSyncExternalStore(
    subscribeTripleLoopProgress,
    getTripleLoopProgressSnapshot,
    getTripleLoopProgressServerSnapshot,
  );

  if (!isTripleLoopPlanId(prefs.planId)) return null;

  const track = trackForBookId(bookId);
  if (!track || !pointerMatchesTrack(progress, track, bookId, chapter)) return null;

  const userAdjusted = hasUserTripleLoopProgress();

  const advance = () => {
    setSaving(true);
    try {
      void markTodayReadingChapterVisit(bookId, chapter);
      advanceTripleLoopProgressTrack(track);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setSaving(true);
    try {
      resetTripleLoopPlanToEasterDefault();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="read-chapter-triple-loop-advance mt-8 rounded-xl border border-amber-900/10 bg-amber-50/40 px-4 py-4 text-center dark:border-stone-600/25 dark:bg-stone-900/35"
      aria-label={t("pages.read.tripleLoopAdvanceAria")}
    >
      <p className="mx-auto max-w-[22rem] text-pretty text-[12px] leading-relaxed text-amber-900/78 dark:text-stone-400">
        {t("pages.read.tripleLoopAdvanceHint", { track: tripleLoopTrackTitle(track) })}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={advance}
          className="rounded-lg bg-amber-900/88 px-3.5 py-2 text-[12px] font-medium text-amber-50 transition hover:bg-amber-950 disabled:opacity-60 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100"
        >
          {saving ? t("pages.read.tripleLoopAdvanceSaving") : t("pages.read.tripleLoopAdvanceButton", { track: tripleLoopTrackTitle(track) })}
        </button>
        {userAdjusted ? (
          <button
            type="button"
            disabled={saving}
            onClick={resetToDefault}
            className="text-[12px] font-medium text-amber-800/70 underline decoration-amber-800/25 underline-offset-[0.15em] hover:text-amber-950 disabled:opacity-60 dark:text-stone-400"
          >
            {t("pages.read.tripleLoopResetToDefault")}
          </button>
        ) : null}
      </div>
    </div>
  );
}


