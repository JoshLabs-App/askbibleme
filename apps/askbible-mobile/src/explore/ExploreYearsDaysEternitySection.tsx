import { View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { filterEternityProse } from "./years-days-eternity-blocks";
import { exploreStyles as shared } from "./exploreParchmentStyles";
import {
  ClosingFinaleSection,
  EncouragementSection,
  ExploreYearsDaysEternityAccordion,
  ProseBlock,
} from "./ExploreYearsDaysEternitySubsections";
import { yearsDaysEternitySectionStyles as styles } from "./ExploreYearsDaysEternitySectionStyles";
import { useExploreYearsDaysEternitySection } from "./useExploreYearsDaysEternitySection";

export function ExploreYearsDaysEternitySection() {
  const {
    locale,
    doc,
    timelineCaption,
    fullScriptureSections,
    expandedCategoryIndex,
    accordionReady,
    enScriptureBodyByRef,
    localizedRefByRaw,
    onToggleSection,
  } = useExploreYearsDaysEternitySection();

  return (
    <View style={styles.section}>
      <View style={shared.yearDayCountRelatedDivider} />
      <Text style={styles.pageTitle}>{doc.pageTitle}</Text>
      <Text style={styles.eyebrow}>{timelineCaption}</Text>
      <View style={shared.yearDayCountRule} />

      <View style={styles.closing}>
        {filterEternityProse(doc.closing).map((lines, i) => (
          <ProseBlock key={i} lines={lines} center />
        ))}
      </View>

      <ClosingFinaleSection finale={doc.finale} />

      <ExploreYearsDaysEternityAccordion
        sections={fullScriptureSections}
        expandedCategoryIndex={expandedCategoryIndex}
        accordionReady={accordionReady}
        enScriptureBodyByRef={enScriptureBodyByRef}
        localizedRefByRaw={localizedRefByRaw}
        locale={locale}
        onToggleSection={onToggleSection}
      />

      <EncouragementSection scripture={doc.encouragement} />
    </View>
  );
}
