import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import { logShellSoundError } from "../audio/safeShellSound";
import { setActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import type { ChapterPlaybackCtx } from "./scriptureChapterPlaybackTypes";

export function registerReadChapterPlayback(
  ctx: ChapterPlaybackCtx,
  reg: ReadChapterPlaybackRegistration | null,
): void {
  const prev = ctx.readChapterRef.current;
  ctx.readChapterRef.current = reg;
  setActiveReadChapterPlayback(reg);
  ctx.setReadChapter(reg);

  if (!reg) {
    if (ctx.playbackModeRef.current === "scripture") {
      void ctx.stopScripturePlayback().catch((err) => logShellSoundError("stop-on-unregister", err));
    }
    return;
  }

  if (reg.chapterAudioSrc && ctx.autoPlayScriptureRef.current) {
    ctx.autoPlayScriptureRef.current = false;
    void ctx.tryPlayScriptureWithFallback(reg, reg.chapterAudioSrc).catch((err) =>
      logShellSoundError("auto-play-scripture", err),
    );
    return;
  }

  const sameChapter =
    prev?.bookId === reg.bookId &&
    prev?.chapter === reg.chapter &&
    prev?.translationId === reg.translationId;
  const sameSrc =
    Boolean(reg.chapterAudioSrc) &&
    Boolean(ctx.scriptureSrcRef.current) &&
    scriptureAudioUrlsEqual(ctx.scriptureSrcRef.current!, reg.chapterAudioSrc!);
  if (sameChapter && sameSrc && ctx.playbackModeRef.current === "scripture") {
    return;
  }
}
