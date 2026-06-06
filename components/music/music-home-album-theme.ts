/** 对齐 iOS `MusicHomeScreen` 专辑视觉 */
export const MUSIC_HOME_ALBUMS = ["安静", "下午茶", "专注工作", "睡眠"] as const;
export const MUSIC_HOME_DEFAULT_ALBUM = "安静";

export type MusicHomeAlbum = (typeof MUSIC_HOME_ALBUMS)[number] | string;

export const MUSIC_HOME_ALBUM_GLOW: Record<string, readonly [string, string, string]> = {
  安静: ["#10C0DF", "#0e8ca3", "#0a2a33"],
  下午茶: ["#f3e6d8", "#dcc4ab", "#b69173"],
  专注工作: ["#22324e", "#18243a", "#0b1222"],
  睡眠: ["#0d1d46", "#081233", "#030816"],
};

export const MUSIC_HOME_ALBUM_SWATCH: Record<string, string> = {
  安静: "#10C0DF",
  下午茶: "#f0ddca",
  专注工作: "#7f97be",
  睡眠: "#0a1736",
};

export type MusicHomeAlbumIcon = "calm" | "coffee" | "work" | "sleep" | "album";

export function musicHomeAlbumIcon(album: string): MusicHomeAlbumIcon {
  if (album === "安静") return "calm";
  if (album === "下午茶") return "coffee";
  if (album === "专注工作") return "work";
  if (album === "睡眠") return "sleep";
  return "album";
}

export function musicHomeAlbumCssKey(album: string): string {
  const known: Record<string, string> = {
    安静: "calm",
    下午茶: "coffee",
    专注工作: "work",
    睡眠: "sleep",
  };
  return known[album] ?? "custom";
}
