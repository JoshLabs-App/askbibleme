import { Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { getCenturySpanYears } from "./century-timeline";
import {
  getBiblicalLifespanNtScaleYears,
  getBiblicalLifespanScaleYears,
} from "./biblical-lifespans";
import type { ExploreYearDayProfile } from "./explore-birth-year-prefs";
import {
  LifespanChartBlock,
  ModernLifespanRow,
  ModernMilestoneDayRow,
} from "./ExploreBiblicalLifespanRows";
import { biblicalLifespanChartStyles as styles } from "./ExploreBiblicalLifespanChartStyles";
import { useExploreBiblicalLifespanChart } from "./useExploreBiblicalLifespanChart";

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
  const { modernProfile, modernEraLabel, mainEntries, newTestamentEntries, openInBible } =
    useExploreBiblicalLifespanChart({
      profileRefreshKey,
      profileProp,
      exploreReturnProp,
    });

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
