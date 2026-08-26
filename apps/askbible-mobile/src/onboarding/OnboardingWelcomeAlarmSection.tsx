import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useCallback, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { authFormSurface as auth } from "../auth/authFormSurface";
import { useLocale } from "../i18n/LocaleProvider";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { resolveReadingPlanDisplayTitle } from "../read/reading-plan/reading-plan-display-title";
import { useEffectiveReadingPlanPrefs } from "../read/reading-plan/useReadingPlanStores";
import { parchmentControlSurface } from "../shell/parchmentControlSurface";

type Props = {
  hour: number;
  minute: number;
  disabled?: boolean;
  onChange: (hour: number, minute: number) => void;
};

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dateFromTime(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function OnboardingWelcomeAlarmSection({ hour, minute, disabled = false, onChange }: Props) {
  const { locale, t } = useLocale();
  const { prefs: readingPlan } = useEffectiveReadingPlanPrefs();
  const planLabel = t("onboarding.welcome.alarmPlanNamed", {
    name: resolveReadingPlanDisplayTitle(locale, readingPlan.planId),
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const committedRef = useRef(false);

  const apply = useCallback(
    (date: Date) => {
      onChange(date.getHours(), date.getMinutes());
    },
    [onChange],
  );

  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        if (event.type === "set" && date) {
          committedRef.current = true;
          apply(date);
          setPickerOpen(false);
          return;
        }
        if (event.type === "dismissed") {
          setPickerOpen(false);
          committedRef.current = false;
        }
        return;
      }
      if (date) apply(date);
    },
    [apply],
  );

  return (
    <View style={styles.field}>
      <Text style={[auth.label, styles.fieldLabel]}>{t("onboarding.welcome.alarmTitle")}</Text>
      <Pressable
        onPress={() => {
          if (disabled) return;
          committedRef.current = false;
          setPickerOpen((open) => !open);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityHint={t("onboarding.welcome.alarmHint")}
        accessibilityLabel={`${t("onboarding.welcome.alarmTitle")} ${formatTime(hour, minute)}`}
        style={({ pressed }) => [styles.control, pressed ? styles.pressed : null]}
      >
        <Text style={styles.plan} numberOfLines={1}>
          {planLabel}
        </Text>
        <Text style={styles.time}>{formatTime(hour, minute)}</Text>
      </Pressable>
      {pickerOpen ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={dateFromTime(hour, minute)}
            mode="time"
            is24Hour
            display={Platform.OS === "ios" ? "spinner" : "default"}
            themeVariant="light"
            onChange={onPickerChange}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: "100%",
    gap: 8,
  },
  fieldLabel: {
    marginTop: 0,
  },
  control: {
    minHeight: 50,
    borderRadius: parchmentControlSurface.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    backgroundColor: parchmentControlSurface.fillStrong,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  plan: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: c.muted,
  },
  time: {
    fontSize: 16,
    fontWeight: "600",
    color: c.ink,
  },
  pickerWrap: {
    alignItems: "center",
  },
  pressed: {
    opacity: 0.55,
  },
});
