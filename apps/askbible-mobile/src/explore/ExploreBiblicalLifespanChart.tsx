import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { InteractionManager, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { t, tFormat } from "../i18n/site-copy";
import { useLocale } from "../i18n/LocaleProvider";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { pushExploreReadChapter, EXPLORE_YEAR_DAY_COUNT_PATH } from "./explore-read-chapter-nav";
import { LOGO_TEXT_ACCENT_COLOR as LOGO_COLOR } from "../shell/logo-colors";
import {
  birthDateAgeYears,
  birthDateLifeDay,
  type ExploreBirthDate,
} from "./explore-birth-date";
import {
  isExploreYearDayProfileComplete,
  readExploreYearDayProfile,
  type ExploreYearDayProfile,
} from "./explore-birth-year-prefs";
import { getCenturySpanYears } from "./century-timeline";
import {
  getBiblicalLifespanNtScaleYears,
  getBiblicalLifespanScaleYears,
  getBiblicalLifespans,
  getBiblicalLifespanModernEra,
  biblicalLifespanBarWidthPct,
  isBiblicalLifespanNewTestamentEra,
  type BiblicalLifespanEntry,
} from "./biblical-lifespans";

const ERA_COL_W = 58;
const IS_ANDROID = Platform.OS === "android";

function LifespanEntryRow({
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

function ModernMilestoneDayRow({
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

function ModernLifespanRow({
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

function LifespanChartBlock({
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

type Props = {
  profileRefreshKey?: number;
  onOpenProfileSettings?: () => void;
  /** 父级已读 profile 时传入，避免重复 AsyncStorage 读取 */
  profile?: ExploreYearDayProfile | null;
  exploreReturn?: string | null;
};

export function ExploreBiblicalLifespanChart({
  profileRefreshKey = 0,
  onOpenProfileSettings,
  profile: profileProp,
  exploreReturn: exploreReturnProp,
}: Props) {
  const { locale } = useLocale();
  const router = useRouter();
  const exploreReturn = exploreReturnProp ?? EXPLORE_YEAR_DAY_COUNT_PATH;
  const [profileLocal, setProfileLocal] = useState<ExploreYearDayProfile | null>(null);
  const profile = profileProp !== undefined ? profileProp : profileLocal;
  const entries = useMemo(() => getBiblicalLifespans(locale), [locale]);
  const modernEraLabel = useMemo(() => getBiblicalLifespanModernEra(locale), [locale]);

  useEffect(() => {
    if (profileProp !== undefined) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readExploreYearDayProfile().then((next) => {
        if (!cancelled) setProfileLocal(next);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [profileProp, profileRefreshKey]);

  const modernProfile = useMemo(() => {
    if (!profile || !isExploreYearDayProfileComplete(profile)) return null;
    return profile;
  }, [profile]);

  const { mainEntries, newTestamentEntries } = useMemo(() => {
    const main: BiblicalLifespanEntry[] = [];
    const nt: BiblicalLifespanEntry[] = [];
    for (const entry of entries) {
      if (isBiblicalLifespanNewTestamentEra(entry.era)) nt.push(entry);
      else main.push(entry);
    }
    return { mainEntries: main, newTestamentEntries: nt };
  }, [entries]);

  const openInBible = (entry: BiblicalLifespanEntry) => {
    pushExploreReadChapter(
      router,
      {
        bookId: entry.bookId,
        chapter: entry.chapter,
        verse: entry.verseStart,
      },
      exploreReturn,
    );
  };

  return (
    <View style={styles.section}>
      {modernProfile?.birthDate && modernProfile.displayName ? (
        <View style={styles.modernSection}>
          <View style={[styles.chart, styles.modernChart]}>
            <ModernLifespanRow
              modernEraLabel={modernEraLabel}
              displayName={modernProfile.displayName}
              birthDate={modernProfile.birthDate}
              scaleYears={getCenturySpanYears()}
              isLastInModern={
                !modernProfile.weddingAnniversary && !modernProfile.baptismDate
              }
              onPress={onOpenProfileSettings}
            />
            {modernProfile.weddingAnniversary ? (
              <ModernMilestoneDayRow
                labelKey="pages.explore.yearDayCountMarriageLabel"
                anchorDate={modernProfile.weddingAnniversary}
                isLast={!modernProfile.baptismDate}
                onPress={onOpenProfileSettings}
              />
            ) : null}
            {modernProfile.baptismDate ? (
              <ModernMilestoneDayRow
                labelKey="pages.explore.yearDayCountBaptismLabel"
                anchorDate={modernProfile.baptismDate}
                isLast
                onPress={onOpenProfileSettings}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {modernProfile ? <View style={styles.groupDivider} /> : null}

      <Text style={[styles.heading, modernProfile ? styles.headingAfterModern : null]}>
        {t("pages.explore.yearDayCountLifespanHeading")}
      </Text>

      {newTestamentEntries.length > 0 ? (
        <View style={styles.ntSection}>
          <Text style={styles.ntScaleHint}>
            {tFormat("pages.explore.yearDayCountLifespanNtScale", {
              years: getBiblicalLifespanNtScaleYears(),
            })}
          </Text>
          <View style={styles.ntDisciplesHeadingRow}>
            <View style={styles.eraColSpacer} />
            <View style={styles.bodyCol}>
              <Text style={styles.ntMinorHeading}>
                {t("pages.explore.yearDayCountLifespanNtDisciplesHeading")}
              </Text>
            </View>
          </View>
          <LifespanChartBlock
            entries={newTestamentEntries}
            scaleYears={getBiblicalLifespanNtScaleYears()}
            onOpen={openInBible}
            chartStyle={styles.ntChartCompact}
          />
        </View>
      ) : null}

      <View style={styles.mainSection}>
        {newTestamentEntries.length > 0 ? (
          <View style={styles.sectionDivider} />
        ) : null}
        <Text style={styles.scaleHint}>
          {tFormat("pages.explore.yearDayCountLifespanScale", {
            years: getBiblicalLifespanScaleYears(),
          })}
        </Text>
        <LifespanChartBlock
          entries={mainEntries}
          scaleYears={getBiblicalLifespanScaleYears()}
          onOpen={openInBible}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    paddingTop: 4,
  },
  heading: {
    fontSize: 15,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  headingAfterModern: {
    marginTop: 8,
  },
  scaleHint: {
    marginTop: 6,
    fontSize: 11,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
  },
  chart: {
    marginTop: 18,
  },
  modernSection: {
    marginTop: 10,
  },
  modernChart: {
    marginTop: 0,
  },
  ntSection: {
    marginTop: 2,
  },
  mainSection: {
    marginTop: 4,
  },
  sectionDivider: {
    marginTop: 10,
    marginBottom: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderStrong,
  },
  groupDivider: {
    marginTop: 8,
    marginBottom: 8,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderStrong,
  },
  ntScaleHint: {
    fontSize: 11,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  ntDisciplesHeadingRow: {
    marginTop: 2,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  ntChartCompact: {
    marginTop: 8,
  },
  eraColSpacer: {
    width: ERA_COL_W,
  },
  ntMinorHeading: {
    fontSize: 11,
    ...parchmentSans(600),
    color: c.faint,
    textAlign: "left",
    letterSpacing: 0.1,
  },
  entry: {},
  entryGap: {
    marginBottom: IS_ANDROID ? 6 : 8,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  eraCol: {
    width: ERA_COL_W,
    paddingRight: 8,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRightColor: c.borderStrong,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  eraColContinued: {
    borderRightColor: c.border,
  },
  eraLabel: {
    fontSize: 10,
    lineHeight: IS_ANDROID ? 12 : 14,
    ...parchmentSans(500),
    color: c.muted,
    textAlign: "right",
    includeFontPadding: false,
  },
  bodyCol: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 8,
    rowGap: IS_ANDROID ? 0 : 2,
  },
  metaPressed: { opacity: 0.72 },
  name: {
    fontSize: 14,
    lineHeight: IS_ANDROID ? 16 : 18,
    ...parchmentSans(600),
    color: c.ink,
    includeFontPadding: false,
  },
  lifespan: {
    fontSize: 13,
    lineHeight: IS_ANDROID ? 15 : 17,
    ...parchmentSans(600),
    color: LOGO_COLOR,
    includeFontPadding: false,
  },
  ref: {
    fontSize: 12,
    lineHeight: IS_ANDROID ? 14 : 16,
    ...parchmentSans(500),
    color: c.faint,
    flexShrink: 1,
    includeFontPadding: false,
  },
  modernName: {
    fontSize: 15,
  },
  modernDisplayName: {
    fontSize: 21,
  },
  modernLifespan: {
    fontSize: 14,
  },
  modernRef: {
    fontSize: 13,
  },
  barTrack: {
    marginTop: IS_ANDROID ? 4 : 6,
    height: 6,
    width: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(120, 53, 15, 0.12)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: LOGO_COLOR,
    minWidth: 3,
  },
});
