import type { MutableRefObject } from "react";
import type { Audio } from "expo-av";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import { logShellSoundError, safePlaySound } from "../audio/safeShellSound";
import { markTodayReadingAudioChapterComplete } from "../read/reading-plan/today-reading-done";
import { resolveTransportReadChapterPlayback } from "../read/read-chapter-playback-store";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import { markScriptureChapterHandoff } from "./scripturePlaybackPriority";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
} from "./scripturePlaybackTypes";

type Args = {
  soundRef: MutableRefObject<Audio.Sound | null>;
  scriptureSrcRef: MutableRefObject<string | null>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  setPlaying: (playing: boolean) => void;
};

export function handleScriptureDidJustFinish({
  soundRef,
  scriptureSrcRef,
  scriptureAudioRepeatRef,
  readChapterRef,
  autoPlayScriptureRef,
  scriptureChapterHandoffRef,
  scriptureWantPlayingRef,
  setPlaying,
}: Args): void {
  const mode = scriptureAudioRepeatRef.current;
  // 续播回调必须来自在播轨，勿用浏览中的 browse 注册。
  const rc = resolveTransportReadChapterPlayback() ?? readChapterRef.current;
  if (!rc) {
    setPlaying(false);
    return;
  }
  if (mode !== "chapter") {
    void markTodayReadingAudioChapterComplete(rc.bookId, rc.chapter);
  }
  if (mode === "chapter") {
    const active = soundRef.current;
    if (active) {
      void active
        .setPositionAsync(0)
        .then(() => safePlaySound(active))
        .catch((err) => logShellSoundError("scripture-repeat", err));
    }
    setPlaying(true);
    return;
  }
  if (mode === "book") {
    const next = getNextScriptureChapterInBook(rc.bookId, rc.chapter);
    if (next) {
      autoPlayScriptureRef.current = true;
      markScriptureChapterHandoff(scriptureChapterHandoffRef);
      rc.onAdvanceNextInBook();
      return;
    }
  }
  setPlaying(false);
  if (scriptureChapterPool.isActive()) {
    autoPlayScriptureRef.current = true;
    markScriptureWantPlaying(scriptureWantPlayingRef, true);
    scriptureChapterPool.onTrackFinished(rc.bookId, rc.chapter);
    return;
  }
  autoPlayScriptureRef.current = true;
  markScriptureWantPlaying(scriptureWantPlayingRef, true);
  markScriptureChapterHandoff(scriptureChapterHandoffRef);
  rc.onAdvanceNextChapter();
}
