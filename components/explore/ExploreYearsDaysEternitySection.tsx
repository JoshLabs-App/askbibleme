"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  filterEternityProse,
  filterEternityScriptures,
  formatScriptureBlockBody,
} from "@/lib/explore/years-days-eternity-blocks";
import { YEARS_DAYS_ETERNITY_EN } from "@/lib/explore/years-days-eternity-content-en";
import { YEARS_DAYS_ETERNITY_ZH } from "@/lib/explore/years-days-eternity-content";
import { getRedemptionTimelineCaption } from "@/lib/explore/years-days-eternity-redemption-eras";
import type { YearsDaysEternityFinale, YearsDaysEternityScriptureBlock } from "@/lib/explore/years-days-eternity-types";

type Props = {
  enScriptureBodyByRef?: Record<string, string>;
  enRefLabelByRaw?: Record<string, string>;
};

function stripSectionTitlePrefix(title: string): string {
  return title
    .replace(/^\s*\d+\s*[\.\)、]\s*/, "")
    .replace(/^\s*[一二三四五六七八九十]+\s*[、.]\s*/, "")
    .trim();
}

function ScriptureFlow({
  scriptures,
  bodyOverrideByRef,
  refOverrideByRef,
}: {
  scriptures: YearsDaysEternityScriptureBlock[];
  bodyOverrideByRef?: Record<string, string>;
  refOverrideByRef?: Record<string, string>;
}) {
  if (!scriptures.length) return null;
  return (
    <div className="space-y-3">
      {scriptures.map((block, i) => (
        <div key={`${block.ref}-${i}`}>
          <p className="text-[16px] leading-relaxed text-ink/78">
            {bodyOverrideByRef?.[block.ref] ?? formatScriptureBlockBody(block.lines)}
          </p>
          <p className="mt-1 text-right text-[12px] font-semibold text-ink/45">
            — {refOverrideByRef?.[block.ref] ?? block.ref}
          </p>
        </div>
      ))}
    </div>
  );
}

function EncouragementSection({ scripture }: { scripture: YearsDaysEternityScriptureBlock }) {
  return (
    <section className="mt-10 border-t border-ink/10 pt-8">
      <div className="mx-auto max-w-[360px] space-y-1 text-center">
        {scripture.lines.map((line, i) => (
          <p key={i} className="text-[16px] leading-relaxed text-ink/78">
            {line}
          </p>
        ))}
        <p className="mt-2 text-[12px] font-semibold text-ink/45">— {scripture.ref}</p>
      </div>
    </section>
  );
}

function ClosingFinaleSection({ finale }: { finale: YearsDaysEternityFinale }) {
  return (
    <section className="mt-8 border-t border-ink/10 pt-6">
      <div className="space-y-2 text-center text-[15px] leading-relaxed text-ink/72">
        {finale.leadLines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-center">
        {finale.scripture.lines.map((line, i) => (
          <p key={i} className="text-[16px] leading-relaxed text-ink/78">
            {line}
          </p>
        ))}
        <p className="text-[12px] font-semibold text-ink/45">— {finale.scripture.ref}</p>
      </div>
    </section>
  );
}

export function ExploreYearsDaysEternitySection({ enScriptureBodyByRef, enRefLabelByRaw }: Props) {
  const { locale } = useLocale();
  const doc = locale === "en" ? YEARS_DAYS_ETERNITY_EN : YEARS_DAYS_ETERNITY_ZH;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fullScriptureSections = useMemo(() => {
    if (locale !== "en") return doc.sections;
    const sourceById = new Map(YEARS_DAYS_ETERNITY_ZH.sections.map((section) => [section.id, section]));
    return doc.sections.map((section) => {
      const source = sourceById.get(section.id);
      if (!source) return section;
      return { ...section, blocks: source.blocks };
    });
  }, [doc.sections, locale]);

  const timelineCaption = getRedemptionTimelineCaption(locale);

  return (
    <section className="mt-10">
      <div className="explore-section-divider w-full" aria-hidden />
      <header className="mt-8 text-center">
        <h2 className="font-serif text-[clamp(1.35rem,4vw,1.75rem)] font-medium leading-snug text-ink/92">
          {doc.pageTitle}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/68">{timelineCaption}</p>
        <div className="mx-auto mt-4 h-px w-10 bg-border/55" />
      </header>

      <section className="mt-6 space-y-4 text-center text-[15px] leading-relaxed text-ink/72">
        {filterEternityProse(doc.closing).map((lines, i) => (
          <div key={i} className="space-y-1">
            {lines.map((line, j) => (
              <p key={j}>{line}</p>
            ))}
          </div>
        ))}
      </section>

      <ClosingFinaleSection finale={doc.finale} />

      <div className="mt-10 space-y-2.5">
        {fullScriptureSections.map((section, index) => {
          const expanded = expandedIndex === index;
          return (
            <article
              key={section.id}
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
                  <span className="font-serif text-[16px] font-semibold leading-snug text-amber-900/88">
                    {stripSectionTitlePrefix(section.title)}
                  </span>
                </span>
                <span className="w-5 shrink-0 text-center text-[22px] font-bold leading-none text-amber-800/75">
                  {expanded ? "−" : "+"}
                </span>
              </button>
              {expanded ? (
                <div className="border-t border-ink/8 px-4 pb-4 pt-2">
                  <ScriptureFlow
                    scriptures={filterEternityScriptures(section.blocks)}
                    bodyOverrideByRef={locale === "en" ? enScriptureBodyByRef : undefined}
                    refOverrideByRef={locale === "en" ? enRefLabelByRaw : undefined}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <EncouragementSection scripture={doc.encouragement} />
    </section>
  );
}
