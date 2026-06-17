import { configureShellAudioMode } from "../audio/shellAudioMode";
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
import { getActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import type { ChapterPlaybackCtx } from "./scriptureChapterPlaybackTypes";

export async function toggleScripturePlayback(ctx: ChapterPlaybackCtx): Promise<void> {
  try {
    await configureShellAudioMode();
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
    ctx.patchReadChapterSrc(scriptureSrc);
    const sameScripture =
      ctx.playbackModeRef.current === "scripture" &&
      ctx.scriptureSrcRef.current &&
      scriptureAudioUrlsEqual(ctx.scriptureSrcRef.current, scriptureSrc);

    if (sameScripture) {
      if (ctx.scripturePlayInFlightRef.current) {
        try {
          await ctx.scripturePlayInFlightRef.current;
        } catch {
          /* ignore */
        }
      }
      const sound = ctx.soundRef.current;
      if (!sound) {
        await ctx.tryPlayScriptureWithFallback(rc, scriptureSrc);
        return;
      }
      const st = await safeGetSoundStatus(sound);
      if (!st?.isLoaded) {
        await ctx.playScripture(scriptureSrc);
        return;
      }
      if (st.isPlaying) {
        await safePauseSound(sound);
        ctx.setPlaying(false);
      } else {
        const ok = await safePlaySound(sound);
        ctx.setPlaying(ok);
      }
      return;
    }

    if (ctx.playbackModeRef.current !== "scripture") {
      if (ctx.soundRef.current) {
        await ctx.unloadCurrent();
      }
      await ctx.tryPlayScriptureWithFallback(rc, scriptureSrc);
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
