import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export const KNOWN_MUSIC_ALBUMS = ["安静", "下午茶", "专注工作", "睡眠"] as const;
export type KnownMusicAlbum = (typeof KNOWN_MUSIC_ALBUMS)[number];
export const DEFAULT_MUSIC_ALBUM: KnownMusicAlbum = "安静";

const COFFEE_GRADIENT: readonly [string, string, string] = ["#f3e6d8", "#dcc4ab", "#b69173"];
const AQUA_GRADIENT: readonly [string, string, string] = ["#10C0DF", "#0e8ca3", "#0a2a33"];
const WORK_GRAY_GRADIENT: readonly [string, string, string] = ["#22324e", "#18243a", "#0b1222"];
const DEEP_BLUE_GRADIENT: readonly [string, string, string] = ["#0d1d46", "#081233", "#030816"];

export const MUSIC_ALBUM_GRADIENTS: Record<string, readonly [string, string, string]> = {
  安静: AQUA_GRADIENT,
  下午茶: COFFEE_GRADIENT,
  专注工作: WORK_GRAY_GRADIENT,
  睡眠: DEEP_BLUE_GRADIENT,
};

export const MUSIC_ALBUM_SWATCH: Record<string, string> = {
  安静: "#10C0DF",
  下午茶: "#f0ddca",
  专注工作: "#7f97be",
  睡眠: "#0a1736",
};

export const MUSIC_ALBUM_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  安静: "spa",
  下午茶: "local-cafe",
  专注工作: "work-outline",
  睡眠: "dark-mode",
};

export function normalizeMusicAlbumLabel(rawAlbum: string | null | undefined): string {
  const input = (rawAlbum || "").trim();
  if (!input) return DEFAULT_MUSIC_ALBUM;
  if (input === "工作") return "专注工作";
  return input;
}

export function musicAlbumGlowColors(album: string): readonly [string, string, string] {
  return MUSIC_ALBUM_GRADIENTS[album] ?? AQUA_GRADIENT;
}

export function musicAlbumSwatchColor(album: string): string {
  return MUSIC_ALBUM_SWATCH[album] ?? "#7f97be";
}

export function musicAlbumIconName(album: string): keyof typeof MaterialIcons.glyphMap {
  return MUSIC_ALBUM_ICON[album] ?? "album";
}
