"use client";

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n/config";
import {
  resolveHistoricalCreedBodyParagraphs,
  resolveInlineHistoricalCreedBodyParagraphs,
} from "@/lib/explore/historical-creeds-body-load";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HistoricalCreedSectionedBody } from "@/components/explore/HistoricalCreedSectionedBody";

type Props = {
  creedId: string;
  locale: AppLocale;
};

export function HistoricalCreedFullTextPanel({ creedId, locale }: Props) {
  const { t } = useLocale();
  const [paragraphs, setParagraphs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const inline = resolveInlineHistoricalCreedBodyParagraphs(creedId, locale);
    if (inline) {
      setParagraphs(inline);
      setLoading(false);
      return;
    }

    setLoading(true);
    setParagraphs(null);
    resolveHistoricalCreedBodyParagraphs(creedId, locale)
      .then((body) => {
        if (!cancelled) {
          setParagraphs(body);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParagraphs([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [creedId, locale]);

  if (loading) {
    return (
      <p className="py-3 text-[14px] leading-relaxed text-ink/60">
        {t("pages.explore.historicalCreedsBodyLoading")}
      </p>
    );
  }

  if (!paragraphs || paragraphs.length === 0) {
    return (
      <p className="py-3 text-[14px] leading-relaxed text-ink/60">
        {t("pages.explore.historicalCreedsBodyUnavailable")}
      </p>
    );
  }

  return (
    <HistoricalCreedSectionedBody
      creedId={creedId}
      paragraphs={paragraphs ?? []}
      locale={locale}
    />
  );
}
