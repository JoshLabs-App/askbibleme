import { Text, View } from "react-native";
import {
  expandCreedBodyParagraph,
  peelChicagoArticleBlock,
  type CreedBodyLevel,
  type CreedBodySegment,
} from "../../../../lib/explore/historical-creeds-body-format";
import { CreedScriptureRichText } from "./CreedScriptureRichText";
import { historicalCreedsScreenStyles as styles } from "./ExploreHistoricalCreedsScreenStyles";

type Props = {
  text: string;
  chicagoArticleLead?: boolean;
};

function segmentWrapStyle(level: CreedBodyLevel) {
  switch (level) {
    case "document":
      return styles.creedFullTextDocumentWrap;
    case "section":
      return styles.creedFullTextSectionWrap;
    case "lords-day":
      return styles.creedFullTextLordsDayWrap;
    case "subsection":
      return styles.creedFullTextSubsectionWrap;
    case "article-label":
      return styles.creedFullTextArticleLabelWrap;
    case "subarticle":
      return styles.creedFullTextSubarticleWrap;
    case "proof-item":
      return styles.creedFullTextProofItemWrap;
    case "affirm":
      return styles.creedFullTextAffirmWrap;
    case "deny":
      return styles.creedFullTextDenyWrap;
    case "question":
      return styles.creedFullTextQuestionWrap;
    case "answer":
      return styles.creedFullTextAnswerWrap;
    default:
      return styles.creedFullTextArticleWrap;
  }
}

function isArticleHeading(segment: CreedBodySegment): boolean {
  return segment.level === "article" && !!segment.title && !segment.body;
}

function segmentTitleStyle(level: CreedBodyLevel) {
  switch (level) {
    case "document":
      return styles.creedFullTextDocumentTitle;
    case "section":
      return styles.creedFullTextSectionTitle;
    case "lords-day":
      return styles.creedFullTextLordsDayTitle;
    case "subsection":
      return styles.creedFullTextSubsectionTitle;
    case "article-label":
      return styles.creedFullTextArticleLabelTitle;
    case "subarticle":
      return styles.creedFullTextSubarticleTitle;
    default:
      return styles.creedFullTextArticleTitle;
  }
}

function renderAffirmDenySegment(segment: CreedBodySegment, index: number) {
  const isAffirm = segment.level === "affirm";
  const labelStyle = isAffirm ? styles.creedFullTextAffirmLabel : styles.creedFullTextDenyLabel;
  const bodyStyle = styles.creedFullTextParagraph;
  const wrapStyle = isAffirm ? styles.creedFullTextAffirmWrap : styles.creedFullTextDenyWrap;
  const labelSuffix = segment.title && /[：:]$/.test(segment.title) ? "" : "：";

  return (
    <View key={index} style={wrapStyle}>
      <Text style={bodyStyle}>
        {segment.title ? (
          <Text style={labelStyle}>
            {segment.title}
            {labelSuffix}
          </Text>
        ) : null}
        {segment.body ? <CreedScriptureRichText text={segment.body} bodyStyle={bodyStyle} /> : null}
      </Text>
    </View>
  );
}

function renderChicagoStanceContent(segments: CreedBodySegment[]) {
  return (
    <Text style={styles.creedChicagoBody}>
      {segments.map((segment, index) => {
        const isAffirm = segment.level === "affirm";
        const labelStyle = isAffirm
          ? styles.creedChicagoAffirmLabel
          : styles.creedChicagoDenyLabel;
        const labelSuffix = segment.title && /[：:]$/.test(segment.title) ? "" : "：";

        return (
          <Text key={index}>
            {segment.title ? (
              <Text style={labelStyle}>
                {segment.title}
                {labelSuffix}
              </Text>
            ) : null}
            {segment.body ? (
              <CreedScriptureRichText text={segment.body} bodyStyle={styles.creedChicagoBody} />
            ) : null}
          </Text>
        );
      })}
    </Text>
  );
}

function renderChicagoArticleBlock(block: CreedBodySegment[], lead: boolean, key: string) {
  const [heading, ...rest] = block;

  return (
    <View
      key={key}
      style={[styles.creedChicagoArticleBlock, lead ? styles.creedChicagoArticleBlockLead : null]}
    >
      {heading?.title ? (
        <Text
          style={[
            styles.creedChicagoArticleTitle,
            lead ? styles.creedChicagoArticleTitleLead : null,
          ]}
        >
          {heading.title}
        </Text>
      ) : null}
      {rest.length > 0 ? renderChicagoStanceContent(rest) : null}
    </View>
  );
}

function renderSegment(segment: CreedBodySegment, index: number) {
  if (segment.level === "paragraph" && !segment.title) {
    return (
      <CreedScriptureRichText
        key={index}
        text={segment.body}
        bodyStyle={styles.creedFullTextParagraph}
      />
    );
  }

  if (segment.level === "proof-item") {
    return (
      <View key={index} style={segmentWrapStyle(segment.level)}>
        {segment.title ? (
          <Text style={styles.creedFullTextProofItemLabel}>{segment.title}</Text>
        ) : null}
        {segment.body ? (
          <CreedScriptureRichText text={segment.body} bodyStyle={styles.creedFullTextProofItem} />
        ) : null}
      </View>
    );
  }

  if (segment.level === "affirm" || segment.level === "deny") {
    return renderAffirmDenySegment(segment, index);
  }

  if (segment.level === "question" || segment.level === "answer") {
    const isQuestion = segment.level === "question";
    const isFirst = index === 0;
    return (
      <View
        key={index}
        style={[
          segmentWrapStyle(segment.level),
          isQuestion && !isFirst ? styles.creedFullTextQuestionWrapFollows : null,
          !isQuestion ? styles.creedFullTextAnswerWrapSpacing : null,
        ]}
      >
        {segment.title ? (
          <Text
            style={isQuestion ? styles.creedFullTextQuestionLabel : styles.creedFullTextAnswerLabel}
          >
            {segment.title}
          </Text>
        ) : null}
        {segment.body ? (
          <CreedScriptureRichText
            text={segment.body}
            bodyStyle={
              isQuestion ? styles.creedFullTextQuestionBody : styles.creedFullTextAnswerBody
            }
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      key={index}
      style={
        isArticleHeading(segment)
          ? styles.creedFullTextArticleHeadingWrap
          : segmentWrapStyle(segment.level)
      }
    >
      {segment.title ? <Text style={segmentTitleStyle(segment.level)}>{segment.title}</Text> : null}
      {segment.body ? <CreedScriptureRichText text={segment.body} /> : null}
    </View>
  );
}

export function HistoricalCreedBodyBlock({ text, chicagoArticleLead = false }: Props) {
  const segments = expandCreedBodyParagraph(text);
  const { block, rest } = peelChicagoArticleBlock(segments);

  if (block) {
    return (
      <>
        {renderChicagoArticleBlock(block, chicagoArticleLead, "chicago-block")}
        {rest.map((segment, index) => renderSegment(segment, index))}
      </>
    );
  }

  return <>{segments.map((segment, index) => renderSegment(segment, index))}</>;
}
