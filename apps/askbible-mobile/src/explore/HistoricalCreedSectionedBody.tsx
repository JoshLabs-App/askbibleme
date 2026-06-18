import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  buildSectionedCreedBody,
  creedBodySectionHasSubsections,
  type CreedBodySection,
  type SectionedCreedBody,
} from "../../../../lib/explore/historical-creeds-body-sections";
import { isChicagoArticleParagraph } from "../../../../lib/explore/historical-creeds-body-format";
import type { AppLocale } from "../../../../lib/i18n/config";
import { HistoricalCreedBodyBlock } from "./HistoricalCreedBodyBlock";
import { historicalCreedsScreenStyles as styles } from "./ExploreHistoricalCreedsScreenStyles";

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
    <View style={styles.creedBodyTopicSectionsWrap}>
      {topics.map((topic) => {
        const open = openTopicId === topic.id;
        return (
          <View key={`${creedId}-topic-${topic.id}`} style={styles.creedBodySectionBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => onToggleTopic(topic.id)}
              style={({ pressed }) => [
                styles.creedBodySectionHeader,
                pressed && styles.creedBodySectionHeaderPressed,
              ]}
            >
              <Text style={styles.creedBodySectionTitle}>{topic.label}</Text>
              <Text style={styles.creedBodySectionMark}>{open ? "−" : "+"}</Text>
            </Pressable>
            {open ? (
              <View style={styles.creedBodySectionContent}>
                {topic.paragraphs.map((paragraph, index) => (
                  <HistoricalCreedBodyBlock
                    key={`${creedId}-topic-${topic.id}-${index}`}
                    text={paragraph}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
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
      <View style={styles.creedBodySectionsWrap}>
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
      </View>
    );
  }

  const toggleSection = (sectionId: string) => {
    setOpenSectionId((current) => (current === sectionId ? null : sectionId));
  };

  if (partGrouped) {
    return (
      <View style={styles.creedBodySectionsWrap}>
        {sectioned.intro.map((paragraph, index) => (
          <HistoricalCreedBodyBlock key={`${creedId}-intro-${index}`} text={paragraph} />
        ))}
        {sectioned.sections.map((part) => (
          <View key={`${creedId}-part-${part.id}`} style={styles.creedBodyPartGroup}>
            <Text style={styles.creedBodyPartHeading}>{part.label}</Text>
            <TopicAccordionList
              creedId={creedId}
              topics={part.subsections ?? []}
              openTopicId={openSectionId}
              onToggleTopic={toggleSection}
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.creedBodySectionsWrap}>
      {sectioned.intro.map((paragraph, index) => (
        <HistoricalCreedBodyBlock key={`${creedId}-intro-${index}`} text={paragraph} />
      ))}
      {sectioned.sections.map((section) => {
        const open = openSectionId === section.id;
        return (
          <View key={`${creedId}-section-${section.id}`} style={styles.creedBodySectionBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => toggleSection(section.id)}
              style={({ pressed }) => [
                styles.creedBodySectionHeader,
                pressed && styles.creedBodySectionHeaderPressed,
              ]}
            >
              <Text style={styles.creedBodySectionTitle}>{section.label}</Text>
              <Text style={styles.creedBodySectionMark}>{open ? "−" : "+"}</Text>
            </Pressable>
            {open ? (
              <View style={styles.creedBodySectionContent}>
                {section.paragraphs.map((paragraph, index) => (
                  <HistoricalCreedBodyBlock
                    key={`${creedId}-section-${section.id}-${index}`}
                    text={paragraph}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
