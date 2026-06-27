"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { mapHistoricalCreedRows } from "@/lib/explore/historical-creeds-display";
import { READ_NEW_TESTAMENT_ACCENT } from "@/lib/read/read-parchment-accents";
import { HistoricalCreedFullTextPanel } from "@/components/explore/HistoricalCreedFullTextPanel";

export function ExploreHistoricalCreedsContent() {
  const { t, locale } = useLocale();
  const [expandedCreedId, setExpandedCreedId] = useState("");
  const [fullTextCreedId, setFullTextCreedId] = useState<string | null>(null);
  const rows = useMemo(() => mapHistoricalCreedRows(locale), [locale]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-6 text-ink md:px-8">
      <Link
        href="/explore"
        className="inline-block text-[13px] font-medium text-ink/72 underline decoration-ink/20 underline-offset-[0.2em]"
      >
        {t("pages.explore.historicalCreedsBack")}
      </Link>

      <header className="mt-4 text-center">
        <h1 className="font-serif text-[clamp(1.8rem,4.8vw,2.35rem)] font-medium leading-[1.24] tracking-[-0.015em] text-ink/92">
          {t("pages.explore.historicalCreedsTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-[1.95] text-ink/76">
          {t("pages.explore.historicalCreedsLead")}
        </p>
      </header>

      <section className="mt-10 space-y-5">
        {rows.map((creed, index) => {
          const showGroupLabel = index === 0 || rows[index - 1]?.group !== creed.group;
          const expanded = expandedCreedId === creed.id;
          const fullTextOpen = fullTextCreedId === creed.id;
          const featured = creed.isCoreEcumenical;
          return (
            <div key={creed.id}>
              {showGroupLabel ? (
                <>
                  <p className="mb-3 ml-[34px] mt-6 text-left font-serif text-[1.2rem] font-semibold leading-snug text-ink/92">
                    {creed.groupLabel}
                  </p>
                  {creed.group === "ecumenical" ? (
                    <p className="mb-3 ml-[34px] mr-2 text-[14px] leading-relaxed text-muted/90">
                      {t("pages.explore.historicalCreedsCoreEcumenicalLead")}
                    </p>
                  ) : null}
                </>
              ) : null}
              <article className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-3">
                <div className="relative flex flex-col items-center">
                  {index < rows.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-4 h-[calc(100%+18px)] w-1 -translate-x-1/2"
                      style={{ backgroundColor: READ_NEW_TESTAMENT_ACCENT }}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className={
                      featured
                        ? "mt-1.5 inline-flex h-3.5 w-3.5 rounded-full bg-amber-600 ring-2 ring-amber-600/35"
                        : "mt-2 inline-flex h-2.5 w-2.5 rounded-full bg-amber-600/90 ring-1 ring-border/60"
                    }
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex min-h-7 items-center pt-2">
                    <p
                      className={
                        featured
                          ? "text-[13px] font-bold leading-snug text-amber-700"
                          : "text-[12px] font-semibold leading-snug text-amber-700/90"
                      }
                    >
                      {creed.yearRight}
                    </p>
                  </div>
                  <div
                    className={
                      featured
                        ? "relative mt-2 overflow-hidden rounded-2xl border-2 border-amber-600/55 bg-canvas/85 px-4 pb-4 pt-3 shadow-[0_1px_0_rgba(217,119,7,0.12)]"
                        : "mt-2 rounded-2xl border border-ink/10 bg-canvas/70 px-4 py-4"
                    }
                  >
                    {featured ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ backgroundColor: READ_NEW_TESTAMENT_ACCENT }}
                      />
                    ) : null}
                    {featured ? (
                      <p className="mb-3 mt-1 inline-flex rounded-full border border-amber-600/40 bg-amber-600/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-amber-800">
                        {t("pages.explore.historicalCreedsCoreEcumenicalBadge")}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="w-full text-left"
                      aria-expanded={expanded}
                      onClick={() => setExpandedCreedId(expanded ? "" : creed.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex flex-wrap items-baseline gap-2.5">
                          <span
                            className={
                              featured
                                ? "font-serif text-[1.28rem] font-bold leading-snug text-amber-700/95"
                                : "font-serif text-[1.2rem] font-semibold leading-snug text-amber-700/90"
                            }
                          >
                            {creed.orderLabel}
                          </span>
                          <h2
                            className={
                              featured
                                ? "font-serif text-[1.28rem] font-bold leading-snug text-ink/95"
                                : "font-serif text-[1.2rem] font-semibold leading-snug text-ink/92"
                            }
                          >
                            {creed.title}
                          </h2>
                        </div>
                        <div className="flex shrink-0 items-start">
                          <span className="text-[20px] font-semibold leading-none text-amber-700/90" aria-hidden>
                            {expanded ? "−" : "+"}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="mt-4 space-y-2.5 border-t border-ink/8 pt-4">
                      <p className="text-[13px] font-bold tracking-[0.04em] text-amber-700/90">
                        {t("pages.explore.historicalCreedsProblemLabel")}
                      </p>
                      <p className="text-[15px] leading-[1.72] text-ink/80">{creed.problemAddressed}</p>
                    </div>
                    {expanded ? (
                      <div className="mt-4 space-y-2.5 border-t border-ink/8 pt-4">
                        <p className="text-[13px] font-bold tracking-[0.04em] text-amber-700/90">
                          {t("pages.explore.historicalCreedsSignificanceLabel")}
                        </p>
                        <p className="text-[15px] leading-[1.72] text-ink/82">{creed.significance}</p>
                      </div>
                    ) : null}
                    {creed.hasBody ? (
                      <button
                        type="button"
                        className="mt-4 rounded-full border border-amber-700/35 bg-canvas/80 px-3.5 py-2 text-[13px] font-semibold text-amber-800/90"
                        onClick={() => setFullTextCreedId(fullTextOpen ? null : creed.id)}
                      >
                        {fullTextOpen
                          ? t("pages.explore.historicalCreedsCollapseFullLabel")
                          : t("pages.explore.historicalCreedsReadFullLabel")}
                      </button>
                    ) : null}
                    {fullTextOpen ? (
                      <div className="mt-4 space-y-3 border-t border-ink/8 pt-4">
                        <p className="text-[13px] font-bold tracking-[0.04em] text-amber-700/90">
                          {t("pages.explore.historicalCreedsFullTextLabel")}
                        </p>
                        <HistoricalCreedFullTextPanel creedId={creed.id} locale={locale} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </section>
    </div>
  );
}
