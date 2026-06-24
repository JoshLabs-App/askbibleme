import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import { logShellSoundError } from "../audio/safeShellSound";
import {
  consumeReadPlanFlowAutoplay,
  isPlanFlowChapterAdvanceInFlight,
  peekReadPlanFlowAutoplay,
} from "../read/read-plan-flow-autoplay";
import { setActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import {
  isSameScriptureChapter,
  isScripturePlaybackBusy,
} from "./scripturePlaybackExclusive";
import { isScriptureChapterHandoffActive } from "./scripturePlaybackPriority";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import type { ChapterPlaybackCtx } from "./scriptureChapterPlaybackTypes";

function shouldPreserveScriptureOnUnregister(ctx: ChapterPlaybackCtx): boolean {
  return (
    ctx.autoPlayScriptureRef.current ||
    peekReadPlanFlowAutoplay() ||
    isPlanFlowChapterAdvanceInFlight() ||
    Boolean(ctx.scripturePlayInFlightRef.current) ||
    isScriptureChapterHandoffActive(ctx.scriptureChapterHandoffRef)
  );
}

export function registerReadChapterPlayback(
  ctx: ChapterPlaybackCtx,
  reg: ReadChapterPlaybackRegistration | null,
): void {
  if (!reg) {
    if (shouldPreserveScriptureOnUnregister(ctx)) {
      // planFlow 换章 handoff：保留 readChapterRef，避免下一章注册时 prev 丢失、误判为同章跳过开播。
      return;
    }
    ctx.readChapterRef.current = null;
    setActiveReadChapterPlayback(null);
    ctx.setReadChapter(null);
    if (ctx.playbackModeRef.current === "scripture") {
      void ctx.stopScripturePlayback().catch((err) => logShellSoundError("stop-on-unregister", err));
    }
    return;
  }

  const prev = ctx.readChapterRef.current;
  ctx.readChapterRef.current = reg;
  setActiveReadChapterPlayback(reg);
  ctx.setReadChapter(reg);

  if (reg.chapterAudioSrc && (ctx.autoPlayScriptureRef.current || peekReadPlanFlowAutoplay())) {
    ctx.autoPlayScriptureRef.current = false;
    consumeReadPlanFlowAutoplay();
    markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
    if (
      isScripturePlaybackBusy(ctx) &&
      prev &&
      isSameScriptureChapter(prev, reg) &&
      ctx.isStarted()
    ) {
      return;
    }
    void ctx.tryPlayScriptureWithFallback(reg, reg.chapterAudioSrc, prev).catch((err) =>
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
