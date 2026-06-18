"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  advanceReadingPlanOneDay,
  canAdvanceReadingPlanOneDay,
  readAheadDays,
  resetReadingPlanAheadToToday,
} from "@/lib/read/reading-plan-ahead";
import { READ_PARCHMENT_MUTED } from "@/lib/read/read-parchment-accents";
import type { TodayReadingPlanState } from "@/hooks/useTodayReadingPlan";

type Props = {
  plan: TodayReadingPlanState;
  todayAllDone: boolean;
};

const btnClass =
  "inline-flex items-center gap-0.5 border-0 bg-transparent p-0 text-[12px] font-medium disabled:opacity-50";

export function ReadTodayPlanAheadControls({ plan, todayAllDone }: Props) {
  const { t } = useLocale();
  const { prefs, dayCount } = plan;
  const aheadDays = readAheadDays(prefs);
  const [busy, setBusy] = useState(false);

  const canAdvance = canAdvanceReadingPlanOneDay(prefs, dayCount) && todayAllDone;
  const showBack = aheadDays > 0;
  if (!canAdvance && !showBack) return null;

  const run = (fn: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      fn();
    } finally {
      window.setTimeout(() => setBusy(false), 280);
    }
  };

  return (
    <div className="read-bible-today-ahead-nav mt-2 flex w-full items-center justify-end gap-4 pr-[30px]">
      {showBack ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => resetReadingPlanAheadToToday())}
          className={btnClass}
          style={{ color: READ_PARCHMENT_MUTED }}
        >
          <span aria-hidden>‹</span>
          {t("pages.read.todayPlanBackToToday")}
        </button>
      ) : null}
      {canAdvance ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => advanceReadingPlanOneDay())}
          className={btnClass}
          style={{ color: READ_PARCHMENT_MUTED }}
        >
          {t("pages.read.todayPlanReadNextDay")}
          <span aria-hidden>›</span>
        </button>
      ) : null}
    </div>
  );
}
