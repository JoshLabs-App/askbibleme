import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { LOGO_TEXT_ACCENT_COLOR as LOGO_COLOR } from "../shell/logo-colors";
import type { ExploreBirthDate } from "./explore-birth-date";
import { readExploreYearDayProfile } from "./explore-birth-year-prefs";
import {
  getCenturyTimeline,
  lifeBatteryFilledSegments,
  LIFE_BATTERY_SEGMENT_COUNT,
} from "./century-timeline";
import { ExploreLifeDayBattery } from "./ExploreLifeDayBattery";

function LifeDayLabelText({ day }: { day: number }) {
  const dayStr = day.toLocaleString();
  return (
    <Text style={styles.lifeDayLabelRow} numberOfLines={1}>
      <Text style={styles.lifeDayAffix}>{t("pages.explore.centuryTimelineLifeDayPrefix")}</Text>
      <Text style={styles.lifeDayNumber}>{dayStr}</Text>
      <Text style={styles.lifeDayAffix}>{t("pages.explore.centuryTimelineLifeDaySuffix")}</Text>
    </Text>
  );
}

type Props = {
  onOpenSettings: () => void;
  /** 点「第 N 天」进入读经 */
  onOpenLifeDay?: () => void;
  /** 保存生日后由父级递增，用于重新读取 */
  refreshKey?: number;
};

export function ExploreCenturyTimeline({ onOpenSettings, onOpenLifeDay, refreshKey = 0 }: Props) {
  const [birthDate, setBirthDate] = useState<ExploreBirthDate | null>(null);

  useEffect(() => {
    void readExploreYearDayProfile().then((profile) => {
      setBirthDate(profile.birthDate);
    });
  }, [refreshKey]);

  const now = useMemo(() => new Date(), []);
  const century = useMemo(
    () => (birthDate != null ? getCenturyTimeline(birthDate, now) : null),
    [birthDate, now],
  );

  const filledSegments =
    century != null ? lifeBatteryFilledSegments(century.progress) : 0;

  const lifeDayA11y =
    century != null
      ? tFormat("pages.explore.centuryTimelineLifeDay", {
          day: century.lifeDay.toLocaleString(),
        })
      : null;
  const settingsA11y =
    century == null
      ? t("pages.explore.centuryTimelineUnsetA11y")
      : tFormat("pages.explore.centuryTimelineA11y", {
          age: century.ageYears,
          day: century.lifeDay.toLocaleString(),
          start: century.startYear,
          end: century.endYear,
          filled: filledSegments,
          total: LIFE_BATTERY_SEGMENT_COUNT,
        });

  return (
    <View
      style={styles.wrap}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden={false}
    >
      {century != null ? (
        <Pressable
          onPress={onOpenLifeDay}
          disabled={!onOpenLifeDay}
          hitSlop={8}
          style={({ pressed }) => [
            styles.lifeDayBtn,
            pressed && onOpenLifeDay && styles.lifeDayBtnPressed,
          ]}
          accessibilityRole="link"
          accessibilityLabel={lifeDayA11y ?? undefined}
        >
          <LifeDayLabelText day={century.lifeDay} />
        </Pressable>
      ) : (
        <Pressable
          onPress={onOpenSettings}
          hitSlop={8}
          style={({ pressed }) => [styles.unsetBtn, pressed && styles.unsetBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={settingsA11y}
        >
          <Text style={styles.unsetText}>{t("pages.explore.centuryTimelineUnset")}</Text>
        </Pressable>
      )}

      <Pressable
        onPress={century != null ? onOpenLifeDay : onOpenSettings}
        disabled={century != null && !onOpenLifeDay}
        hitSlop={6}
        style={({ pressed }) => [
          styles.batteryPress,
          pressed && styles.batteryPressPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={settingsA11y}
      >
        <ExploreLifeDayBattery filledSegments={filledSegments} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginTop: 0,
    marginBottom: 2,
    overflow: "visible",
  },
  lifeDayBtn: {
    alignSelf: "center",
    paddingVertical: 2,
    marginBottom: 8,
  },
  lifeDayBtnPressed: { opacity: 0.72 },
  lifeDayLabelRow: {
    textAlign: "center",
  },
  lifeDayAffix: {
    fontSize: 12,
    lineHeight: 18,
    ...parchmentSans(500),
    color: c.muted,
    letterSpacing: 0.1,
  },
  lifeDayNumber: {
    fontSize: 17,
    lineHeight: 22,
    ...parchmentSans(700),
    color: LOGO_COLOR,
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },
  unsetBtn: {
    alignSelf: "center",
    paddingVertical: 4,
    marginBottom: 8,
  },
  unsetBtnPressed: { opacity: 0.72 },
  unsetText: {
    fontSize: 13,
    ...parchmentSans(500),
    color: c.muted,
    textAlign: "center",
  },
  batteryPress: {
    alignSelf: "center",
    marginBottom: 2,
  },
  batteryPressPressed: { opacity: 0.88 },
});
