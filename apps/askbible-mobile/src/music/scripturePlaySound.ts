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
import { isNativeMainTrackOs, setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import {
  getShellScriptureWantPlaying,
  setShellScriptureWantPlaying,
} from "../audio/shellScriptureWantPlaying";
import { setShellVerseWantPlaying } from "../audio/shellVerseWantPlaying";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { createScriptureSound } from "./scriptureSoundCreate";
import { isScripturePlayAttemptCurrent } from "./scripturePlaybackExclusive";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import { clearScriptureChapterHandoff } from "./scripturePlaybackPriority";
import {
  clearScripturePlayingChapter,
  setScripturePlayingChapter,
} from "./scripturePlayingChapterStore";
import { resolveIosNativeScriptureAssetUri } from "./resolveIosNativeScriptureAssetUri";
import { publishScripturePlaybackSec, setScripturePlaybackClockPlaying } from "./scripturePlaybackSec";
import { SCRIPTURE_NATIVE_NEXT_PREFETCH, scriptureChapterPool } from "./scripture-chapter-pool";
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
  setPlaying: (playing: boolean) => void;
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
  setPlaying,
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

  // iOS / Android：读经计划/章朗读走原生播放器，锁屏才不会被 expo-av + JS 轮询掐死。
  if (isNativeMainTrackOs() && rc) {
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
      const fillNativeNextQueue =
        scriptureAudioRepeatRef.current !== "chapter" && scriptureChapterPool.isActive();
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
      setPlaying(true);
      publishScripturePlaybackSec(positionSec);
      setScripturePlaybackClockPlaying(true, rate);
      setScriptureCurrentSec(positionSec);
      setScripturePreparing(false);
      void import("../read/reading-habit-stats")
        .then(({ recordAnyReadingActivityDay }) => recordAnyReadingActivityDay())
        .catch(() => undefined);
      void (async () => {
        const upcoming = fillNativeNextQueue ? scriptureChapterPool.peekUpcoming(SCRIPTURE_NATIVE_NEXT_PREFETCH) : [];
        const [artworkUri, ...resolved] = await Promise.all([
          reshuffleShellMediaSceneArtwork(),
          ...upcoming.map((track) =>
            resolveIosNativeScriptureAssetUri({
              src: track.src,
              translationId: track.translationId,
              bookId: track.bookId,
              chapter: track.chapter,
              voiceId,
            }),
          ),
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
          nextAssetUris: resolved.filter((uri): uri is string => Boolean(uri)),
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

  await configureScriptureShellAudioMode();
  const bundledModule = rc
    ? resolveScriptureBundledModule({
        translationId: rc.translationId,
        bookId: rc.bookId,
        chapter: rc.chapter,
        voiceId,
      })
    : null;
  const avSource = await resolveScriptureAvSource(src, bundledModule);
  if (!avSource) {
    setScripturePreparing(false);
    if (!soundRef.current) {
      setPlaybackMode("music");
      playbackModeRef.current = "music";
      clearScripturePlayingChapter();
    }
    return { ok: false, stale: false };
  }
  if (__DEV__) {
    console.warn("[scripture-audio] playScripture source", src, bundledModule ?? "remote");
  }
  setShellScriptureWantPlaying(false);

  const created = await createScriptureSound({
    bridge,
    avSource,
    soundId,
    epoch,
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
    setPlaying,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    setPlaybackMode,
  });

  if (!created.ok) {
    setScripturePreparing(false);
    if (!created.stale && !soundRef.current) {
      setPlaybackMode("music");
      playbackModeRef.current = "music";
      clearScripturePlayingChapter();
    }
    if (!created.stale && __DEV__) {
      console.warn("[scripture-audio] play failed:", src);
    }
    return created;
  }

  if (playSeq != null && !isScripturePlayAttemptCurrent(playSeq)) {
    try {
      created.sound.remove();
    } catch {
      /* ignore */
    }
    setScripturePreparing(false);
    return { ok: false, stale: true };
  }

  soundRef.current = created.sound;
  markScriptureWantPlaying(scriptureWantPlayingRef, true);
  clearScriptureChapterHandoff(scriptureChapterHandoffRef);
  if (intendedChapter) {
    setScripturePlayingChapter(intendedChapter);
  }
  setPlaying(true);
  setScripturePreparing(false);
  void import("../read/reading-habit-stats")
    .then(({ recordAnyReadingActivityDay }) => recordAnyReadingActivityDay())
    .catch(() => undefined);
  return { ok: true };
}
