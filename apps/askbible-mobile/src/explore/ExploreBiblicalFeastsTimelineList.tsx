import { Pressable, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { t } from "../i18n/site-copy";
import {
  formatReadTargetLabel,
  type FeastReadTarget,
  type MappedFeastRow,
} from "./biblicalFeastsTimeline";
import { biblicalFeastsScreenStyles as styles } from "./ExploreBiblicalFeastsScreenStyles";

type Props = {
  feast: MappedFeastRow;
  index: number;
  totalCount: number;
  expanded: boolean;
  collapseToId: string;
  locale: string;
  onToggleExpand: (nextId: string) => void;
  onOpenRead: (target: FeastReadTarget) => void;
};

export function ExploreBiblicalFeastsTimelineRow({
  feast,
  index,
  totalCount,
  expanded,
  collapseToId,
  locale,
  onToggleExpand,
  onOpenRead,
}: Props) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <Text style={styles.timelineMonth}>{feast.month}</Text>
        <Text style={styles.timelineDay}>{feast.date}</Text>
      </View>
      <View style={styles.timelineRailWrap}>
        {index < totalCount - 1 ? <View style={styles.timelineRail} /> : null}
        <View style={styles.timelineDotWrap}>
          <View style={styles.timelineDot} />
        </View>
        <Text style={styles.timelineOrder}>{feast.orderLabel}</Text>
      </View>
      <View style={styles.feastCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onToggleExpand(expanded ? collapseToId : feast.id)}
          style={({ pressed }) => [styles.feastHeaderPressable, pressed && styles.feastHeaderPressed]}
        >
          <View style={styles.feastHeader}>
            <Text style={styles.feastTitle}>{feast.title}</Text>
            <Text style={styles.feastExpandMark}>{expanded ? "−" : "+"}</Text>
          </View>
          <Text style={styles.feastScripture}>{feast.scripture}</Text>
        </Pressable>
        {expanded ? (
          <View style={styles.feastDetails}>
            <Text style={styles.feastSummary}>{feast.summary}</Text>
            <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsFulfillmentLabel")}</Text>
            <Text style={styles.feastSecondary}>{feast.fulfillment}</Text>
            <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsActionLabel")}</Text>
            <Text style={styles.feastPractice}>{feast.practice}</Text>
            <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsKeyScripturesLabel")}</Text>
            <View style={styles.readTargetsWrap}>
              {feast.readTargets.map((target) => (
                <Pressable
                  key={`${feast.id}-${target.label}`}
                  onPress={() => onOpenRead(target)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.readTargetButton, pressed && styles.readTargetButtonPressed]}
                >
                  <Text style={styles.readTargetButtonText}>{formatReadTargetLabel(target, locale)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => onOpenRead(feast.readTargets[0])}
              accessibilityRole="button"
              style={({ pressed }) => [styles.readNowButton, pressed && styles.readNowButtonPressed]}
            >
              <Text style={styles.readNowButtonText}>{t("pages.explore.biblicalFeastsReadNowCta")}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type ListProps = {
  rows: MappedFeastRow[];
  expandedFeastId: string;
  collapseToId: string;
  locale: string;
  showSeasonLabels?: boolean;
  onToggleExpand: (nextId: string) => void;
  onOpenRead: (target: FeastReadTarget) => void;
};

export function ExploreBiblicalFeastsTimelineList({
  rows,
  expandedFeastId,
  collapseToId,
  locale,
  showSeasonLabels = false,
  onToggleExpand,
  onOpenRead,
}: ListProps) {
  return (
    <View style={styles.timelineList}>
      {rows.map((feast, index) => {
        const showSeasonLabel =
          showSeasonLabels && (index === 0 || rows[index - 1]?.season !== feast.season);
        return (
          <View key={feast.id}>
            {showSeasonLabel ? <Text style={styles.seasonLabel}>{feast.seasonLabel}</Text> : null}
            <ExploreBiblicalFeastsTimelineRow
              feast={feast}
              index={index}
              totalCount={rows.length}
              expanded={expandedFeastId === feast.id}
              collapseToId={collapseToId}
              locale={locale}
              onToggleExpand={onToggleExpand}
              onOpenRead={onOpenRead}
            />
          </View>
        );
      })}
    </View>
  );
}
