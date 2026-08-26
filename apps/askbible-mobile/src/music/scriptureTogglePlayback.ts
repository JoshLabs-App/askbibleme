import { isNativeMainTrackOs, setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import {
  clearShellMediaSessionUserDismissed,
  pauseShellAppMusic,
  resumeShellAppMusic,
  syncShellMediaSessionExplicit,
} from "../audio/shellMediaControls";
import { getScripturePlaybackSecNow, setScripturePlaybackClockPlaying } from "./scripturePlaybackSec";
import { getShellMediaSceneArtworkUri } from "../audio/shellMediaSceneArtwork";
import {
  getShellScriptureWantPlaying,
  setShellScriptureWantPlaying,
} from "../audio/shellScriptureWantPlaying";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safePauseSound,
  safePlaySound,
} from "../audio/safeShellSound";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import {
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import { flushTodayPlanScriptureResume } from "../read/flushTodayPlanScriptureResume";
import { consumeReadPlanFlowAutoplay, getPlanFlowUiHost } from "../read/read-plan-flow-autoplay";
import { getActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { requestWidgetVerseStop } from "../widget/widgetPlaybackRequest";
import { isSameScriptureChapter } from "./scripturePlaybackExclusive";
import { getScripturePlayingChapter } from "./scripturePlayingChapterStore";
import { markScriptureWantPlaying, clearScriptureResumeTimer } from "./scriptureResumeAfterInterruption";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import { holdScriptureUserPause, releaseScriptureUserPause } from "./scriptureUserPause";
import { haltNativeScriptureAfterFailedSwitch } from "./scripturePlayChapterAt";
import type { ChapterPlaybackCtx } from "./scriptureChapterPlaybackTypes";

async function awaitPlayInFlightOrTimeout(
  ref: ChapterPlaybackCtx["scripturePlayInFlightRef"],
  timeoutMs = 800,
): Promise<void> {
  const op = ref.current;
  if (!op) return;
  await Promise.race([op.catch(() => {}), new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
  if (ref.current === op) {
    ref.current = null;
  }
}

export async function pauseScriptureShellPlayback(
  ctx: Pick<
    ChapterPlaybackCtx,
    | "soundRef"
    | "playbackModeRef"
    | "scriptureWantPlayingRef"
    | "autoPlayScriptureRef"
    | "setPlaying"
  >,
): Promise<void> {
  holdScriptureUserPause("user");
  scriptureChapterPool.abortPendingPlay();
  markScriptureWantPlaying(ctx.scriptureWantPlayingRef, false);
  ctx.autoPlayScriptureRef.current = false;
  // 播放池 listen 路径不会 consume autoplay；暂停时必须清掉，否则打断恢复会强行续播。
  consumeReadPlanFlowAutoplay();
  clearScriptureResumeTimer();
  setScripturePlaybackClockPlaying(false);
  // 音乐与读经共用 soundRef / setPlaying：仅读经模式才停轨，避免点金句误关音乐。
  if (ctx.playbackModeRef.current !== "scripture") {
    return;
  }
  // 先更新 UI，避免等 AsyncStorage / 落盘时「点了暂停没反应」
  ctx.setPlaying(false);
  const nativeScripture = isNativeMainTrackOs() && getShellScriptureWantPlaying();
  setShellScriptureWantPlaying(false);
  void flushTodayPlanScriptureResume();
  const playback = getActiveReadChapterPlayback();
  const playingChapter = getScripturePlayingChapter();
  const chapter = playback ?? playingChapter;
  const title = playback
    ? `${playback.bookName} ${playback.chapter}`
    : playingChapter
      ? `${playingChapter.bookId} ${playingChapter.chapter}`
      : "AskBible.me";
  syncShellMediaSessionExplicit({
    title,
    artist: "AskBible.me",
    album: chapter?.translationId,
    assetUri: playback?.chapterAudioSrc,
    durationSec: 0,
    positionSec: Math.max(0, getScripturePlaybackSecNow()),
    playing: false,
    kind: "scripture",
    userPause: true,
  });
  if (nativeScripture) {
    pauseShellAppMusic();
    setShellNativeAudioTakeover(false);
    return;
  }
  const sound = ctx.soundRef.current;
  if (sound) {
    await safePauseSound(sound);
    // 真机状态回调可能又把 playing 拉回 true；暂停意图优先。
    ctx.setPlaying(false);
  }
}

export async function toggleScripturePlayback(
  ctx: ChapterPlaybackCtx,
  opts?: { forcePause?: boolean },
): Promise<void> {
  let didLeavePool = false;
  try {
    const forcePause = !!opts?.forcePause;

    // 暂停：不解析远端地址、不切 audio mode，立刻停
    if (forcePause) {
      ctx.setScripturePreparing(false);
      await pauseScriptureShellPlayback(ctx);
      return;
    }

    // 读经计划与金句互斥：任何续播 / 开播前先停金句。
    releaseScriptureUserPause();
    requestWidgetVerseStop();

    const activeReadChapter =
      getActiveReadChapterPlayback() ?? ctx.readChapterRef.current ?? ctx.readChapter;
    // 计划听读页：以播放池当前轨为准，避免章页残留注册抢走续播。
    const listenPoolTrack =
      getPlanFlowUiHost() === "listen" && scriptureChapterPool.isActive()
        ? scriptureChapterPool.getCurrentTrack()
        : null;
    const desiredChapter = listenPoolTrack
      ? activeReadChapter &&
        activeReadChapter.bookId === listenPoolTrack.bookId &&
        activeReadChapter.chapter === listenPoolTrack.chapter
        ? {
            ...activeReadChapter,
            chapterAudioSrc: listenPoolTrack.src || activeReadChapter.chapterAudioSrc,
          }
        : {
            bookId: listenPoolTrack.bookId,
            chapter: listenPoolTrack.chapter,
            bookName: listenPoolTrack.bookName,
            translationId: listenPoolTrack.translationId,
            chapterAudioSrc: listenPoolTrack.src,
            onAdvancePreviousChapter: () => {},
            onAdvanceNextChapter: () => {},
            onAdvanceNextInBook: () => {},
          }
      : activeReadChapter;
    const playingChapter = getScripturePlayingChapter();
    // 仅当「实际音轨章」与目标章一致时才快速 pause/resume。
    // 计划暂停后浏览其它章时 readChapterRef 已变，但 sound 仍是计划章——勿误续播。
    const canQuickToggleLoadedSession =
      ctx.playbackModeRef.current === "scripture" &&
      Boolean(ctx.scriptureSrcRef.current) &&
      isSameScriptureChapter(playingChapter, desiredChapter);

    // 原生读经：无 expo-av Sound，直接 pause / apply 续播。
    if (
      isNativeMainTrackOs() &&
      canQuickToggleLoadedSession &&
      !ctx.soundRef.current &&
      desiredChapter
    ) {
      if (getShellScriptureWantPlaying() || ctx.scriptureWantPlayingRef.current) {
        ctx.setScripturePreparing(false);
        await pauseScriptureShellPlayback(ctx);
        return;
      }
      clearShellMediaSessionUserDismissed();
      markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
      ctx.autoPlayScriptureRef.current = true;
      setShellScriptureWantPlaying(true);
      setShellNativeAudioTakeover(true);
      const src = ctx.scriptureSrcRef.current!;
      syncShellMediaSessionExplicit({
        title: `${desiredChapter.bookName} ${desiredChapter.chapter}`,
        artist: "AskBible.me",
        album: desiredChapter.translationId,
        assetUri: src,
        artworkUri: getShellMediaSceneArtworkUri(),
        durationSec: 0,
        positionSec: Math.max(0, ctx.lastScriptureProgressSecRef.current || 0),
        playing: true,
        kind: "scripture",
        userPlay: true,
      });
      resumeShellAppMusic();
      ctx.setPlaying(true);
      ctx.setScripturePreparing(false);
      return;
    }

    // 已加载会话：直接 pause/resume，避免每次点播放条都 resolve 源（模拟器上极慢）
    const existingSound = ctx.soundRef.current;
    if (canQuickToggleLoadedSession && existingSound) {
      if (ctx.scripturePlayInFlightRef.current) {
        await awaitPlayInFlightOrTimeout(ctx.scripturePlayInFlightRef);
      }
      const st = await safeGetSoundStatus(existingSound);
      if (st?.isLoaded) {
        // 真机 isPlaying 偶发 false，仍以 wantPlaying / UI 意图判断「应暂停」。
        if (st.isPlaying || ctx.scriptureWantPlayingRef.current) {
          ctx.setScripturePreparing(false);
          await pauseScriptureShellPlayback(ctx);
          return;
        }
        await configureScriptureShellAudioMode();
        clearShellMediaSessionUserDismissed();
        markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
        ctx.autoPlayScriptureRef.current = true;
        const ok = await safePlaySound(existingSound);
        ctx.setPlaying(ok);
        ctx.setScripturePreparing(false);
        return;
      }
    }

    await configureScriptureShellAudioMode();
    const rc = desiredChapter;
    if (!rc || !translationSupportsChapterAudio(rc.translationId)) {
      return;
    }
    ctx.setScripturePreparing(true);
    const voiceId = await readCuvChapterAudioVoice();
    const scriptureSrc = await resolveScripturePlayableSrcForChapter({
      translationId: rc.translationId,
      bookId: rc.bookId,
      chapter: rc.chapter,
      bookName: rc.bookName,
      voiceId,
      cachedSrc: rc.chapterAudioSrc,
    });
    if (!scriptureSrc) {
      ctx.setScripturePreparing(false);
      if (__DEV__) {
        console.warn("[scripture-audio] no playable src", rc.bookId, rc.chapter, rc.translationId);
      }
      return;
    }
    if (__DEV__) {
      console.warn("[scripture-audio] resolved src", scriptureSrc);
    }

    // 源已就绪再拆池：避免无音频时池已死、旧轨仍在响。
    if (scriptureChapterPool.isActive() && !listenPoolTrack) {
      const track = scriptureChapterPool.getCurrentTrack();
      if (
        !track ||
        track.bookId !== rc.bookId ||
        track.chapter !== rc.chapter ||
        track.translationId !== rc.translationId
      ) {
        scriptureChapterPool.stop();
        didLeavePool = true;
      }
    }

    ctx.patchReadChapterSrc?.(scriptureSrc);
    const sameScripture =
      ctx.playbackModeRef.current === "scripture" &&
      ctx.scriptureSrcRef.current &&
      scriptureAudioUrlsEqual(ctx.scriptureSrcRef.current, scriptureSrc);

    if (sameScripture) {
      if (ctx.scripturePlayInFlightRef.current) {
        await awaitPlayInFlightOrTimeout(ctx.scripturePlayInFlightRef);
      }
      const sound = ctx.soundRef.current;
      if (!sound) {
        const ok = await ctx.tryPlayScriptureWithFallback(rc, scriptureSrc);
        if (!ok && didLeavePool) haltNativeScriptureAfterFailedSwitch(ctx);
        return;
      }
      const st = await safeGetSoundStatus(sound);
      if (!st?.isLoaded) {
        clearShellMediaSessionUserDismissed();
        await ctx.playScripture(scriptureSrc);
        return;
      }
      if (st.isPlaying || ctx.scriptureWantPlayingRef.current) {
        ctx.setScripturePreparing(false);
        await pauseScriptureShellPlayback(ctx);
      } else {
        clearShellMediaSessionUserDismissed();
        markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
        const ok = await safePlaySound(sound);
        ctx.setPlaying(ok);
        ctx.setScripturePreparing(false);
      }
      return;
    }

    if (ctx.playbackModeRef.current !== "scripture") {
      if (ctx.soundRef.current) {
        await ctx.unloadCurrent();
      }
      clearShellMediaSessionUserDismissed();
      markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
      const ok = await ctx.tryPlayScriptureWithFallback(rc, scriptureSrc);
      if (!ok && didLeavePool) haltNativeScriptureAfterFailedSwitch(ctx);
      return;
    }

    // 原生换章：勿 stopScripturePlayback（会拆池并清会话）；userPlay 新 URI 顶掉旧轨。
    clearShellMediaSessionUserDismissed();
    if (ctx.soundRef.current) {
      await ctx.unloadCurrent();
    }
    markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
    const ok = await ctx.tryPlayScriptureWithFallback(rc, scriptureSrc);
    if (!ok && didLeavePool) haltNativeScriptureAfterFailedSwitch(ctx);
  } catch (err) {
    logShellSoundError("togglePlayScripture", err);
    ctx.setScripturePreparing(false);
    ctx.setPlaying(false);
    if (didLeavePool) haltNativeScriptureAfterFailedSwitch(ctx);
  }
}
