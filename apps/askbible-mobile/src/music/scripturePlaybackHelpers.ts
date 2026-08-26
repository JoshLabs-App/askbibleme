import type { MutableRefObject } from "react";
import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
import type { Audio } from "expo-av";
import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import type { MusicPlaybackMode } from "./musicPlaybackTypes";
import { isSameScriptureChapter } from "./scripturePlaybackExclusive";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import { getScripturePlayingChapter } from "./scripturePlayingChapterStore";

export function isScripturePlaybackStarted(args: {
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
  soundRef: MutableRefObject<Audio.Sound | null>;
  scriptureSrcRef: MutableRefObject<string | null>;
}): boolean {
  if (args.playbackModeRef.current !== "scripture") return false;
  if (args.soundRef.current != null && args.scriptureSrcRef.current != null) return true;
  // 原生读经：无 expo-av Sound，以 want + src 为准。
  if (
    isNativeMainTrackOs() &&
    getShellScriptureWantPlaying() &&
    args.scriptureSrcRef.current != null
  ) {
    return true;
  }
  return false;
}

/**
 * 换章开播前清掉上一章的播放位置：原生开播用 lastScriptureProgressSecRef 当起点，
 * 不清零会让新章从上一章的进度（如计划续播秒数 / 手动拖动位置）开始。
 * -1 = 无基线，供进度节流按新章第一帧重新对齐。
 */
export function resetScriptureProgressForNewChapter(args: {
  lastScriptureProgressSecRef: MutableRefObject<number>;
  setScriptureCurrentSec: (sec: number) => void;
  target: { bookId: string; chapter: number; translationId: string };
}): void {
  if (isSameScriptureChapter(getScripturePlayingChapter(), args.target)) return;
  args.lastScriptureProgressSecRef.current = -1;
  publishScripturePlaybackSec(0);
  args.setScriptureCurrentSec(0);
}

export function applyScriptureSegmentBounds(args: {
  endAtSec?: number;
  startAtSec?: number;
  onSegmentEnd?: () => void;
  scriptureStopAtSecRef: MutableRefObject<number | null>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
}) {
  const seekSec = args.startAtSec;
  const endAtSec = args.endAtSec;
  if (
    Number.isFinite(endAtSec) &&
    Number.isFinite(seekSec) &&
    (endAtSec ?? 0) > (seekSec ?? 0) + 0.12
  ) {
    args.scriptureStopAtSecRef.current = endAtSec ?? null;
    args.scriptureStopAtOnEndedRef.current = args.onSegmentEnd ?? null;
  } else {
    args.scriptureStopAtSecRef.current = null;
    args.scriptureStopAtOnEndedRef.current = null;
  }
}
