import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { READ_NEW_TESTAMENT_ACCENT } from "./canon-section-theme";
import { useLocale } from "../i18n/LocaleProvider";
import { formatReadingPlanRange } from "./reading-plan/format-reading-range";
import { formatReadingPlanChapterTotalLabel } from "./reading-plan/plan-chapter-total";
import type { ReadingPlanRange } from "./reading-plan/types";

type Props = {
  reading: ReadingPlanRange;
  done: boolean;
  progress: number;
  onToggleDone: () => void;
  onOpen: () => void;
  checkboxDisabled?: boolean;
  showCheckbox?: boolean;
  dimDoneText?: boolean;
};

export function ReadTodayPlanReadingRow({
  reading,
  done,
  progress,
  onToggleDone,
  onOpen,
  checkboxDisabled = false,
  showCheckbox = true,
  dimDoneText = true,
}: Props) {
  const { locale } = useLocale();
  const pct = Math.min(1, Math.max(0, progress));
  const fillWidth = `${Math.round(pct * 100)}%` as const;
  const chapterTotalLabel = formatReadingPlanChapterTotalLabel(
    reading.planChapterTotal,
    reading.bookId,
    locale,
  );

  return (
    <View style={styles.readingRow}>
      {showCheckbox ? (
        <Pressable
          onPress={checkboxDisabled ? undefined : onToggleDone}
          hitSlop={10}
          style={({ pressed }) => [
            styles.checkboxBtn,
            checkboxDisabled && styles.checkboxDisabled,
            pressed && !checkboxDisabled && styles.pressed,
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={
            done ? t("pages.read.todayPlanMarkUndone") : t("pages.read.todayPlanMarkDone")
          }
        >
          <MaterialIcons
            name={done ? "check-box" : "check-box-outline-blank"}
            size={22}
            color={done ? c.ink : c.muted}
          />
        </Pressable>
      ) : (
        <View style={styles.checkboxSlot} />
      )}
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.readingLabel, pressed && styles.pressed]}
      >
        <Text style={[styles.readingText, dimDoneText && done && styles.readingTextDone]}>
          {formatReadingPlanRange(reading)}
        </Text>
        <View style={styles.barTrackWrap}>
          <View
            style={styles.barTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
          >
            <View
              style={[
                styles.barFill,
                { width: fillWidth },
                pct > 0 && pct < 1 ? styles.barFillMin : null,
              ]}
            />
          </View>
        </View>
        <Text style={styles.chapterTotal} numberOfLines={1}>
          {chapterTotalLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  readingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingVertical: 4,
    gap: 8,
  },
  checkboxBtn: {
    paddingTop: 2,
  },
  checkboxSlot: {
    width: 22,
    height: 22,
    marginTop: 2,
  },
  checkboxDisabled: {
    opacity: 0.55,
  },
  readingLabel: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
  },
  readingText: {
    fontSize: 15,
    ...parchmentSans(500),
    lineHeight: 20,
    color: c.ink,
    textAlign: "left",
  },
  readingTextDone: {
    color: c.muted,
  },
  barTrackWrap: {
    width: "100%",
  },
  chapterTotal: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "left",
    letterSpacing: 0.1,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(120, 53, 15, 0.12)",
    overflow: "hidden",
    width: "100%",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: READ_NEW_TESTAMENT_ACCENT,
  },
  barFillMin: {
    minWidth: 3,
  },
  pressed: { opacity: 0.88 },
});
