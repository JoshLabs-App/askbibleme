export const KNOWN_MUSIC_ALBUMS = ["安静", "下午茶", "赞美诗", "钢琴", "睡眠", "专注工作"] as const;
export type KnownMusicAlbum = (typeof KNOWN_MUSIC_ALBUMS)[number];
/** 首页场景底栏专辑条：不含专注 / 睡眠。 */
export const HOME_MUSIC_ALBUMS = ["安静", "下午茶", "赞美诗", "钢琴"] as const;
export type HomeMusicAlbum = (typeof HOME_MUSIC_ALBUMS)[number];
/** 首页/壳层默认只播此专辑；其它专辑须在音乐栏主动切换后才进入播放。 */
export const DEFAULT_MUSIC_ALBUM: KnownMusicAlbum = "安静";

const COFFEE_GRADIENT: readonly [string, string, string] = ["#f3e6d8", "#dcc4ab", "#b69173"];
const AQUA_GRADIENT: readonly [string, string, string] = ["#10C0DF", "#0e8ca3", "#0a2a33"];
const WORK_GRAY_GRADIENT: readonly [string, string, string] = ["#22324e", "#18243a", "#0b1222"];
const DEEP_BLUE_GRADIENT: readonly [string, string, string] = ["#0d1d46", "#081233", "#030816"];
const PARCHMENT_GRADIENT: readonly [string, string, string] = ["#e8dcc8", "#c4b39a", "#8a7359"];
const HYMN_GRADIENT: readonly [string, string, string] = ["#d7c4b0", "#b89a7a", "#6e5340"];

export const MUSIC_ALBUM_GRADIENTS: Record<string, readonly [string, string, string]> = {
  安静: AQUA_GRADIENT,
  下午茶: COFFEE_GRADIENT,
  专注工作: WORK_GRAY_GRADIENT,
  睡眠: DEEP_BLUE_GRADIENT,
  钢琴: PARCHMENT_GRADIENT,
  赞美诗: HYMN_GRADIENT,
};

export const MUSIC_ALBUM_SWATCH: Record<string, string> = {
  安静: "#10C0DF",
  下午茶: "#f0ddca",
  专注工作: "#7f97be",
  睡眠: "#0a1736",
  钢琴: "#d4c4a8",
  赞美诗: "#c4a57a",
};

export const MUSIC_ALBUM_ICON: Record<string, string> = {
  安静: "music-note-outline",
  下午茶: "coffee-outline",
  专注工作: "work-outline",
  睡眠: "dark-mode",
  钢琴: "piano",
  赞美诗: "church-outline",
};

const COMMUNITY_ALBUM_ICONS = new Set(["安静", "下午茶", "赞美诗"]);

/** 场景选择器下方短名（用户可见） */
export const MUSIC_ALBUM_SHORT_LABEL: Record<string, string> = {
  安静: "放松",
  下午茶: "休闲",
  专注工作: "工作",
  睡眠: "睡眠",
  钢琴: "钢琴",
  赞美诗: "圣诗",
};

export const MUSIC_ALBUM_SHORT_LABEL_EN: Record<string, string> = {
  安静: "Calm",
  下午茶: "Cafe",
  专注工作: "Work",
  睡眠: "Sleep",
  钢琴: "Piano",
  赞美诗: "Hymns",
};

export function normalizeMusicAlbumLabel(rawAlbum: string | null | undefined): string {
  const input = (rawAlbum || "").trim();
  if (!input) return DEFAULT_MUSIC_ALBUM;
  if (input === "工作" || input === "专注") return "专注工作";
  if (input === "放松") return "安静";
  if (input === "快乐" || input === "休闲") return "下午茶";
  if (input === "圣诗" || input === "赞美诗") return "赞美诗";
  return input;
}

export function musicAlbumGlowColors(album: string): readonly [string, string, string] {
  return MUSIC_ALBUM_GRADIENTS[album] ?? AQUA_GRADIENT;
}

export function musicAlbumSwatchColor(album: string): string {
  return MUSIC_ALBUM_SWATCH[album] ?? "#7f97be";
}

export function musicAlbumIconName(album: string): string {
  return MUSIC_ALBUM_ICON[album] ?? "album";
}

export function musicAlbumIconIsCommunity(album: string): boolean {
  return COMMUNITY_ALBUM_ICONS.has(normalizeMusicAlbumLabel(album));
}

export function musicAlbumShortLabel(album: string): string {
  return MUSIC_ALBUM_SHORT_LABEL[album] ?? album;
}

export function musicAlbumShortLabelEn(album: string): string {
  return MUSIC_ALBUM_SHORT_LABEL_EN[album] ?? album;
}
