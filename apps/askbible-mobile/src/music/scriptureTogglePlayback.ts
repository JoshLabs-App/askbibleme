import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import {
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safePauseSound,
  safePlaySound,
} from "../audio/safeShellSound";
import { flushTodayPlanScriptureResume } from "../read/flushTodayPlanScriptureResume";
import { getActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
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
    | "scriptureWantPlayingRef"
    | "autoPlayScriptureRef"
    | "setPlaying"
  >,
): Promise<void> {
  markScriptureWantPlaying(ctx.scriptureWantPlayingRef, false);
  ctx.autoPlayScriptureRef.current = false;
  await flushTodayPlanScriptureResume();
  const sound = ctx.soundRef.current;
  if (sound) {
    await safePauseSound(sound);
  }
  ctx.setPlaying(false);
}

export async function toggleScripturePlayback(
  ctx: ChapterPlaybackCtx,
  opts?: { forcePause?: boolean },
): Promise<void> {
  try {
    await configureScriptureShellAudioMode();
    const rc = getActiveReadChapterPlayback() ?? ctx.readChapterRef.current ?? ctx.readChapter;
    if (!rc || !translationSupportsChapterAudio(rc.translationId)) {
      return;
    }
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
      if (__DEV__) {
        console.warn("[scripture-audio] no playable src", rc.bookId, rc.chapter, rc.translationId);
      }
      return;
    }
    if (__DEV__) {
      console.warn("[scripture-audio] resolved src", scriptureSrc);
    }
    ctx.patchReadChapterSrc?.(scriptureSrc);
    const forcePause = !!opts?.forcePause;
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
        if (forcePause) {
          await pauseScriptureShellPlayback(ctx);
          return;
        }
        await ctx.tryPlayScriptureWithFallback(rc, scriptureSrc);
        return;
      }
      const st = await safeGetSoundStatus(sound);
      if (!st?.isLoaded) {
        if (forcePause) {
          await pauseScriptureShellPlayback(ctx);
          return;
        }
        await ctx.playScripture(scriptureSrc);
        return;
      }
      if (forcePause || st.isPlaying) {
        await pauseScriptureShellPlayback(ctx);
      } else {
        markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
        const ok = await safePlaySound(sound);
        ctx.setPlaying(ok);
      }
      return;
    }

    if (ctx.playbackModeRef.current !== "scripture") {
      if (forcePause) {
        return;
      }
      if (ctx.soundRef.current) {
        await ctx.unloadCurrent();
      }
      markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
      await ctx.tryPlayScriptureWithFallback(rc, scriptureSrc);
      return;
    }

    if (forcePause) {
      await pauseScriptureShellPlayback(ctx);
      return;
    }

    if (ctx.soundRef.current) {
      await ctx.unloadCurrent();
    } else {
      await ctx.stopScripturePlayback();
    }
    await ctx.tryPlayScriptureWithFallback(rc, scriptureSrc);
  } catch (err) {
    logShellSoundError("togglePlayScripture", err);
    ctx.setPlaying(false);
  }
}
