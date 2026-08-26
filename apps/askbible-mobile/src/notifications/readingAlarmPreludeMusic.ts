import type { MusicPlaybackContextValue } from "../music/musicPlaybackContextTypes";
import { pickRandomLocalPlayableTrackIndexInAlbum } from "../music/musicStoreHelpers";
import { scriptureCommandQuietExclusive } from "../music/scriptureCommands";
import { startNativeReadingAlarmPrelude } from "./syncAndroidReadingAlarmSchedule";

type PreludePlayback = Pick<
  MusicPlaybackContextValue,
  "tracks" | "playTrackAt" | "playing" | "playbackMode" | "togglePlayMusic"
>;

/** 预备前先停壳层主轨，避免原生预备叠在用户正在听的音乐/读经上。 */
async function quietShellBeforePrelude(playback: PreludePlayback): Promise<void> {
  try {
    if (playback.playbackMode === "music" && playback.playing) {
      await playback.togglePlayMusic();
    }
  } catch {
    /* ignore */
  }
  // 读经意图粘性暂停（alarm-prelude），dismiss / 开播成功须成对 endHold。
  scriptureCommandQuietExclusive({ holdReason: "alarm-prelude" });
}

/** 预备音乐：优先原生从「安静」专辑本地曲池随机选曲，失败时回退 App 内同专辑随机本地曲。 */
export async function startReadingAlarmPreludeMusic(playback: PreludePlayback): Promise<void> {
  await quietShellBeforePrelude(playback);
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
