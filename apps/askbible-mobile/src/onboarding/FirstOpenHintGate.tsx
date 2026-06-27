import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { t } from "../i18n/site-copy";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";
import { parchmentControlSurface } from "../shell/parchmentControlSurface";
import { trackTap } from "../telemetry/tap";
import { markFirstOpenHintSeen, shouldShowFirstOpenHint } from "./first-open-hint-prefs";

function isFirstOpenHintEnabled(): boolean {
  return process.env.EXPO_PUBLIC_FIRST_OPEN_HINT_ENABLED !== "0";
}

export function FirstOpenHintGate() {
  const [visible, setVisible] = useState(false);
  const enabled = useMemo(() => isFirstOpenHintEnabled(), []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void shouldShowFirstOpenHint().then((show) => {
      if (alive) setVisible(show);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  const closeWithTarget = (target: "intro.start" | "intro.skip") => {
    trackTap(target);
    setVisible(false);
    void markFirstOpenHintSeen();
  };

  if (!enabled || !visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeWithTarget("intro.skip")} />
        <ParchmentModalCard style={styles.card}>
          <Text style={styles.title}>{t("onboarding.firstOpenHint.title")}</Text>
          <Text style={styles.subtitle}>{t("onboarding.firstOpenHint.subtitle")}</Text>
          <Text style={styles.body}>{t("onboarding.firstOpenHint.body")}</Text>
          <Text style={styles.helper}>{t("onboarding.firstOpenHint.helper")}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={() => closeWithTarget("intro.start")}>
              <Text style={styles.primaryButtonText}>{t("onboarding.firstOpenHint.ctaStart")}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => closeWithTarget("intro.skip")}>
              <Text style={styles.secondaryButtonText}>{t("onboarding.firstOpenHint.ctaLater")}</Text>
            </Pressable>
          </View>
        </ParchmentModalCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  card: {
    width: "92%",
    maxWidth: 420,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 20,
    ...parchmentSans(700),
    color: c.ink,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: c.ink,
    ...parchmentSans(600),
  },
  body: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: c.muted,
  },
  helper: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
  },
  actions: {
    marginTop: 16,
    gap: 8,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: c.accentOt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 15,
    ...parchmentSans(600),
    color: c.ink,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: parchmentControlSurface.fillMuted,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: c.muted,
  },
});
