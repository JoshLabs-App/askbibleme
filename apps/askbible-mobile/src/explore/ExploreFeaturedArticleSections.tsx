import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExploreFeaturedArticleSection } from "../../../../lib/explore/explore-featured-article-section-types";
import { exploreFeaturedArticleSectionHeaderLabel } from "../../../../lib/explore/explore-featured-article-section-label";
import { parchmentSans } from "../fonts/parchmentType";
import { ReadChapterInfoEditionMarkdown } from "../read/ReadChapterInfoEditionMarkdown";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

type Props = {
  sections: ExploreFeaturedArticleSection[];
  onLinkPress?: (url: string) => boolean | void;
};

export function ExploreFeaturedArticleSections({ sections, onLinkPress }: Props) {
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(() => sections[0]?.id ?? null);

  return (
    <View style={styles.accordionList}>
      {sections.map((section, index) => {
        const expanded = expandedSectionId === section.id;
        const header = exploreFeaturedArticleSectionHeaderLabel(section.title, index);
        return (
          <View key={section.id} style={styles.accordionItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => {
                setExpandedSectionId((current) => (current === section.id ? null : section.id));
              }}
              style={({ pressed }) => [styles.accordionHeader, pressed && styles.accordionHeaderPressed]}
            >
              <View style={styles.headerTextWrap}>
                <Text style={styles.sectionIndexText}>{header.indexLabel}</Text>
                <Text style={styles.sectionTitle} numberOfLines={3}>
                  {header.title}
                </Text>
              </View>
              <Text style={styles.sectionChevron}>{expanded ? "−" : "+"}</Text>
            </Pressable>
            {expanded ? (
              <View style={styles.sectionBody}>
                <ReadChapterInfoEditionMarkdown
                  content={section.body}
                  variant="info"
                  exploreArticle
                  plainScriptureLinks
                  onLinkPress={onLinkPress}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  accordionList: {
    gap: 10,
  },
  accordionItem: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.chapterCellBorder,
    backgroundColor: c.chapterCell,
    overflow: "hidden",
  },
  accordionHeader: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  accordionHeaderPressed: {
    backgroundColor: c.hover,
  },
  headerTextWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sectionIndexText: {
    fontSize: 16,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
  sectionChevron: {
    fontSize: 22,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.parchmentAccent,
    width: 18,
    textAlign: "center",
  },
  sectionBody: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 2,
  },
});
