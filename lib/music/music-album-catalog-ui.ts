import { normalizeMusicAlbumLabel } from "@/lib/music/album-playback";

export const MUSIC_ALBUM_ICON: Record<string, string> = {
  安静: "music-note-outline",
  下午茶: "coffee-outline",
  专注工作: "work-outline",
  睡眠: "dark-mode",
  钢琴: "piano",
  赞美诗: "church-outline",
};

const COMMUNITY_ALBUM_ICONS = new Set(["安静", "下午茶", "赞美诗"]);

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

export function musicAlbumIconName(album: string): string {
  return MUSIC_ALBUM_ICON[normalizeMusicAlbumLabel(album)] ?? "album";
}

export function musicAlbumIconIsCommunity(album: string): boolean {
  return COMMUNITY_ALBUM_ICONS.has(normalizeMusicAlbumLabel(album));
}

export function musicAlbumShortLabel(album: string): string {
  return MUSIC_ALBUM_SHORT_LABEL[normalizeMusicAlbumLabel(album)] ?? album;
}

export function musicAlbumShortLabelEn(album: string): string {
  return MUSIC_ALBUM_SHORT_LABEL_EN[normalizeMusicAlbumLabel(album)] ?? album;
}
