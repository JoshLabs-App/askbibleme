import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import {
  clearShellMediaSessionUserDismissed,
  pauseShellAppMusic,
  resumeShellAppMusic,
  syncShellMediaSessionExplicit,
} from "../audio/shellMediaControls";
import { getShellMediaSceneArtworkUri } from "../audio/shellMediaSceneArtwork";
import { isNativeMainTrackOs, setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import {
  getShellScriptureWantPlaying,
  setShellScriptureWantPlaying,
} from "../audio/shellScriptureWantPlaying";
import { logShellSoundError, safeGetSoundStatus, safePauseSound, safePlaySound } from "../audio/safeShellSound";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import {
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import { armReadPlanFlowAutoplay, consumeReadPlanFlowAutoplay } from "../read/read-plan-flow-autoplay";
import { setActiveReadChapterPlayback, setPlayingReadChapterPlayback } from "../read/read-chapter-playback-store";
import { requestWidgetVerseStop } from "../widget/widgetPlaybackRequest";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import {
  isScriptureUserPauseHeld,
  releaseScriptureUserPause,
} from "./scriptureUserPause";
import { isSameScriptureChapter, isScripturePlaybackBusy } from "./scripturePlaybackExclusive";
import {
  applyScriptureSegmentBounds,
  resetScriptureProgressForNewChapter,
} from "./scripturePlaybackHelpers";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import { buildReadChapterAdvanceHandlers } from "./scriptureReadChapterRegistration";
import { getScripturePlayingChapter } from "./scripturePlayingChapterStore";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import type { ChapterPlaybackCtx, PlayScriptureChapterFn } from "./scriptureChapterPlaybackTypes";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";

/** 目标章是否会离开今日计划当前轨（只判断，不拆池）。 */
function wouldLeavePlanPoolCurrentTrack(args: {
  bookId: string;
  chapter: number;
  translationId: string;
}): boolean {
  if (!scriptureChapterPool.isActive()) return false;
  const track = scriptureChapterPool.getCurrentTrack();
  if (!track) return true;
  return (
    track.bookId !== args.bookId ||
    track.chapter !== args.chapter ||
    track.translationId !== args.translationId
  );
}

/** 点章页朗读且目标不是今日计划当前轨时，退出计划播放池，避免章末又跳回计划。 */
function releasePlanPoolIfLeavingCurrentTrack(args: {
  bookId: string;
  chapter: number;
  translationId: string;
}): void {
  if (!wouldLeavePlanPoolCurrentTrack(args)) return;
  scriptureChapterPool.stop();
}

function abortIfUserPaused(ctx: ChapterPlaybackCtx): boolean {
  if (!isScriptureUserPauseHeld()) return false;
  ctx.setScripturePreparing(false);
  markScriptureWantPlaying(ctx.scriptureWantPlayingRef, false);
  ctx.autoPlayScriptureRef.current = false;
  consumeReadPlanFlowAutoplay();
  ctx.setPlaying(false);
  const sound = ctx.soundRef.current;
  if (sound) void safePauseSound(sound);
  return true;
}

/** 开播失败且已拆池：停掉可能仍在响的旧原生轨，避免 UI/音轨分裂。 */
export function haltNativeScriptureAfterFailedSwitch(
  ctx: Pick<
    ChapterPlaybackCtx,
    "scriptureWantPlayingRef" | "autoPlayScriptureRef" | "setPlaying"
  >,
): void {
  markScriptureWantPlaying(ctx.scriptureWantPlayingRef, false);
  ctx.autoPlayScriptureRef.current = false;
  consumeReadPlanFlowAutoplay();
  setShellScriptureWantPlaying(false);
  if (isNativeMainTrackOs()) {
    pauseShellAppMusic();
    setShellNativeAudioTakeover(false);
  }
  ctx.setPlaying(false);
}

export async function playScriptureChapterAt(
  ctx: ChapterPlaybackCtx,
  args: Parameters<PlayScriptureChapterFn>[0],
  opts: Parameters<PlayScriptureChapterFn>[1],
  playChapter: PlayScriptureChapterFn,
): Promise<boolean> {
  let didLeavePool = false;
  try {
    if (opts?.respectUserPause) {
      if (abortIfUserPaused(ctx)) return false;
    } else {
      releaseScriptureUserPause();
    }
    // 读经与金句互斥。
    requestWidgetVerseStop();
    // 必须对照「实际音轨章」，不能用 readChapterRef（浏览中的章会变，音轨可能仍是今日计划）。
    const playingChapter = getScripturePlayingChapter();
    if (
      ctx.scripturePlayInFlightRef.current &&
      isSameScriptureChapter(playingChapter, args)
    ) {
      try {
        await ctx.scripturePlayInFlightRef.current;
      } catch {
        /* superseded */
      }
      if (abortIfUserPaused(ctx)) return false;
      return ctx.isStarted();
    }
    if (
      isScripturePlaybackBusy(ctx) &&
      isSameScriptureChapter(playingChapter, args) &&
      ctx.isStarted()
    ) {
      if (abortIfUserPaused(ctx)) return false;
      const sound = ctx.soundRef.current;
      const st = sound ? await safeGetSoundStatus(sound) : null;
      if (abortIfUserPaused(ctx)) return false;
      if (st?.isLoaded && st.isPlaying) {
        return true;
      }
      if (st?.isLoaded && !st.isPlaying) {
        // 暂停后续播同一章：不可当「已在播」直接 return
        clearShellMediaSessionUserDismissed();
        markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
        ctx.autoPlayScriptureRef.current = true;
        ctx.setScripturePreparing(true);
        const ok = await safePlaySound(sound!);
        ctx.setPlaying(ok);
        ctx.setScripturePreparing(false);
        return ok;
      }
      // 原生：无 Sound 时用 apply/resume 续播同一章
      if (
        isNativeMainTrackOs() &&
        !sound &&
        ctx.scriptureSrcRef.current &&
        (getShellScriptureWantPlaying() || ctx.scriptureWantPlayingRef.current || ctx.isStarted())
      ) {
        clearShellMediaSessionUserDismissed();
        markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
        setShellScriptureWantPlaying(true);
        setShellNativeAudioTakeover(true);
        const rc = ctx.readChapterRef.current;
        if (rc) {
          syncShellMediaSessionExplicit({
            title: `${rc.bookName} ${rc.chapter}`,
            artist: "AskBible.me",
            album: rc.translationId,
            assetUri: ctx.scriptureSrcRef.current,
            artworkUri: getShellMediaSceneArtworkUri(),
            durationSec: 0,
            positionSec: Math.max(0, ctx.lastScriptureProgressSecRef.current || 0),
            playing: true,
            kind: "scripture",
            userPlay: true,
          });
        }
        resumeShellAppMusic();
        ctx.setPlaying(true);
        ctx.setScripturePreparing(false);
        return true;
      }
      // sound 丢失则继续走下方重载
    }

    // 先解析源再拆池：避免「池已死 / 注册已改 / 原生仍播旧章」。
    ctx.setScripturePreparing(true);
    if (!translationSupportsChapterAudio(args.translationId)) {
      ctx.setScripturePreparing(false);
      return false;
    }
    // 安卓原生读经不要先改 expo-av 音频模式：三星会 setSpeakerphoneOn，章页点了没声。
    if (!isNativeMainTrackOs()) {
      await configureScriptureShellAudioMode();
    }
    const voiceId = await readCuvChapterAudioVoice();
    const scriptureSrc = await resolveScripturePlayableSrcForChapter({
      translationId: args.translationId,
      bookId: args.bookId,
      chapter: args.chapter,
      bookName: args.bookName,
      voiceId,
      cachedSrc: args.chapterAudioSrc,
    });
    if (!scriptureSrc) {
      ctx.setScripturePreparing(false);
      return false;
    }

    const leavingPool = wouldLeavePlanPoolCurrentTrack(args);
    releasePlanPoolIfLeavingCurrentTrack(args);
    didLeavePool = leavingPool;

    const provisional: ReadChapterPlaybackRegistration = {
      bookId: args.bookId,
      chapter: args.chapter,
      bookName: args.bookName,
      translationId: args.translationId,
      chapterAudioSrc: scriptureSrc,
      ...buildReadChapterAdvanceHandlers(args, playChapter, ctx.setPlaying),
    };
    const existing = ctx.readChapterRef.current;
    const keepExistingHandlers =
      existing != null &&
      existing.bookId === args.bookId &&
      existing.chapter === args.chapter &&
      existing.translationId === args.translationId;

    const reg: ReadChapterPlaybackRegistration = keepExistingHandlers
      ? {
          ...existing,
          bookName: args.bookName,
          chapterAudioSrc: scriptureSrc,
        }
      : provisional;
    ctx.readChapterRef.current = reg;
    setActiveReadChapterPlayback(reg);
    setPlayingReadChapterPlayback(reg);
    ctx.setReadChapter(reg);
    ctx.patchReadChapterSrc(scriptureSrc);
    if (abortIfUserPaused(ctx)) return false;
    ctx.autoPlayScriptureRef.current = true;
    markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
    armReadPlanFlowAutoplay();
    const seekUpfront = opts?.startAtSec;
    if (Number.isFinite(seekUpfront) && (seekUpfront ?? 0) > 0) {
      ctx.lastScriptureProgressSecRef.current = seekUpfront ?? 0;
    } else {
      resetScriptureProgressForNewChapter({
        lastScriptureProgressSecRef: ctx.lastScriptureProgressSecRef,
        setScriptureCurrentSec: ctx.setScriptureCurrentSec,
        target: args,
      });
    }

    const started = await ctx.tryPlayScriptureWithFallback(reg, scriptureSrc, null);
    if (abortIfUserPaused(ctx)) return false;
    if (!started && !ctx.isStarted()) {
      ctx.setScripturePreparing(false);
      if (leavingPool) {
        haltNativeScriptureAfterFailedSwitch(ctx);
      }
      if (__DEV__) {
        console.warn(
          "[scripture-audio] playScriptureChapter failed",
          args.bookId,
          args.chapter,
          scriptureSrc,
        );
      }
      return false;
    }

    const seekSec = opts?.startAtSec;
    if (Number.isFinite(seekSec) && (seekSec ?? 0) > 0) {
      const sound = ctx.soundRef.current;
      if (sound) {
        const st = await safeGetSoundStatus(sound);
        if (st?.isLoaded) {
          const nextSec = Math.max(0, seekSec ?? 0);
          await sound.seekTo(nextSec);
          publishScripturePlaybackSec(nextSec);
          ctx.lastScriptureProgressSecRef.current = nextSec;
          ctx.setScriptureCurrentSec(nextSec);
        }
      }
    }
    applyScriptureSegmentBounds({
      startAtSec: opts?.startAtSec,
      endAtSec: opts?.endAtSec,
      onSegmentEnd: opts?.onSegmentEnd,
      scriptureStopAtSecRef: ctx.scriptureStopAtSecRef,
      scriptureStopAtOnEndedRef: ctx.scriptureStopAtOnEndedRef,
    });
    // 原生：段末 stopAt 在首帧 apply 之后补推一次。
    if (isNativeMainTrackOs() && getShellScriptureWantPlaying()) {
      const live = ctx.readChapterRef.current;
      const src = ctx.scriptureSrcRef.current;
      const stopAt = ctx.scriptureStopAtSecRef.current;
      if (live && src && stopAt != null) {
        syncShellMediaSessionExplicit({
          title: `${live.bookName} ${live.chapter}`,
          artist: "AskBible.me",
          album: live.translationId,
          assetUri: src,
          artworkUri: getShellMediaSceneArtworkUri(),
          durationSec: 0,
          positionSec: Math.max(0, ctx.lastScriptureProgressSecRef.current || 0),
          playing: true,
          kind: "scripture",
          stopAtSec: stopAt,
          userPlay: true,
        });
      }
    }
    return true;
  } catch (err) {
    ctx.setScripturePreparing(false);
    logShellSoundError("playScriptureChapter", err);
    if (didLeavePool) {
      haltNativeScriptureAfterFailedSwitch(ctx);
    }
    return false;
  }
}
