import type { MutableRefObject } from "react";
import type { Audio } from "expo-av";
import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";

/** 全局经文播放入队序号：新请求 supersede 旧 load，保证任意时刻仅一条音轨。 */
let activeScripturePlaySeq = 0;

export function beginScripturePlayAttempt(): number {
  activeScripturePlaySeq += 1;
  return activeScripturePlaySeq;
}

export function isScripturePlayAttemptCurrent(seq: number): boolean {
  return seq === activeScripturePlaySeq;
}

export function isScripturePlaybackBusy(args: {
  playbackModeRef: MutableRefObject<"music" | "scripture">;
  soundRef: MutableRefObject<Audio.Sound | null>;
  scripturePlayInFlightRef: MutableRefObject<Promise<void> | null>;
}): boolean {
  if (args.scripturePlayInFlightRef.current) return true;
  if (args.playbackModeRef.current === "scripture" && args.soundRef.current != null) return true;
  // 原生读经：无 expo-av Sound，wantPlaying 即视为占用。
  if (
    isNativeMainTrackOs() &&
    args.playbackModeRef.current === "scripture" &&
    getShellScriptureWantPlaying()
  ) {
    return true;
  }
  return false;
}

export function isSameScriptureChapter(
  a: { bookId: string; chapter: number; translationId: string } | null | undefined,
  b: { bookId: string; chapter: number; translationId: string } | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.bookId === b.bookId && a.chapter === b.chapter && a.translationId === b.translationId;
}
