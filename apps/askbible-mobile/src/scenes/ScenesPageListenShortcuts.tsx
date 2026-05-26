import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { parchmentSans } from "../fonts/parchmentType";
import { theme } from "../theme";

const TILE_SIZE = 68;

type ShortcutItem = {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  bg: string;
  iconColor: string;
  onPress: () => void;
};

export function ScenesPageListenShortcuts() {
  const router = useRouter();
  const { tracks, trackIndex, playTrackAt } = useMusicPlayback();

  const openMusic = () => {
    router.push("/music");
    if (tracks.length > 0) {
      void playTrackAt(trackIndex);
    }
  };

  const items: ShortcutItem[] = [
    {
      key: "music",
      label: t("nav.music"),
      icon: "music-note",
      bg: "#e9e0f5",
      iconColor: "rgba(76, 29, 149, 0.88)",
      onPress: openMusic,
    },
    {
      key: "relax",
      label: t("nav.relax"),
      icon: "spa",
      bg: "#d9f0e8",
      iconColor: "rgba(19, 78, 74, 0.88)",
      onPress: () => router.push("/relax"),
    },
  ];

  return (
    <View style={styles.wrap} accessibilityLabel={t("scenesPage.sectionListen")}>
      <View style={styles.row}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: item.bg },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("scenesPage.openShortcutAria", { name: item.label })}
          >
            <MaterialIcons name={item.icon} size={30} color={item.iconColor} />
            <Text style={styles.tileLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 36,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    paddingTop: 20,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  tileLabel: {
    fontSize: 10,
    ...parchmentSans(600),
    color: theme.ink,
    maxWidth: TILE_SIZE - 8,
    textAlign: "center",
  },
  pressed: { opacity: 0.88 },
});
