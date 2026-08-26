"use client";

import { useEffect, useState } from "react";
import { getCachedLegacyFiguresBundle } from "@/lib/explore/explore-legacy-figures-cache-web";
import { refreshLegacyFiguresWeb } from "@/lib/explore/explore-content-refresh-web";
import { legacyFigureTimelineBookRowsFromMobileBundle } from "@/lib/explore/legacy-figures-timeline-from-mobile-bundle";
import type { LegacyFigureTimelineBookRow } from "@/lib/legacy-figures-timeline-types";

export function useLegacyFiguresTimelineRefresh(
  initialBookRows: LegacyFigureTimelineBookRow[],
): LegacyFigureTimelineBookRow[] {
  const [bookRows, setBookRows] = useState(initialBookRows);

  useEffect(() => {
    setBookRows(initialBookRows);
  }, [initialBookRows]);

  useEffect(() => {
    const cached = getCachedLegacyFiguresBundle();
    if (cached?.bookRows.length) {
      setBookRows(legacyFigureTimelineBookRowsFromMobileBundle(cached));
    }

    let cancelled = false;
    const run = () => {
      void refreshLegacyFiguresWeb().then((bundle) => {
        if (cancelled || !bundle?.bookRows.length) return;
        setBookRows(legacyFigureTimelineBookRowsFromMobileBundle(bundle));
      });
    };

    const schedule = () => {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => run(), { timeout: 3000 });
      } else {
        window.setTimeout(run, 600);
      }
    };

    schedule();

    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return bookRows;
}
