"use client";

import Link from "next/link";
import { useState } from "react";
import { ExploreProsePage } from "@/components/explore/ExploreProsePage";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import {
  formatExploreRefLabel,
  parseExploreRef,
  type ParsedExploreRef,
} from "@/lib/explore/explore-scripture-ref-parse";

export type ExploreScriptureCategory = {
  title: string;
  titleTw?: string;
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
    <ExploreProsePage>
      <Link href={backHref} className="explore-prose-back underline">
        {t(backLabelKey)}
      </Link>

      <header className="explore-prose-header text-center">
        <h1 className="explore-prose-title">{t(titleKey)}</h1>
        <p className="explore-prose-subtitle">{t(subtitleKey)}</p>
      </header>

      <div className="mt-8 space-y-2.5">
        {categories.map((category, index) => {
          const zhTitle =
            locale === "zh-TW"
              ? category.titleTw ?? toZhTwText(category.title)
              : category.title;
          const title =
            locale === "en" && category.titleEn
              ? stripCategoryTitlePrefix(category.titleEn)
              : stripCategoryTitlePrefix(zhTitle);
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
                      <p className="explore-prose-verse">
                        {verseTextByRef[ref] ?? pending}
                      </p>
                      <p className="explore-prose-ref">
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
    </ExploreProsePage>
  );
}
