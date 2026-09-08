import { getShellPlaybackMode } from "../audio/playbackState";
import type { MusicPlaybackMode, MusicRepeatMode } from "./musicPlaybackTypes";
import type { useMusicPlaybackRefs } from "./useMusicPlaybackRefs";

type Refs = ReturnType<typeof useMusicPlaybackRefs>;

/**
 * 把几个渲染值同步进 ref，供 async 流程同步读取。
 *
 * 以前还返回一个 `syncPlayingState`，用来去重地把「在播」写进 ref 与 React state。
 * 那条链现在整条是空的：`playing` 由原生状态派生，写它的 setter 没有读者。已删。
 */
export function useMusicPlaybackRefSync(
  refs: Refs,
  state: {
    trackIndex: number;
    playbackMode: MusicPlaybackMode;
    musicRepeatMode: MusicRepeatMode;
  },
): void {
  refs.trackIndexRef.current = state.trackIndex;
  refs.musicRepeatModeRef.current = state.musicRepeatMode;
}
