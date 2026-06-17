import { configureShellAudioMode } from "../audio/shellAudioMode";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import {
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import { logShellSoundError, safeGetSoundStatus } from "../audio/safeShellSound";
import { setActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import { applyScriptureSegmentBounds } from "./scripturePlaybackHelpers";
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
    await configureShellAudioMode();
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

    const reg: ReadChapterPlaybackRegistration = {
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

    await ctx.tryPlayScriptureWithFallback(reg, scriptureSrc);
    if (!ctx.isStarted()) {
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
