"use client";

import { LegacyFiguresTimeline } from "@/components/legacy/LegacyFiguresTimeline";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useLegacyFiguresTimelineRefresh } from "@/hooks/useLegacyFiguresTimelineRefresh";
import type { LegacyFigureTimelineBookRow } from "@/lib/legacy-figures-timeline-types";

type Props = {
  initialBookRows: LegacyFigureTimelineBookRow[];
};

/** 语言自取而非由页面传入，使 /explore/figures 无需读请求、可静态生成。 */
export function ExploreFiguresPageClient({ initialBookRows }: Props) {
  const { locale } = useLocale();
  const bookRows = useLegacyFiguresTimelineRefresh(initialBookRows);
  return <LegacyFiguresTimeline bookRows={bookRows} locale={locale} />;
}
