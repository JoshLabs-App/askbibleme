"use client";

import { useState } from "react";
import { LegacyArticleMarkdown } from "@/components/legacy/LegacyArticleMarkdown";
import type { ExploreFeaturedArticleSection } from "@/lib/explore/explore-featured-article-section-types";
import { exploreFeaturedArticleSectionHeaderLabel } from "@/lib/explore/explore-featured-article-section-label";

type Props = {
  sections: ExploreFeaturedArticleSection[];
};

export function ExploreFeaturedArticleSections({ sections }: Props) {
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  return (
    <div className="mt-2 space-y-2.5">
      {sections.map((section, index) => {
        const expanded = expandedSectionId === section.id;
        const header = exploreFeaturedArticleSectionHeaderLabel(section.title, index);
        return (
          <article
            key={section.id}
            className="overflow-hidden rounded-2xl border border-ink/10 bg-canvas/55"
          >
            <button
              type="button"
              onClick={() => setExpandedSectionId(expanded ? null : section.id)}
              className="flex w-full min-h-14 items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-canvas/80"
              aria-expanded={expanded}
            >
              <span className="flex min-w-0 flex-1 items-start gap-2">
                <span className="shrink-0 pt-0.5 text-[16px] font-semibold text-amber-800/85">
                  {header.indexLabel}
                </span>
                <span className="font-serif text-[17px] font-semibold leading-snug text-amber-900/88">
                  {header.title}
                </span>
              </span>
              <span className="w-5 shrink-0 text-center text-[22px] font-bold leading-none text-amber-800/75">
                {expanded ? "−" : "+"}
              </span>
            </button>
            {expanded ? (
              <div className="border-t border-ink/8 px-4 pb-4 pt-2">
                <LegacyArticleMarkdown content={section.body} linkScriptureRefs variant="explore" />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
