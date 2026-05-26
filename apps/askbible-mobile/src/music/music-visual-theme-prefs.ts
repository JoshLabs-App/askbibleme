import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "askbible-mobile-music-visual-theme-v1";

export type MusicVisualTheme = "auto" | "logo" | "aqua" | "dark";

export async function readMusicVisualTheme(): Promise<MusicVisualTheme> {
  try {
    const raw = (await AsyncStorage.getItem(KEY))?.trim();
    if (raw === "dark") return "dark";
    if (raw === "aqua") return "aqua";
    if (raw === "logo") return "logo";
    // Keep "auto" for backward compatibility, but default visual is now blue.
    if (raw === "auto") return "aqua";
    return "aqua";
  } catch {
    return "aqua";
  }
}

export async function writeMusicVisualTheme(theme: MusicVisualTheme): Promise<void> {
  await AsyncStorage.setItem(KEY, theme);
}
