import { normalizeMusicAlbumLabel } from "../music/musicAlbumCatalog";

/** 首页场景底栏：放松/休闲互切；点已选中的那颗只拿掉音乐，金句继续。 */

export function isHomeAlbumAudible(args: {
  albumName: string;
  currentAlbum: string;
  playbackMode: string;
  nativePlaying: boolean;
  jsPlaying: boolean;
  platform: string;
  wantPlaying?: boolean;
}): boolean {
  if (args.playbackMode !== "music") return false;
  if (args.currentAlbum !== args.albumName) return false;
  if (args.nativePlaying) return true;
  // 点播当下 wantPlaying 已真：专辑黄标与中间键一起亮，勿等原生心跳。
  if (args.wantPlaying) return true;
  if (args.platform === "ios") return false;
  return args.jsPlaying;
}

export function resolveHomeAlbumPressAction(args: {
  playable: boolean;
  selected: boolean;
}): "ignore" | "stop" | "play" {
  if (!args.playable) return "ignore";
  // 点对方 → play（切换专辑）；点自己 → stop（取消选中，只停音乐）。
  return args.selected ? "stop" : "play";
}

/** 中间键：音乐或金句在出声 → 暂停；已选中但都停着 → 续播；否则默认开「安静」。 */
export function resolveHomeCenterPlayAction(args: {
  musicOn: boolean;
  verseAudible: boolean;
  albumSelected: boolean;
  verseSelected: boolean;
}): "pause" | "resume" | "play-default" {
  if (args.musicOn || args.verseAudible) return "pause";
  if (args.albumSelected || args.verseSelected) return "resume";
  return "play-default";
}

type AlbumPickTrack = {
  album?: string | null;
  localReady?: boolean;
};

/** 只从点中的专辑里选曲，绝不落到安静或其它目录。 */
export function resolveHomeAlbumPlayIndex(
  tracks: readonly AlbumPickTrack[],
  albumName: string,
  currentIndex: number,
  isPlayable: (track: AlbumPickTrack, index: number) => boolean,
): number | null {
  const key = normalizeMusicAlbumLabel(albumName);
  const local: number[] = [];
  const playable: number[] = [];
  const any: number[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (!track || normalizeMusicAlbumLabel(track.album) !== key) continue;
    any.push(i);
    if (!isPlayable(track, i)) continue;
    playable.push(i);
    if (track.localReady) local.push(i);
  }
  const pool = local.length > 0 ? local : playable.length > 0 ? playable : any;
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0]!;
  const rest = pool.filter((idx) => idx !== currentIndex);
  const pick = rest.length > 0 ? rest : pool;
  return pick[Math.floor(Math.random() * pick.length)]!;
}
