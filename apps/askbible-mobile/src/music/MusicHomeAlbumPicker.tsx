import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { View, Pressable, StyleSheet } from "react-native";
import { localizeZhText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { musicAlbumIconName, musicAlbumSwatchColor } from "./musicAlbumCatalog";

type Props = {
  locale: AppLocale;
  album: string;
  albumNames: string[];
  albumCounts: Record<string, number>;
  onSelectAlbum: (album: string) => void;
};

export function MusicHomeAlbumPicker({
  locale,
  album,
  albumNames,
  albumCounts,
  onSelectAlbum,
}: Props) {
  return (
    <View style={styles.albumRow}>
      {albumNames.map((albumName) => {
        const selected = albumName === album;
        return (
          <Pressable
            key={albumName}
            onPress={() => onSelectAlbum(albumName)}
            style={({ pressed }) => [styles.albumBtn, selected && styles.albumBtnOn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${localizeZhText(locale, albumName)}（${albumCounts[albumName] ?? 0}）`}
          >
            <MaterialIcons
              name={musicAlbumIconName(albumName)}
              size={20}
              color={selected ? musicAlbumSwatchColor(albumName) : "rgba(255,255,255,0.72)"}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  albumRow: {
    width: "100%",
    marginTop: -4,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  albumBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  albumBtnOn: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.3)",
  },
  pressed: { opacity: 0.65 },
});
