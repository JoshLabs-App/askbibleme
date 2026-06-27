"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildSectionedCreedBody,
  creedBodySectionHasSubsections,
  type CreedBodySection,
  type SectionedCreedBody,
} from "@/lib/explore/historical-creeds-body-sections";
import {
  catechismAnswerOnlyParagraph,
  isChicagoArticleParagraph,
} from "@/lib/explore/historical-creeds-body-format";
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

function QuestionAccordionList({
  creedId,
  questions,
  openQuestionId,
  onToggleQuestion,
}: {
  creedId: string;
  questions: CreedBodySection[];
  openQuestionId: string | null;
  onToggleQuestion: (questionId: string) => void;
}) {
  return (
    <div className="space-y-2 pl-1">
      {questions.map((question) => {
        const open = openQuestionId === question.id;
        const paragraph = question.paragraphs[0] ?? "";
        return (
          <div
            key={`${creedId}-question-${question.id}`}
            className="overflow-hidden rounded-lg border border-ink/10 bg-canvas/55"
          >
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
              aria-expanded={open}
              onClick={() => onToggleQuestion(question.id)}
            >
              <span className="text-[14px] font-semibold leading-snug text-ink/90">
                {question.label}
              </span>
              <span className="text-[18px] font-semibold leading-none text-amber-700/90" aria-hidden>
                {open ? "−" : "+"}
              </span>
            </button>
            {open && paragraph ? (
              <div className="space-y-2 border-t border-ink/8 px-3 pb-3 pt-2">
                <HistoricalCreedBodyBlock text={catechismAnswerOnlyParagraph(paragraph)} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function HeidelbergOutlineBody({
  creedId,
  sectioned,
}: {
  creedId: string;
  sectioned: SectionedCreedBody;
}) {
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  const toggleQuestion = (questionId: string) => {
    setOpenQuestionId((current) => (current === questionId ? null : questionId));
  };

  const renderLordDayBlock = (lordDay: CreedBodySection) => (
    <div key={`${creedId}-ld-${lordDay.id}`} className="space-y-2">
      <h4 className="px-0.5 text-[14px] font-bold leading-snug text-ink/88">{lordDay.label}</h4>
      <QuestionAccordionList
        creedId={creedId}
        questions={lordDay.subsections ?? []}
        openQuestionId={openQuestionId}
        onToggleQuestion={toggleQuestion}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {sectioned.intro.map((paragraph, index) => (
        <HistoricalCreedBodyBlock key={`${creedId}-intro-${index}`} text={paragraph} />
      ))}
      {sectioned.preamble ? renderLordDayBlock(sectioned.preamble) : null}
      {sectioned.sections.map((part) => (
        <section key={`${creedId}-part-${part.id}`} className="space-y-3">
          <h3 className="text-[16px] font-bold leading-snug text-amber-800/95">{part.label}</h3>
          <div className="space-y-3">
            {(part.subsections ?? []).map((lordDay) => renderLordDayBlock(lordDay))}
          </div>
        </section>
      ))}
    </div>
  );
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
  const heidelbergOutline = sectioned?.layout === "heidelberg-outline";
  const partGrouped = sectioned ? sectionedHasPartGroups(sectioned) : false;
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!sectioned || heidelbergOutline) {
      setOpenSectionId(null);
      return;
    }
    if (partGrouped) {
      setOpenSectionId(sectioned.sections[0]?.subsections?.[0]?.id ?? null);
      return;
    }
    setOpenSectionId(sectioned.sections[0]?.id ?? null);
  }, [creedId, sectioned, partGrouped, heidelbergOutline]);

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

  if (heidelbergOutline) {
    return <HeidelbergOutlineBody creedId={creedId} sectioned={sectioned} />;
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
