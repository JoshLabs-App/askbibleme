import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import { useMusicPlayTrackAt } from "./useMusicPlayTrackAt";
import { useMusicTogglePlayMusic } from "./useMusicTogglePlayMusic";
import type { PlaybackTrack } from "./types";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";

type PlaybackMode = "music" | "scripture";

type UseMusicPlayTrackArgs = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  trackIndex: number;
  unloadCurrent: () => Promise<void>;
  endMusicSession: () => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setTrackIndex: (index: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  cacheMusicTrackInBackground: (trackId: string) => void;
  downloadMusicTrackAt: (index: number) => Promise<boolean>;
  musicRepeatModeRef: MusicPlaybackRefs["musicRepeatModeRef"];
};

export function useMusicPlayTrack(args: UseMusicPlayTrackArgs) {
  const playTrackAt = useMusicPlayTrackAt(args);
  const togglePlayMusic = useMusicTogglePlayMusic({ ...args, playTrackAt });
  return { playTrackAt, togglePlayMusic };
}
