import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PlaceholderScreen } from "../../src/components/PlaceholderScreen";
import { strings } from "../../src/strings";
import { theme } from "../../src/theme";

export default function MusicTab() {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);

  return (
    <PlaceholderScreen
      title={strings.music.title}
      lead={strings.music.lead}
      body={strings.music.body}
      footer={
        <View style={styles.footerCol}>
          <Pressable
            onPress={() => setPlaying((p) => !p)}
            style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
            accessibilityRole="button"
            accessibilityLabel={playing ? strings.playback.pauseMusic : strings.playback.playMusic}
          >
            <Text style={styles.playText}>{playing ? strings.playback.pauseMusic : strings.playback.playMusic}</Text>
            <Text style={styles.hint}>{strings.playback.noTrack}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/relax")}
            style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>{strings.music.openRelax}</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footerCol: { width: "100%", gap: 10 },
  play: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: theme.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  playPressed: { opacity: 0.9 },
  playText: { color: theme.canvas, fontSize: 15, fontWeight: "600" },
  hint: { marginTop: 4, color: "rgba(237, 228, 212, 0.75)", fontSize: 12 },
  secondary: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: theme.surface,
  },
  secondaryPressed: { opacity: 0.9 },
  secondaryText: { fontSize: 14, fontWeight: "600", color: "rgba(43, 37, 32, 0.88)" },
});
