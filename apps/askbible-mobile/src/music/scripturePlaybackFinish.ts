import type { MutableRefObject } from "react";
import type { AudioPlayer } from "expo-audio";
import { getNextScriptureChapterInBook } from "@/lib/bible/next-scripture-chapter";
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
  soundRef: MutableRefObject<AudioPlayer | null>;
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
        .seekTo(0)
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
  // isActive() 只是个全局标记，不代表这个池当前的轨就是刚播完的 rc——如果用户是
  // 手动打开了另一章（尤其是碰巧和某个残留的阅读计划池当前轨重名，导致池没被
  // releasePlanPoolIfLeavingCurrentTrack 停掉），走池的 onTrackFinished 会按池自己的
  // 队列顺序跳章，跟 rc 实际所在的书/章毫无关系。这里先确认池当前轨确实就是 rc，
  // 否则视为「池跟这次播放无关」，走 rc 自己的顺章逻辑。
  const poolCurrentTrack = scriptureChapterPool.getCurrentTrack();
  const poolMatchesFinishedChapter =
    !!poolCurrentTrack &&
    poolCurrentTrack.bookId === rc.bookId &&
    poolCurrentTrack.chapter === rc.chapter;
  if (scriptureChapterPool.isActive() && poolMatchesFinishedChapter) {
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
