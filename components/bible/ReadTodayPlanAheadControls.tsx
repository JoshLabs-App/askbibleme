"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { readAheadDays, resetReadingPlanAheadToToday } from "@/lib/read/reading-plan-ahead";
import { READ_PARCHMENT_MUTED } from "@/lib/read/read-parchment-accents";
import type { TodayReadingPlanState } from "@/hooks/useTodayReadingPlan";

type Props = {
  plan: TodayReadingPlanState;
};

const btnClass =
  "inline-flex items-center gap-0.5 border-0 bg-transparent p-0 text-[12px] font-medium disabled:opacity-50";

export function ReadTodayPlanAheadControls({ plan }: Props) {
  const { t } = useLocale();
  const { prefs } = plan;
  const aheadDays = readAheadDays(prefs);
  const [busy, setBusy] = useState(false);

  if (aheadDays <= 0) return null;

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
    </div>
  );
}
