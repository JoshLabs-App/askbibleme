import DateTimePicker from "@react-native-community/datetimepicker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, Switch, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { READ_PARCHMENT_PAGE_BOTTOM } from "../read/ReadParchmentPageScroll";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { resolveReadingPlanDisplayTitle } from "../read/reading-plan/reading-plan-display-title";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import {
  readReadingPlanPrefs,
  subscribeReadingPlanPrefs,
} from "../read/reading-plan/reading-plan-prefs";
import {
  dateFromReminderTime,
  formatReminderTime,
  useReadingReminderPrefs,
} from "../notifications/useReadingReminderPrefs";
import { readingPlannerRoute } from "./reading-planner/reading-planner-routes";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { exploreReadingAlarmStyles as alarm } from "./exploreReadingAlarmScreenStyles";
import {
  ExploreParchmentPage,
  exploreStyles as s,
  useExploreScrollContentStyle,
} from "./exploreParchmentStyles";

export function ExploreReadingAlarmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const {
    prefs,
    timePickerOpen,
    toggleTimePicker,
    onTimeChange,
    onToggleEnabled,
    onSetMode,
  } = useReadingReminderPrefs(locale);
  const [planId, setPlanId] = useState<string | null>(null);
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: READ_PARCHMENT_PAGE_BOTTOM + insets.bottom,
  });
  const planLabel = resolveReadingPlanDisplayTitle(locale, planId);

  useEffect(() => {
    const load = () => {
      void readReadingPlanPrefs().then((stored) => {
        setPlanId(stored?.planId ?? null);
      });
    };
    load();
    return subscribeReadingPlanPrefs(load);
  }, []);

  return (
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <ShellSystemBackButton onPress={() => router.back()} />
        <Text style={s.yearDayCountTitle}>{t("pages.explore.readingAlarmTitle")}</Text>
        <Text style={[s.yearDayCountLeadLine, { textAlign: "center", marginTop: 10 }]}>
          {t("pages.explore.readingAlarmLead")}
        </Text>

        {prefs ? (
          <>
            <View style={alarm.hero}>
              <Pressable
                onPress={toggleTimePicker}
                accessibilityRole="button"
                accessibilityLabel={`${t("pages.explore.readingAlarmTitle")} ${formatReminderTime(prefs.readingReminderHour, prefs.readingReminderMinute)}`}
                style={({ pressed }) => [pressed ? alarm.timePressed : null]}
              >
                <Text style={alarm.time}>
                  {formatReminderTime(prefs.readingReminderHour, prefs.readingReminderMinute)}
                </Text>
              </Pressable>
              <Text style={alarm.timeHint}>{t("pages.explore.readingAlarmTapTime")}</Text>
              {timePickerOpen ? (
                <View style={alarm.pickerWrap}>
                  <DateTimePicker
                    value={dateFromReminderTime(prefs.readingReminderHour, prefs.readingReminderMinute)}
                    mode="time"
                    is24Hour
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    themeVariant="light"
                    onChange={onTimeChange}
                  />
                </View>
              ) : null}
            </View>

            <View style={alarm.group}>
              <View style={alarm.row}>
                <Text style={alarm.rowLabel}>{t("pages.explore.readingAlarmToggle")}</Text>
                <Switch
                  value={prefs.readingReminderEnabled}
                  onValueChange={(enabled) => {
                    void onToggleEnabled(enabled);
                  }}
                  trackColor={{ false: "rgba(120, 53, 15, 0.18)", true: "rgba(255, 177, 1, 0.92)" }}
                  ios_backgroundColor="rgba(120, 53, 15, 0.18)"
                  thumbColor="#fffdf8"
                />
              </View>

              <View style={[alarm.row, alarm.rowBorder]}>
                <Text style={alarm.rowLabel}>{t("pages.explore.readingAlarmPlay")}</Text>
                <View style={alarm.segmentRow}>
                  {(
                    [
                      { id: "scripture" as const, label: t("pages.explore.readingAlarmScripture") },
                      { id: "music" as const, label: t("pages.explore.readingAlarmMusic") },
                    ] as const
                  ).map((option) => {
                    const selected = prefs.readingReminderMode === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => onSetMode(option.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={option.label}
                        style={({ pressed }) => [
                          alarm.segment,
                          selected ? alarm.segmentSelected : null,
                          pressed ? alarm.timePressed : null,
                        ]}
                      >
                        <Text style={alarm.segmentText}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={() => router.push(readingPlannerRoute())}
                accessibilityRole="button"
                accessibilityLabel={`${t("pages.explore.readingPlanIconLabel")} ${planLabel}`}
                style={({ pressed }) => [alarm.row, alarm.rowBorder, pressed ? alarm.rowPressed : null]}
              >
                <Text style={alarm.rowLabel}>{t("pages.explore.readingPlanIconLabel")}</Text>
                <View style={alarm.rowTrailing}>
                  <Text style={alarm.rowValue} numberOfLines={1}>
                    {planLabel}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={c.muted} />
                </View>
              </Pressable>
            </View>
          </>
        ) : null}
      </ParchmentBottomFadeScrollView>
    </ExploreParchmentPage>
  );
}
