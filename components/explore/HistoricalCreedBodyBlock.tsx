import {
  expandCreedBodyParagraph,
  peelChicagoArticleBlock,
  type CreedBodyLevel,
  type CreedBodySegment,
} from "@/lib/explore/historical-creeds-body-format";
import { READ_NEW_TESTAMENT_ACCENT } from "@/lib/read/read-parchment-accents";
import { CreedScriptureRichText } from "./CreedScriptureRichText";

type Props = {
  text: string;
  chicagoArticleLead?: boolean;
};

const BODY_CLASS = "text-[15px] leading-[1.72] text-ink/88";

function titleClass(level: CreedBodyLevel): string {
  switch (level) {
    case "document":
      return "font-serif text-[1.2rem] font-semibold leading-[1.35] text-ink/94";
    case "section":
      return "text-[16px] font-bold leading-snug tracking-[0.01em] text-amber-800/95";
    case "lords-day":
      return "font-serif text-[17px] font-bold leading-snug tracking-[0.03em] text-amber-800";
    case "subsection":
      return "text-[14px] font-semibold leading-snug text-amber-800/92";
    case "article-label":
      return "text-[13px] font-bold leading-snug tracking-[0.02em] text-amber-700/90";
    case "subarticle":
      return "text-[14px] font-semibold leading-snug text-ink/90";
    case "proof-item":
      return "text-[14px] font-semibold leading-snug text-amber-800/90";
    default:
      return "text-[16px] font-bold leading-snug text-ink/94";
  }
}

function wrapClass(level: CreedBodyLevel): string {
  switch (level) {
    case "document":
      return "mt-2 space-y-2.5";
    case "section":
      return "mt-6 space-y-2.5 first:mt-0";
    case "lords-day":
      return "mt-7 space-y-2 border-t border-amber-900/15 pt-3 first:mt-0 first:border-t-0 first:pt-0";
    case "subsection":
      return "mt-5 space-y-2";
    case "article-label":
      return "mt-6 mb-0";
    case "subarticle":
      return "mt-3 space-y-1.5 border-l-[5px] pl-3.5";
    case "proof-item":
      return "mt-2 flex gap-2 text-[14px] leading-[1.65]";
    case "affirm":
      return "mt-3 space-y-1";
    case "deny":
      return "mt-3.5 space-y-1";
    case "question":
      return "mt-5 space-y-2 first:mt-0";
    case "answer":
      return "mt-3 mb-5 space-y-2 border-l-[3px] border-amber-900/20 pl-3";
    default:
      return "mt-1 space-y-2";
  }
}

function isArticleHeading(segment: CreedBodySegment): boolean {
  return segment.level === "article" && !!segment.title && !segment.body;
}

function stanceLabelClass(level: "affirm" | "deny" | "question" | "answer", chicagoBlock = false): string {
  if (level === "question") {
    return "text-[13px] font-bold leading-snug tracking-[0.06em] text-amber-800/95";
  }
  if (level === "answer") {
    return "text-[13px] font-bold leading-snug tracking-[0.04em] text-ink/50";
  }
  if (level === "affirm") {
    return chicagoBlock
      ? "text-[16px] font-bold leading-snug text-amber-800/95"
      : "text-[15px] font-bold leading-snug text-amber-800/95";
  }
  return chicagoBlock
    ? "text-[16px] font-bold leading-snug text-ink/55"
    : "text-[15px] font-bold leading-snug text-ink/62";
}

function bodyClass(level: CreedBodyLevel): string {
  if (level === "question") {
    return "text-[16px] font-semibold leading-[1.65] text-ink/94";
  }
  if (level === "answer") {
    return "text-[15px] leading-[1.72] text-ink/86";
  }
  return BODY_CLASS;
}

function renderAffirmDenySegment(segment: CreedBodySegment, index: number) {
  const labelSuffix = segment.title && /[：:]$/.test(segment.title) ? "" : "：";

  return (
    <p
      key={index}
      className={[BODY_CLASS, segment.level === "affirm" ? "mt-1.5" : "mt-2.5"].join(" ")}
    >
      {segment.title ? (
        <span className={stanceLabelClass(segment.level as "affirm" | "deny")}>
          {segment.title}
          {labelSuffix}
        </span>
      ) : null}
      {segment.body ? <CreedScriptureRichText text={segment.body} /> : null}
    </p>
  );
}

function renderChicagoStanceContent(segments: CreedBodySegment[]) {
  return (
    <p className={BODY_CLASS}>
      {segments.map((segment, index) => {
        const labelSuffix = segment.title && /[：:]$/.test(segment.title) ? "" : "：";
        return (
          <span key={index}>
            {segment.title ? (
              <span className={stanceLabelClass(segment.level as "affirm" | "deny", true)}>
                {segment.title}
                {labelSuffix}
              </span>
            ) : null}
            {segment.body ? <CreedScriptureRichText text={segment.body} /> : null}
          </span>
        );
      })}
    </p>
  );
}

function renderChicagoArticleBlock(block: CreedBodySegment[], lead: boolean) {
  const [heading, ...rest] = block;

  return (
    <section
      className={[lead ? "mt-[72px] mb-0 pt-0" : "mt-[160px] mb-0 pt-0", "space-y-0"].join(" ")}
    >
      {heading?.title ? (
        <h4
          className={[
            "text-[20px] font-bold leading-[1.2] tracking-[0.03em] text-amber-800",
            lead ? "mb-0.5" : "mb-1",
          ].join(" ")}
        >
          {heading.title}
        </h4>
      ) : null}
      {rest.length > 0 ? renderChicagoStanceContent(rest) : null}
    </section>
  );
}

function renderSegment(segments: CreedBodySegment[], segment: CreedBodySegment, index: number) {
  if (segment.level === "paragraph" && !segment.title) {
    return (
      <p key={index} className={`mt-1 ${BODY_CLASS}`}>
        <CreedScriptureRichText text={segment.body} />
      </p>
    );
  }

  if (segment.level === "proof-item") {
    return (
      <div key={index} className={wrapClass(segment.level)}>
        {segment.title ? <span className={titleClass(segment.level)}>{segment.title}</span> : null}
        {segment.body ? (
          <span className="text-ink/86">
            <CreedScriptureRichText text={segment.body} />
          </span>
        ) : null}
      </div>
    );
  }

  if (segment.level === "affirm" || segment.level === "deny") {
    return renderAffirmDenySegment(segment, index);
  }

  if (segment.level === "question" || segment.level === "answer") {
    const followsPrior =
      segment.level === "question" && index > 0 && segments[index - 1]?.level === "answer";
    return (
      <div
        key={index}
        className={[
          wrapClass(segment.level),
          followsPrior ? "mt-7 border-t border-amber-900/12 pt-5" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {segment.title ? (
          <p className={stanceLabelClass(segment.level)}>{segment.title}</p>
        ) : null}
        {segment.body ? (
          <p className={bodyClass(segment.level)}>
            <CreedScriptureRichText text={segment.body} />
          </p>
        ) : null}
      </div>
    );
  }

  if (segment.level === "subarticle") {
    return (
      <div
        key={index}
        className={wrapClass(segment.level)}
        style={{ borderLeftColor: READ_NEW_TESTAMENT_ACCENT }}
      >
        {segment.title ? <p className={titleClass(segment.level)}>{segment.title}</p> : null}
        {segment.body ? (
          <p className={BODY_CLASS}>
            <CreedScriptureRichText text={segment.body} />
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      key={index}
      className={isArticleHeading(segment) ? "mt-10 mb-4 space-y-0" : wrapClass(segment.level)}
    >
      {segment.title ? <p className={titleClass(segment.level)}>{segment.title}</p> : null}
      {segment.body ? (
        <p className={BODY_CLASS}>
          <CreedScriptureRichText text={segment.body} />
        </p>
      ) : null}
    </div>
  );
}

export function HistoricalCreedBodyBlock({ text, chicagoArticleLead = false }: Props) {
  const segments = expandCreedBodyParagraph(text);
  const { block, rest } = peelChicagoArticleBlock(segments);

  if (block) {
    return (
      <>
        {renderChicagoArticleBlock(block, chicagoArticleLead)}
        {rest.map((segment, index) => renderSegment(segments, segment, index))}
      </>
    );
  }

  return <>{segments.map((segment, index) => renderSegment(segments, segment, index))}</>;
}
