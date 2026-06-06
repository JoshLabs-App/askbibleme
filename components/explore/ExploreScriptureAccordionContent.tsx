"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  formatExploreRefLabel,
  parseExploreRef,
  type ParsedExploreRef,
} from "@/lib/explore/explore-scripture-ref-parse";

export type ExploreScriptureCategory = {
  title: string;
  titleEn?: string;
  refs: string[];
};

type Props = {
  backHref?: string;
  backLabelKey: string;
  titleKey: string;
  subtitleKey: string;
  categories: ExploreScriptureCategory[];
  bookAbbrMap: Record<string, string>;
  verseTextByRef: Record<string, string>;
};

function stripCategoryTitlePrefix(title: string): string {
  return title.replace(/^\s*\d+\s*[\.\)、]\s*/, "").trim();
}

export function ExploreScriptureAccordionContent({
  backHref = "/explore",
  backLabelKey,
  titleKey,
  subtitleKey,
  categories,
  bookAbbrMap,
  verseTextByRef,
}: Props) {
  const { t, locale } = useLocale();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const parsedByRaw: Record<string, ParsedExploreRef | null> = {};
  for (const category of categories) {
    for (const raw of category.refs) {
      parsedByRaw[raw] = parseExploreRef(raw, bookAbbrMap);
    }
  }

  const pending = locale === "en" ? "Loading verse..." : "经文加载中…";

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-5 pb-24 pt-6 text-ink sm:max-w-2xl md:px-8">
      <Link
        href={backHref}
        className="text-[13px] font-medium text-ink/72 underline decoration-ink/20 underline-offset-[0.2em]"
      >
        {t(backLabelKey)}
      </Link>

      <header className="mt-4 text-center">
        <h1 className="font-serif text-[clamp(1.6rem,4.5vw,2rem)] font-medium leading-snug tracking-[-0.02em] text-ink/92">
          {t(titleKey)}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/68">{t(subtitleKey)}</p>
      </header>

      <div className="mt-8 space-y-2.5">
        {categories.map((category, index) => {
          const title =
            locale === "en" && category.titleEn
              ? stripCategoryTitlePrefix(category.titleEn)
              : stripCategoryTitlePrefix(category.title);
          const expanded = expandedIndex === index;

          return (
            <article
              key={category.title}
              className="overflow-hidden rounded-2xl border border-ink/10 bg-canvas/55"
            >
              <button
                type="button"
                onClick={() => setExpandedIndex(expanded ? null : index)}
                className="flex w-full min-h-14 items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-canvas/80"
                aria-expanded={expanded}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 text-[16px] font-semibold text-amber-800/85">{index + 1}.</span>
                  <span className="font-serif text-[17px] font-semibold leading-snug text-amber-900/88">{title}</span>
                </span>
                <span className="w-5 shrink-0 text-center text-[22px] font-bold leading-none text-amber-800/75">
                  {expanded ? "−" : "+"}
                </span>
              </button>

              {expanded ? (
                <div className="space-y-3 border-t border-ink/8 px-4 pb-4 pt-2">
                  {category.refs.map((ref) => (
                    <div key={`${category.title}-${ref}`}>
                      <p className="text-[16px] leading-relaxed text-ink/78">
                        {verseTextByRef[ref] ?? pending}
                      </p>
                      <p className="mt-1 text-right text-[12px] font-semibold text-ink/45">
                        — {formatExploreRefLabel(ref, parsedByRaw[ref], locale)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
