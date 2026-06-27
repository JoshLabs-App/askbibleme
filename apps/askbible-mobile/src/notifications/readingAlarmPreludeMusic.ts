import { pickRandomLocalPlayableTrackIndexInAlbum } from "../music/musicStoreHelpers";
import type { MusicPlaybackContextValue } from "../music/musicPlaybackContextTypes";
import { startNativeReadingAlarmPrelude } from "./syncAndroidReadingAlarmSchedule";

/** 预备音乐：优先原生从「安静」专辑本地曲池随机选曲，失败时回退 App 内同专辑随机本地曲。 */
export async function startReadingAlarmPreludeMusic(
  playback: Pick<MusicPlaybackContextValue, "tracks" | "playTrackAt" | "playing" | "playbackMode" | "togglePlayMusic">,
): Promise<void> {
  if (startNativeReadingAlarmPrelude()) return;
  if (!playback.tracks.length) return;
  try {
    const index = pickRandomLocalPlayableTrackIndexInAlbum(playback.tracks);
    await playback.playTrackAt(index);
  } catch {
    /* ignore */
  }
}

export async function stopReadingAlarmPreludeMusic(
  playback: Pick<MusicPlaybackContextValue, "playing" | "playbackMode" | "togglePlayMusic">,
): Promise<void> {
  if (playback.playing && playback.playbackMode === "music") {
    try {
      await playback.togglePlayMusic();
    } catch {
      /* ignore */
    }
  }
}

/** 原生 prelude 已在播时，避免 JS 叠两层音乐。 */
export function shouldUseJsReadingAlarmPrelude(): boolean {
  return false;
}
