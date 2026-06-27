import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReadingReminderMode } from "@/lib/notifications/notification-prefs-types";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";
import { parchmentControlSurface } from "../shell/parchmentControlSurface";
import type { ActiveReadingAlarm } from "./readingAlarmPlayback";

type Props = {
  locale: AppLocale;
  alarm: ActiveReadingAlarm;
  mode: ReadingReminderMode;
  onDismiss: () => void;
};

export function ReadingAlarmOverlay({ locale, alarm, mode, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const isMusic = mode === "music";

  return (
    <View pointerEvents="box-none" style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <ParchmentModalCard style={styles.card}>
        <Text style={styles.kicker}>
          {resolveUiText(locale, "每日清晨闹钟", "Daily morning alarm")}
        </Text>
        <Text style={styles.title}>{alarm.label}</Text>
        <Text style={styles.subtitle}>
          {isMusic
            ? resolveUiText(locale, "清晨音乐播放中，点停止结束", "Morning music is playing. Tap Stop to end.")
            : resolveUiText(
                locale,
                "正在开始今日读经朗读",
                "Starting today's Scripture reading",
              )}
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.secondary, pressed ? styles.pressed : null]}
            onPress={onDismiss}
          >
            <Text style={styles.secondaryLabel}>
              {resolveUiText(locale, "停止", "Stop")}
            </Text>
          </Pressable>
        </View>
      </ParchmentModalCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    zIndex: 60,
  },
  card: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 6,
  },
  kicker: {
    ...parchmentSans,
    fontSize: 11,
    letterSpacing: 0.4,
    color: "rgba(71, 61, 46, 0.62)",
    textTransform: "uppercase",
  },
  title: {
    ...parchmentSans,
    fontSize: 18,
    color: c.ink,
  },
  subtitle: {
    ...parchmentSans,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(71, 61, 46, 0.72)",
    marginBottom: 6,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  secondary: {
    backgroundColor: parchmentControlSurface.fillMuted,
  },
  pressed: {
    opacity: 0.86,
  },
  secondaryLabel: {
    ...parchmentSans,
    fontSize: 14,
    color: c.ink,
  },
});
