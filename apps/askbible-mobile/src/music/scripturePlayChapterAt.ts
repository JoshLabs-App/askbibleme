import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import {
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import { armReadPlanFlowAutoplay } from "../read/read-plan-flow-autoplay";
import { setActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { logShellSoundError, safeGetSoundStatus } from "../audio/safeShellSound";
import { isSameScriptureChapter, isScripturePlaybackBusy } from "./scripturePlaybackExclusive";
import { applyScriptureSegmentBounds } from "./scripturePlaybackHelpers";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import { buildReadChapterAdvanceHandlers } from "./scriptureReadChapterRegistration";
import type { ChapterPlaybackCtx, PlayScriptureChapterFn } from "./scriptureChapterPlaybackTypes";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";

export async function playScriptureChapterAt(
  ctx: ChapterPlaybackCtx,
  args: Parameters<PlayScriptureChapterFn>[0],
  opts: Parameters<PlayScriptureChapterFn>[1],
  playChapter: PlayScriptureChapterFn,
): Promise<boolean> {
  try {
    if (
      ctx.scripturePlayInFlightRef.current &&
      isSameScriptureChapter(ctx.readChapterRef.current, args)
    ) {
      try {
        await ctx.scripturePlayInFlightRef.current;
      } catch {
        /* superseded */
      }
      return ctx.isStarted();
    }
    if (
      isScripturePlaybackBusy(ctx) &&
      isSameScriptureChapter(ctx.readChapterRef.current, args) &&
      ctx.isStarted()
    ) {
      return true;
    }

    await configureScriptureShellAudioMode();
    if (!translationSupportsChapterAudio(args.translationId)) {
      return false;
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
      return false;
    }

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
      : {
          bookId: args.bookId,
          chapter: args.chapter,
          bookName: args.bookName,
          translationId: args.translationId,
          chapterAudioSrc: scriptureSrc,
          ...buildReadChapterAdvanceHandlers(args, playChapter, ctx.setPlaying),
        };
    ctx.readChapterRef.current = reg;
    setActiveReadChapterPlayback(reg);
    ctx.setReadChapter(reg);
    ctx.patchReadChapterSrc(scriptureSrc);
    ctx.autoPlayScriptureRef.current = true;
    markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
    armReadPlanFlowAutoplay();

    const started = await ctx.tryPlayScriptureWithFallback(reg, scriptureSrc, null);
    if (!started && !ctx.isStarted()) {
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
          await sound.setPositionAsync(Math.floor(nextSec * 1000));
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
    return true;
  } catch (err) {
    logShellSoundError("playScriptureChapter", err);
    return false;
  }
}
