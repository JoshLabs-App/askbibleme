import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import {
  pointerMatchesTrack,
  tripleLoopTrackTitle,
  trackForBookId,
} from "./reading-plan/triple-loop-reading";
import { markTodayReadingChapterVisit } from "./reading-plan/today-reading-done";
import { resetTripleLoopPlanToEasterDefault } from "./reading-plan/triple-loop-plan-sync";
import {
  advanceTripleLoopProgressTrack,
  hasUserTripleLoopProgress,
} from "./reading-plan/triple-loop-progress";
import {
  useEffectiveReadingPlanPrefs,
  useTripleLoopProgress,
} from "./reading-plan/useReadingPlanStores";

type Props = {
  bookId: string;
  chapter: number;
};

export function ReadChapterTripleLoopAdvance({ bookId, chapter }: Props) {
  const { prefs } = useEffectiveReadingPlanPrefs();
  const { progress, refresh } = useTripleLoopProgress();
  const [saving, setSaving] = useState(false);
  const [userAdjusted, setUserAdjusted] = useState(false);

  useEffect(() => {
    void hasUserTripleLoopProgress().then(setUserAdjusted);
  }, [progress]);

  const isTriple = isTripleLoopPlanId(prefs.planId);
  const track = isTriple ? trackForBookId(bookId) : null;
  const matches = Boolean(track && pointerMatchesTrack(progress, track, bookId, chapter));

  if (!isTriple || !track || !matches) return null;

  const advance = async () => {
    setSaving(true);
    try {
      await markTodayReadingChapterVisit(bookId, chapter);
      await advanceTripleLoopProgressTrack(track);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    setSaving(true);
    try {
      await resetTripleLoopPlanToEasterDefault();
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const trackTitle = tripleLoopTrackTitle(track);

  return (
    <View style={styles.box} accessibilityLabel={t("pages.read.tripleLoopAdvanceAria")}>
      <Text style={styles.hint}>
        {tFormat("pages.read.tripleLoopAdvanceHint", { track: trackTitle })}
      </Text>
      <View style={styles.actions}>
        <Pressable
          disabled={saving}
          onPress={() => void advance()}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, saving && styles.disabled]}
        >
          <Text style={styles.primaryText}>
            {saving
              ? t("pages.read.tripleLoopAdvanceSaving")
              : tFormat("pages.read.tripleLoopAdvanceButton", { track: trackTitle })}
          </Text>
        </Pressable>
        {userAdjusted ? (
          <Pressable disabled={saving} onPress={() => void resetToDefault()} hitSlop={8}>
            <Text style={styles.reset}>{t("pages.read.tripleLoopResetToDefault")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "rgba(255, 252, 245, 0.45)",
    alignItems: "center",
  },
  hint: {
    maxWidth: 320,
    fontSize: 12,
    lineHeight: 18,
    color: c.muted,
    textAlign: "center",
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  primary: {
    borderRadius: 8,
    backgroundColor: c.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryText: { fontSize: 12, ...parchmentSans(600), color: "#f5efe4" },
  reset: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
    textDecorationLine: "underline",
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
});
