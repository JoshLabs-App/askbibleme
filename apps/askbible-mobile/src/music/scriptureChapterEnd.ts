import type { MutableRefObject } from "react";
import type { Audio } from "expo-av";
import { handleScriptureDidJustFinish } from "./scripturePlaybackFinish";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
} from "./scripturePlaybackTypes";

/** 章末判定窗口：距结束 ≤2s 视为章末（避免 500ms 死区导致卡在 3:24/3:25）。 */
export const SCRIPTURE_CHAPTER_END_TOLERANCE_MS = 2000;

/** 章末位置不变超过此时间则强制续章。 */
export const SCRIPTURE_CHAPTER_END_STALL_MS = 2500;

export function isScriptureNearChapterEnd(positionMs: number, durationMs: number): boolean {
  return durationMs > 1000 && positionMs >= durationMs - SCRIPTURE_CHAPTER_END_TOLERANCE_MS;
}

export function shouldScheduleScriptureMidChapterResume(positionMs: number, durationMs: number): boolean {
  return durationMs > 500 && positionMs < durationMs - SCRIPTURE_CHAPTER_END_TOLERANCE_MS;
}

export type ScriptureChapterEndFinishArgs = {
  soundRef: MutableRefObject<Audio.Sound | null>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
  setPlaying: (playing: boolean) => void;
  chapterEndHandledRef: MutableRefObject<boolean>;
};

export function finishScriptureChapterOnce(args: ScriptureChapterEndFinishArgs): boolean {
  if (args.chapterEndHandledRef.current) return false;
  args.chapterEndHandledRef.current = true;
  handleScriptureDidJustFinish({
    soundRef: args.soundRef,
    scriptureAudioRepeatRef: args.scriptureAudioRepeatRef,
    readChapterRef: args.readChapterRef,
    autoPlayScriptureRef: args.autoPlayScriptureRef,
    scriptureChapterHandoffRef: args.scriptureChapterHandoffRef,
    setPlaying: args.setPlaying,
  });
  return true;
}

export function noteScripturePlaybackProgress(
  positionMs: number,
  lastProgressMsRef: MutableRefObject<number>,
  lastProgressAtRef: MutableRefObject<number>,
): void {
  if (positionMs !== lastProgressMsRef.current) {
    lastProgressMsRef.current = positionMs;
    lastProgressAtRef.current = Date.now();
  }
}

export function isScriptureChapterEndStalled(
  positionMs: number,
  durationMs: number,
  lastProgressMsRef: MutableRefObject<number>,
  lastProgressAtRef: MutableRefObject<number>,
): boolean {
  if (!isScriptureNearChapterEnd(positionMs, durationMs)) return false;
  if (positionMs !== lastProgressMsRef.current) return false;
  return Date.now() - lastProgressAtRef.current >= SCRIPTURE_CHAPTER_END_STALL_MS;
}

export function resetScriptureChapterEndTracking(
  chapterEndHandledRef: MutableRefObject<boolean>,
  lastProgressMsRef: MutableRefObject<number>,
  lastProgressAtRef: MutableRefObject<number>,
): void {
  chapterEndHandledRef.current = false;
  lastProgressMsRef.current = -1;
  lastProgressAtRef.current = Date.now();
}
