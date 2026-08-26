"use client";

import { LegacyFiguresTimeline } from "@/components/legacy/LegacyFiguresTimeline";
import { useLegacyFiguresTimelineRefresh } from "@/hooks/useLegacyFiguresTimelineRefresh";
import type { AppLocale } from "@/lib/i18n/config";
import type { LegacyFigureTimelineBookRow } from "@/lib/legacy-figures-timeline-types";

type Props = {
  initialBookRows: LegacyFigureTimelineBookRow[];
  locale: AppLocale;
};

export function ExploreFiguresPageClient({ initialBookRows, locale }: Props) {
  const bookRows = useLegacyFiguresTimelineRefresh(initialBookRows);
  return <LegacyFiguresTimeline bookRows={bookRows} locale={locale} />;
}
