import type { MutableRefObject } from "react";
import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import {
  resolveScriptureAvSource,
  resolveScriptureBundledModule,
} from "../audio/scriptureAudioPlayback";
import { pauseShellMusicForAux } from "../audio/pauseShellMusicForAux";
import {
  clearShellMediaSessionUserDismissed,
  resumeShellAppMusic,
  syncShellMediaSessionExplicit,
} from "../audio/shellMediaControls";
import {
  getShellMediaSceneArtworkUri,
  reshuffleShellMediaSceneArtwork,
} from "../audio/shellMediaSceneArtwork";
import { setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import {
  getShellScriptureWantPlaying,
  setShellScriptureWantPlaying,
} from "../audio/shellScriptureWantPlaying";
import { setShellVerseWantPlaying } from "../audio/shellVerseWantPlaying";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { isScripturePlayAttemptCurrent } from "./scripturePlaybackExclusive";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import { clearScriptureChapterHandoff } from "./scripturePlaybackPriority";
import {
  clearScripturePlayingChapter,
  setScripturePlayingChapter,
} from "./scripturePlayingChapterStore";
import { buildScriptureNativeNextUris } from "./buildScriptureNativeNextUris";
import { resolveIosNativeScriptureAssetUri } from "./resolveIosNativeScriptureAssetUri";
import { publishScripturePlaybackSec, setScripturePlaybackClockPlaying } from "./scripturePlaybackSec";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";

type Args = {
  bridge: ScriptureShellPlaybackBridge;
  src: string;
  playSeq?: number;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  scripturePlaybackRateRef: MutableRefObject<number>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  lastScriptureProgressSecRef: MutableRefObject<number>;
  scriptureStopAtSecRef: MutableRefObject<number | null>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  scripturePlayInFlightRef: MutableRefObject<Promise<void> | null>;
  scriptureChapterEndHandledRef: MutableRefObject<boolean>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
  scriptureLastProgressMsRef: MutableRefObject<number>;
  scriptureLastProgressAtRef: MutableRefObject<number>;
  scriptureSrcRef: MutableRefObject<string | null>;
  setScriptureCurrentSec: (sec: number) => void;
  setScriptureDurationSec: (sec: number) => void;
  setScripturePreparing: (preparing: boolean) => void;
  setPlaybackMode: (mode: "music" | "scripture") => void;
  unloadCurrent: () => Promise<void>;
  skipInitialUnload?: boolean;
};

export type ScriptureSoundLoadResult = { ok: true } | { ok: false; stale: true } | { ok: false; stale: false };

/** 排查"点播放没有立即出声"：分段打点，定位卡在 unload / 语音偏好 / URI 解析 / 实际 issue play 哪一步。 */
function logScripturePlayTiming(startedAt: number, label: string): void {
  if (!__DEV__) return;
  console.warn(`[scripture-audio-timing] +${Date.now() - startedAt}ms ${label}`);
}

export async function loadAndPlayScriptureSound({
  bridge,
  src,
  playSeq,
  readChapterRef,
  scripturePlaybackRateRef,
  scriptureAudioRepeatRef,
  lastScriptureProgressSecRef,
  scriptureStopAtSecRef,
  scriptureStopAtOnEndedRef,
  autoPlayScriptureRef,
  scriptureWantPlayingRef,
  scripturePlayInFlightRef,
  scriptureChapterEndHandledRef,
  scriptureChapterHandoffRef,
  scriptureLastProgressMsRef,
  scriptureLastProgressAtRef,
  scriptureSrcRef,
  setScriptureCurrentSec,
  setScriptureDurationSec,
  setScripturePreparing,
  setPlaybackMode,
  unloadCurrent,
  skipInitialUnload = false,
}: Args): Promise<ScriptureSoundLoadResult> {
  const { soundRef, playbackEpochRef, playbackModeRef } = bridge;
  const t0 = Date.now();
  const intendedChapter = readChapterRef.current
    ? {
        bookId: readChapterRef.current.bookId,
        chapter: readChapterRef.current.chapter,
        translationId: readChapterRef.current.translationId,
      }
    : null;

  if (playSeq != null && !isScripturePlayAttemptCurrent(playSeq)) {
    return { ok: false, stale: true };
  }

  await (skipInitialUnload ? Promise.resolve() : unloadCurrent());
  logScripturePlayTiming(t0, "unloadCurrent done");
  if (playSeq != null && !isScripturePlayAttemptCurrent(playSeq)) {
    return { ok: false, stale: true };
  }
  const epoch = playbackEpochRef.current;

  const leavingMusic = playbackModeRef.current !== "scripture";
  setPlaybackMode("scripture");
  playbackModeRef.current = "scripture";
  // 从音乐切到读经时清掉音乐意图；章间接力时不要 pause 正在用的 soundRef。
  if (leavingMusic) {
    pauseShellMusicForAux("scripture");
  }
  setScripturePreparing(true);

  const soundId = ++bridge.activeSoundIdRef.current;

  const rc = readChapterRef.current;
  const voiceId = rc ? await readCuvChapterAudioVoice() : undefined;
  logScripturePlayTiming(t0, "voice prefs resolved");

  /** 读经一律走原生播放器；expo-av 那条路径已删（锁屏下它会被 JS 轮询掐死）。 */
  if (rc) {
    const nativeUri = await resolveIosNativeScriptureAssetUri({
      src,
      translationId: rc.translationId,
      bookId: rc.bookId,
      chapter: rc.chapter,
      voiceId,
    });
    logScripturePlayTiming(t0, `native URI resolved: ${nativeUri ? "local/remote ok" : "null"}`);
    if (nativeUri) {
      if (playSeq != null && !isScripturePlayAttemptCurrent(playSeq)) {
        setScripturePreparing(false);
        return { ok: false, stale: true };
      }
      pauseShellMusicForAux("scripture");
      setShellVerseWantPlaying(false);
      clearShellMediaSessionUserDismissed();
      setShellScriptureWantPlaying(true);
      setShellNativeAudioTakeover(true);
      scriptureSrcRef.current = nativeUri;
      markScriptureWantPlaying(scriptureWantPlayingRef, true);
      clearScriptureChapterHandoff(scriptureChapterHandoffRef);
      if (intendedChapter) {
        setScripturePlayingChapter(intendedChapter);
      }
      const positionSec = Math.max(0, lastScriptureProgressSecRef.current || 0);
      const stopAt = scriptureStopAtSecRef.current;
      const rate = scripturePlaybackRateRef.current;
      const repeatModeForQueue = scriptureAudioRepeatRef.current;
      // 先开播；锁屏图 / 下一章 URI 后台补上，避免首点干等下载。
      syncShellMediaSessionExplicit({
        title: `${rc.bookName} ${rc.chapter}`,
        artist: "AskBible.me",
        album: rc.translationId,
        assetUri: nativeUri,
        artworkUri: getShellMediaSceneArtworkUri(),
        durationSec: 0,
        positionSec,
        playing: true,
        kind: "scripture",
        rate,
        stopAtSec: stopAt != null && Number.isFinite(stopAt) ? stopAt : undefined,
        userPlay: true,
      });
      logScripturePlayTiming(t0, "native play command issued (native engine takes over from here)");
      publishScripturePlaybackSec(positionSec);
      setScripturePlaybackClockPlaying(true, rate);
      setScriptureCurrentSec(positionSec);
      setScripturePreparing(false);
      void import("../read/reading-habit-stats")
        .then(({ recordAnyReadingActivityDay }) => recordAnyReadingActivityDay())
        .catch(() => undefined);
      void (async () => {
        // 非池播放（阅读页直接点播）过去这里是空数组，原生手里一章都没有，
        // 每章末都得靠 JS 被唤醒——锁屏时正是唤不醒的时候。改为按循环模式顺章预取。
        const [artworkUri, resolved] = await Promise.all([
          reshuffleShellMediaSceneArtwork(),
          buildScriptureNativeNextUris({
            bookId: rc.bookId,
            chapter: rc.chapter,
            translationId: rc.translationId,
            repeatMode: repeatModeForQueue,
            voiceId,
          }),
        ]);
        if (playSeq != null && !isScripturePlayAttemptCurrent(playSeq)) return;
        if (!getShellScriptureWantPlaying()) return;
        const liveStopAt = scriptureStopAtSecRef.current;
        syncShellMediaSessionExplicit({
          title: `${rc.bookName} ${rc.chapter}`,
          artist: "AskBible.me",
          album: rc.translationId,
          assetUri: nativeUri,
          artworkUri,
          durationSec: 0,
          positionSec: lastScriptureProgressSecRef.current || positionSec,
          playing: true,
          kind: "scripture",
          rate: scripturePlaybackRateRef.current,
          stopAtSec: liveStopAt != null && Number.isFinite(liveStopAt) ? liveStopAt : undefined,
          nextAssetUri: resolved[0] ?? null,
          nextNextAssetUri: resolved[1] ?? null,
          nextAssetUris: resolved,
        });
        // 补队列 sync 不带 userPlay；若期间被三星 OEM Pause 卡住，再推一把续播。
        resumeShellAppMusic();
      })();
      if (__DEV__) {
        console.warn("[scripture-audio] ios native play", rc.bookId, rc.chapter, nativeUri);
      }
      return { ok: true };
    }
  }

  /*
   * 走到这里表示这一章连原生播放器都拿不到可播的 URI（没内置、没下载、没缓存、
   * 源也不是文件或远程，且不允许流式）。以前这里会退回 expo-av 再试一次——
   * 但那种情况下 expo-av 同样无米下锅，而它一旦真的出声，就又出现了第二个播放器。
   * 直接干净地失败。
   */
  setScripturePreparing(false);
  if (!soundRef.current) {
    setPlaybackMode("music");
    playbackModeRef.current = "music";
    clearScripturePlayingChapter();
  }
  if (__DEV__) {
    console.warn("[scripture-audio] no playable native uri:", src);
  }
  return { ok: false, stale: false };
}
