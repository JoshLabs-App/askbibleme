import { Pressable, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { filterEternityScriptures, formatScriptureBlockBody } from "./years-days-eternity-blocks";
import type {
  YearsDaysEternityFinale,
  YearsDaysEternityScriptureBlock,
  YearsDaysEternitySection,
} from "./years-days-eternity-types";
import { yearsDaysEternitySectionStyles as styles } from "./ExploreYearsDaysEternitySectionStyles";
import { stripSectionTitlePrefix } from "./yearsDaysEternityRefUtils";

export function ProseBlock({ lines, center }: { lines: string[]; center?: boolean }) {
  return (
    <View style={[styles.proseBlock, center && styles.proseBlockCenter]}>
      {lines.map((line, i) => (
        <Text key={i} style={[styles.proseLine, center && styles.proseLineCenter]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function CompactScriptureFlow({
  scriptures,
  bodyOverrideByRef,
  refOverrideByRef,
}: {
  scriptures: YearsDaysEternityScriptureBlock[];
  bodyOverrideByRef?: Record<string, string>;
  refOverrideByRef?: Record<string, string>;
}) {
  if (scriptures.length === 0) return null;
  return (
    <View style={styles.scriptureFlowCol}>
      {scriptures.map((block, i) => (
        <View key={`${block.ref}-${i}`} style={styles.scripturePassage}>
          <Text style={styles.scriptureFlow}>
            {bodyOverrideByRef?.[block.ref] ?? formatScriptureBlockBody(block.lines)}
          </Text>
          <Text style={styles.scriptureRefLine}>— {refOverrideByRef?.[block.ref] ?? block.ref}</Text>
        </View>
      ))}
    </View>
  );
}

export function EncouragementSection({ scripture }: { scripture: YearsDaysEternityScriptureBlock }) {
  return (
    <View style={styles.encouragement}>
      <View style={styles.encouragementRule} />
      <View style={styles.encouragementScripture}>
        {scripture.lines.map((line, i) => (
          <Text key={i} style={styles.encouragementVerseLine}>
            {line}
          </Text>
        ))}
        <Text style={styles.encouragementRefLine}>— {scripture.ref}</Text>
      </View>
    </View>
  );
}

export function ClosingFinaleSection({ finale }: { finale: YearsDaysEternityFinale }) {
  const { leadLines, scripture } = finale;
  return (
    <View style={styles.finale}>
      <View style={styles.finaleRule} />
      <View style={styles.finaleInner}>
        <View style={styles.finaleLead}>
          {leadLines.map((line, i) => (
            <Text key={i} style={styles.finaleLeadLine}>
              {line}
            </Text>
          ))}
        </View>
        <View style={styles.finaleScripture}>
          {scripture.lines.map((line, i) => (
            <Text key={i} style={styles.finaleVerseLine}>
              {line}
            </Text>
          ))}
          <Text style={styles.finaleRefLine}>— {scripture.ref}</Text>
        </View>
      </View>
    </View>
  );
}

type AccordionProps = {
  sections: YearsDaysEternitySection[];
  expandedCategoryIndex: number | null;
  accordionReady: boolean;
  enScriptureBodyByRef: Record<string, string>;
  localizedRefByRaw: Record<string, string>;
  locale: string;
  onToggleSection: (index: number) => void;
};

export function ExploreYearsDaysEternityAccordion({
  sections,
  expandedCategoryIndex,
  accordionReady,
  enScriptureBodyByRef,
  localizedRefByRaw,
  locale,
  onToggleSection,
}: AccordionProps) {
  if (!accordionReady) return null;

  return (
    <View style={styles.accordionList}>
      {sections.map((section, index) => (
        <View key={section.id} style={styles.accordionItem}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onToggleSection(index)}
            style={({ pressed }) => [styles.accordionHeader, pressed && styles.accordionHeaderPressed]}
          >
            <View style={styles.headerTextWrap}>
              <Text style={styles.sectionIndexText}>{String(index + 1)}.</Text>
              <Text style={styles.sectionTitle}>{stripSectionTitlePrefix(section.title)}</Text>
            </View>
            <Text style={styles.sectionChevron}>{expandedCategoryIndex === index ? "−" : "+"}</Text>
          </Pressable>
          {expandedCategoryIndex === index ? (
            <View style={styles.accordionBody}>
              <CompactScriptureFlow
                scriptures={filterEternityScriptures(section.blocks)}
                bodyOverrideByRef={locale === "en" ? enScriptureBodyByRef : undefined}
                refOverrideByRef={localizedRefByRaw}
              />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
