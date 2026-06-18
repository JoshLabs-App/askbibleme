"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildSectionedCreedBody,
  creedBodySectionHasSubsections,
  type CreedBodySection,
  type SectionedCreedBody,
} from "@/lib/explore/historical-creeds-body-sections";
import { isChicagoArticleParagraph } from "@/lib/explore/historical-creeds-body-format";
import type { AppLocale } from "@/lib/i18n/config";
import { HistoricalCreedBodyBlock } from "@/components/explore/HistoricalCreedBodyBlock";

type Props = {
  creedId: string;
  paragraphs: string[];
  locale: AppLocale;
};

function sectionedHasPartGroups(sectioned: SectionedCreedBody): boolean {
  return sectioned.sections.some((section) => creedBodySectionHasSubsections(section));
}

function TopicAccordionList({
  creedId,
  topics,
  openTopicId,
  onToggleTopic,
}: {
  creedId: string;
  topics: CreedBodySection[];
  openTopicId: string | null;
  onToggleTopic: (topicId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {topics.map((topic) => {
        const open = openTopicId === topic.id;
        return (
          <div
            key={`${creedId}-topic-${topic.id}`}
            className="overflow-hidden rounded-xl border border-ink/10 bg-canvas/55"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
              aria-expanded={open}
              onClick={() => onToggleTopic(topic.id)}
            >
              <span className="text-[15px] font-bold leading-snug text-ink/92">{topic.label}</span>
              <span className="text-[18px] font-semibold leading-none text-amber-700/90" aria-hidden>
                {open ? "−" : "+"}
              </span>
            </button>
            {open ? (
              <div className="space-y-2 border-t border-ink/8 px-3.5 pb-3.5 pt-2">
                {topic.paragraphs.map((paragraph, index) => (
                  <HistoricalCreedBodyBlock
                    key={`${creedId}-topic-${topic.id}-${index}`}
                    text={paragraph}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function HistoricalCreedSectionedBody({ creedId, paragraphs, locale }: Props) {
  const sectioned = useMemo(
    () => buildSectionedCreedBody(paragraphs, locale, creedId),
    [paragraphs, locale, creedId],
  );
  const partGrouped = sectioned ? sectionedHasPartGroups(sectioned) : false;
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!sectioned) {
      setOpenSectionId(null);
      return;
    }
    if (partGrouped) {
      setOpenSectionId(sectioned.sections[0]?.subsections?.[0]?.id ?? null);
      return;
    }
    setOpenSectionId(sectioned.sections[0]?.id ?? null);
  }, [creedId, sectioned, partGrouped]);

  if (!sectioned) {
    return (
      <div className="space-y-1">
        {paragraphs.map((paragraph, index) => {
          const isChicago = isChicagoArticleParagraph(paragraph);
          const chicagoArticleLead =
            isChicago && (index === 0 || !isChicagoArticleParagraph(paragraphs[index - 1] ?? ""));
          return (
            <HistoricalCreedBodyBlock
              key={`${creedId}-flat-${index}`}
              text={paragraph}
              chicagoArticleLead={chicagoArticleLead}
            />
          );
        })}
      </div>
    );
  }

  const toggleSection = (sectionId: string) => {
    setOpenSectionId((current) => (current === sectionId ? null : sectionId));
  };

  if (partGrouped) {
    return (
      <div className="space-y-5">
        {sectioned.intro.map((paragraph, index) => (
          <HistoricalCreedBodyBlock key={`${creedId}-intro-${index}`} text={paragraph} />
        ))}
        {sectioned.sections.map((part) => (
          <section key={`${creedId}-part-${part.id}`} className="space-y-2.5">
            <h3 className="text-[16px] font-bold leading-snug text-amber-800/95">{part.label}</h3>
            <TopicAccordionList
              creedId={creedId}
              topics={part.subsections ?? []}
              openTopicId={openSectionId}
              onToggleTopic={toggleSection}
            />
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sectioned.intro.map((paragraph, index) => (
        <HistoricalCreedBodyBlock key={`${creedId}-intro-${index}`} text={paragraph} />
      ))}
      {sectioned.sections.map((section) => {
        const open = openSectionId === section.id;
        return (
          <div
            key={`${creedId}-section-${section.id}`}
            className="overflow-hidden rounded-xl border border-ink/10 bg-canvas/55"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
              aria-expanded={open}
              onClick={() => toggleSection(section.id)}
            >
              <span className="text-[15px] font-bold leading-snug text-ink/92">{section.label}</span>
              <span className="text-[18px] font-semibold leading-none text-amber-700/90" aria-hidden>
                {open ? "−" : "+"}
              </span>
            </button>
            {open ? (
              <div className="space-y-2 border-t border-ink/8 px-3.5 pb-3.5 pt-2">
                {section.paragraphs.map((paragraph, index) => (
                  <HistoricalCreedBodyBlock
                    key={`${creedId}-section-${section.id}-${index}`}
                    text={paragraph}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
