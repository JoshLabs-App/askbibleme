import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeVerseOverlay } from "../home/HomeVerseOverlay";
import { t } from "../i18n/site-copy";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { parchmentSans } from "../fonts/parchmentType";
import { theme } from "../theme";

export function RelaxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tracks, playing, togglePlayMusic } = useMusicPlayback();
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setShowGuide(false), 3200);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.lagoon} />
      <HomeVerseOverlay variant="onLight" layout="inline" />
      {showGuide ? (
        <Text style={[styles.guide, { top: insets.top + 56 }]}>{t("relax.guideHint")}</Text>
      ) : null}
      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.label}>{t("relax.sessionLabel")}</Text>
        <Text style={styles.effect}>{t("relax.effectLagoon")}</Text>
        {tracks.length === 0 ? (
          <Text style={styles.hint}>{t("relax.noMusicHint")}</Text>
        ) : (
          <Pressable
            onPress={() => void togglePlayMusic()}
            style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.playText}>
              {playing ? t("playback.pauseMusic") : t("playback.playMusic")}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>{t("relax.back")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#b8d4e8" },
  lagoon: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#c5e3f4",
  },
  guide: {
    position: "absolute",
    left: 24,
    right: 24,
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(15, 23, 42, 0.72)",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  label: { fontSize: 13, color: "rgba(15, 23, 42, 0.55)", letterSpacing: 0.4 },
  effect: { marginTop: 4, fontSize: 16, ...parchmentSans(600), color: "rgba(15, 23, 42, 0.82)" },
  hint: { marginTop: 12, fontSize: 13, lineHeight: 20, color: "rgba(15, 23, 42, 0.65)", textAlign: "center" },
  playBtn: {
    marginTop: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: theme.canvas,
  },
  playText: { fontSize: 15, ...parchmentSans(600), color: theme.ink },
  back: { marginTop: 16, padding: 8 },
  backText: { fontSize: 14, color: "rgba(15, 23, 42, 0.7)" },
});
