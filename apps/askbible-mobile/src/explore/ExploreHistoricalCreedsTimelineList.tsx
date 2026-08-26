import { memo } from "react";
import { Pressable, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { t } from "../i18n/site-copy";
import type { AppLocale } from "../../../../lib/i18n/config";
import type { MappedHistoricalCreedRow } from "./historicalCreedsTimeline";
import { HistoricalCreedFullTextPanel } from "./HistoricalCreedFullTextPanel";
import { historicalCreedsScreenStyles as styles } from "./ExploreHistoricalCreedsScreenStyles";

type RowProps = {
  creed: MappedHistoricalCreedRow;
  index: number;
  totalCount: number;
  expanded: boolean;
  fullTextOpen: boolean;
  collapseToId: string;
  locale: AppLocale;
  onToggleExpand: (nextId: string) => void;
  onToggleFullText: (creedId: string) => void;
};

export const ExploreHistoricalCreedsTimelineRow = memo(function ExploreHistoricalCreedsTimelineRow({
  creed,
  index,
  totalCount,
  expanded,
  fullTextOpen,
  collapseToId,
  locale,
  onToggleExpand,
  onToggleFullText,
}: RowProps) {
  const featured = creed.isCoreEcumenical;

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRailWrap}>
        {index < totalCount - 1 ? <View style={styles.timelineRail} /> : null}
        <View style={[styles.timelineDotWrap, featured && styles.timelineDotWrapFeatured]}>
          <View style={[styles.timelineDot, featured && styles.timelineDotFeatured]} />
        </View>
      </View>
      <View style={styles.timelineContent}>
        <View style={styles.creedYearRow}>
          <Text style={[styles.timelineYearPrimary, featured && styles.timelineYearFeatured]}>
            {creed.yearRight}
          </Text>
        </View>
        <View style={[styles.creedCard, featured && styles.creedCardFeatured]}>
          {featured ? <View style={styles.creedFeaturedStripe} /> : null}
          {featured ? (
            <Text style={styles.creedFeaturedBadge}>{t("pages.explore.historicalCreedsCoreEcumenicalBadge")}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => onToggleExpand(expanded ? collapseToId : creed.id)}
            style={({ pressed }) => [styles.creedHeaderPressable, pressed && styles.creedHeaderPressed]}
          >
            <View style={styles.creedHeader}>
              <View style={styles.creedTitleRow}>
                <Text style={[styles.creedOrder, featured && styles.creedOrderFeatured]}>{creed.orderLabel}</Text>
                <Text style={[styles.creedTitle, featured && styles.creedTitleFeatured]}>{creed.title}</Text>
              </View>
              <View style={styles.creedHeaderRight}>
                <Text style={styles.creedExpandMark}>{expanded ? "−" : "+"}</Text>
              </View>
            </View>
          </Pressable>
          <View style={styles.creedProblemBlock}>
            <Text style={styles.sectionLabel}>{t("pages.explore.historicalCreedsProblemLabel")}</Text>
            <Text style={styles.creedBody}>{creed.problemAddressed}</Text>
          </View>
          {expanded ? (
            <View style={styles.creedDetails}>
              <Text style={styles.sectionLabel}>{t("pages.explore.historicalCreedsSignificanceLabel")}</Text>
              <Text style={styles.creedBody}>{creed.significance}</Text>
            </View>
          ) : null}
          {creed.hasBody ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onToggleFullText(creed.id)}
              style={({ pressed }) => [styles.readFullButton, pressed && styles.readFullButtonPressed]}
            >
              <Text style={styles.readFullButtonText}>
                {fullTextOpen
                  ? t("pages.explore.historicalCreedsCollapseFullLabel")
                  : t("pages.explore.historicalCreedsReadFullLabel")}
              </Text>
            </Pressable>
          ) : null}
          {fullTextOpen ? (
            <View style={styles.creedFullTextBlock}>
              <Text style={styles.sectionLabel}>{t("pages.explore.historicalCreedsFullTextLabel")}</Text>
              <HistoricalCreedFullTextPanel creedId={creed.id} locale={locale} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

type ListProps = {
  rows: MappedHistoricalCreedRow[];
  expandedCreedId: string;
  fullTextCreedId: string | null;
  collapseToId: string;
  locale: AppLocale;
  onToggleExpand: (nextId: string) => void;
  onToggleFullText: (creedId: string) => void;
};

export function ExploreHistoricalCreedsTimelineList({
  rows,
  expandedCreedId,
  fullTextCreedId,
  collapseToId,
  locale,
  onToggleExpand,
  onToggleFullText,
}: ListProps) {
  return (
    <View style={styles.timelineList}>
      {rows.map((creed, index) => {
        const showGroupLabel = index === 0 || rows[index - 1]?.group !== creed.group;
        return (
          <View key={creed.id}>
            {showGroupLabel ? (
              <>
                <Text style={styles.groupLabel}>{creed.groupLabel}</Text>
                {creed.group === "ecumenical" ? (
                  <Text style={styles.groupLead}>{t("pages.explore.historicalCreedsCoreEcumenicalLead")}</Text>
                ) : null}
              </>
            ) : null}
            <ExploreHistoricalCreedsTimelineRow
              creed={creed}
              index={index}
              totalCount={rows.length}
              expanded={expandedCreedId === creed.id}
              fullTextOpen={fullTextCreedId === creed.id}
              collapseToId={collapseToId}
              locale={locale}
              onToggleExpand={onToggleExpand}
              onToggleFullText={onToggleFullText}
            />
          </View>
        );
      })}
    </View>
  );
}
