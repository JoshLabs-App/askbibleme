import { useMemo } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import {
  birthDateAgeYears,
  birthDateLifeDay,
  type ExploreBirthDate,
} from "./explore-birth-date";
import {
  biblicalLifespanBarWidthPct,
  type BiblicalLifespanEntry,
} from "./biblical-lifespans";
import { biblicalLifespanChartStyles as styles } from "./ExploreBiblicalLifespanChartStyles";

export function LifespanEntryRow({
  entry,
  showEra,
  isLastInEra,
  scaleYears,
  onOpen,
}: {
  entry: BiblicalLifespanEntry;
  showEra: boolean;
  isLastInEra: boolean;
  scaleYears: number;
  onOpen: (entry: BiblicalLifespanEntry) => void;
}) {
  const barPct = biblicalLifespanBarWidthPct(entry.years, scaleYears);

  return (
    <View style={[styles.entry, !isLastInEra && styles.entryGap]}>
      <View style={styles.entryRow}>
        <View style={[styles.eraCol, !isLastInEra && styles.eraColContinued]}>
          {showEra ? (
            <Text style={styles.eraLabel} numberOfLines={3}>
              {entry.era}
            </Text>
          ) : null}
        </View>
        <View style={styles.bodyCol}>
          <Pressable
            onPress={() => onOpen(entry)}
            style={({ pressed }) => [styles.metaRow, pressed && styles.metaPressed]}
            accessibilityRole="link"
            accessibilityLabel={`${entry.name} ${entry.lifespanDisplay} ${entry.refDisplay}`}
          >
            <Text style={styles.name} numberOfLines={1}>
              {entry.name}
            </Text>
            <Text style={styles.lifespan} numberOfLines={1}>
              {entry.lifespanDisplay}
            </Text>
            <Text style={styles.ref} numberOfLines={1}>
              {entry.refDisplay}
            </Text>
          </Pressable>
          <View style={styles.barTrack} accessibilityLabel={entry.lifespanDisplay}>
            <View style={[styles.barFill, { width: `${barPct}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function ModernMilestoneDayRow({
  labelKey,
  anchorDate,
  isLast,
  onPress,
}: {
  labelKey: string;
  anchorDate: ExploreBirthDate;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const milestoneDay = birthDateLifeDay(anchorDate, now);
  const dayDisplay = tFormat("pages.explore.centuryTimelineLifeDay", {
    day: milestoneDay.toLocaleString(),
  });
  const label = t(labelKey);
  const a11y = `${label} ${dayDisplay}`;

  return (
    <View style={[styles.entry, !isLast && styles.entryGap]}>
      <View style={styles.entryRow}>
        <View style={[styles.eraCol, styles.eraColContinued]} />
        <View style={styles.bodyCol}>
          <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [styles.metaRow, pressed && onPress && styles.metaPressed]}
            accessibilityRole={onPress ? "button" : "text"}
            accessibilityLabel={a11y}
          >
            <Text style={[styles.name, styles.modernName]} numberOfLines={1}>
              {label}
            </Text>
            <Text style={[styles.lifespan, styles.modernLifespan]} numberOfLines={1}>
              {dayDisplay}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ModernLifespanRow({
  modernEraLabel,
  displayName,
  birthDate,
  scaleYears,
  isLastInModern,
  onPress,
}: {
  modernEraLabel: string;
  displayName: string;
  birthDate: ExploreBirthDate;
  scaleYears: number;
  isLastInModern: boolean;
  onPress?: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const ageYears = birthDateAgeYears(birthDate, now);
  const lifeDay = birthDateLifeDay(birthDate, now);
  const barPct = biblicalLifespanBarWidthPct(ageYears, scaleYears);
  const lifespanDisplay = tFormat("pages.explore.centuryTimelineAge", { age: ageYears });
  const refDisplay = tFormat("pages.explore.centuryTimelineLifeDay", {
    day: lifeDay.toLocaleString(),
  });
  const a11y = `${displayName} ${lifespanDisplay} ${refDisplay}`;

  return (
    <View style={[styles.entry, !isLastInModern && styles.entryGap]}>
      <View style={styles.entryRow}>
        <View style={[styles.eraCol, !isLastInModern && styles.eraColContinued]}>
          <Text style={styles.eraLabel} numberOfLines={2}>
            {modernEraLabel}
          </Text>
        </View>
        <View style={styles.bodyCol}>
          <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [styles.metaRow, pressed && onPress && styles.metaPressed]}
            accessibilityRole={onPress ? "button" : "text"}
            accessibilityLabel={a11y}
          >
            <Text style={[styles.name, styles.modernDisplayName]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.lifespan, styles.modernLifespan]} numberOfLines={1}>
              {lifespanDisplay}
            </Text>
            <Text style={[styles.ref, styles.modernRef]} numberOfLines={2}>
              {refDisplay}
            </Text>
          </Pressable>
          <View style={styles.barTrack} accessibilityLabel={lifespanDisplay}>
            <View style={[styles.barFill, { width: `${barPct}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function LifespanChartBlock({
  entries,
  scaleYears,
  onOpen,
  chartStyle,
}: {
  entries: BiblicalLifespanEntry[];
  scaleYears: number;
  onOpen: (entry: BiblicalLifespanEntry) => void;
  chartStyle?: ViewStyle;
}) {
  if (entries.length === 0) return null;

  return (
    <View style={[styles.chart, chartStyle]}>
      {entries.map((entry, index) => {
        const prev = entries[index - 1];
        const next = entries[index + 1];
        const showEra = index === 0 || prev.era !== entry.era;
        const isLastInEra = !next || next.era !== entry.era;
        return (
          <LifespanEntryRow
            key={entry.id}
            entry={entry}
            showEra={showEra}
            isLastInEra={isLastInEra}
            scaleYears={scaleYears}
            onOpen={onOpen}
          />
        );
      })}
    </View>
  );
}
