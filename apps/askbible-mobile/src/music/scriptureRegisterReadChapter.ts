import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import { logShellSoundError } from "../audio/safeShellSound";
import {
  armReadPlanFlowAutoplay,
  consumeReadPlanFlowAutoplay,
  notifyPlanFlowChapterRegistered,
  peekReadPlanFlowAutoplay,
} from "../read/read-plan-flow-autoplay";
import { setActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import {
  isSameScriptureChapter,
  isScripturePlaybackBusy,
} from "./scripturePlaybackExclusive";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import type { ChapterPlaybackCtx } from "./scriptureChapterPlaybackTypes";

/**
 * 章页 UI 注册：只同步元数据（书卷/章/src/续章回调）。
 * 永不因 register(null) 触发 stop——播放生命周期由 orchestrator + 显式 stop 控制。
 */
export function registerReadChapterPlayback(
  ctx: ChapterPlaybackCtx,
  reg: ReadChapterPlaybackRegistration | null,
): void {
  if (!reg) {
    if (scriptureChapterPool.shouldPreservePlaybackOnUIUnmount()) {
      return;
    }
    ctx.readChapterRef.current = null;
    setActiveReadChapterPlayback(null);
    ctx.setReadChapter(null);
    return;
  }

  const prev = ctx.readChapterRef.current;
  ctx.readChapterRef.current = reg;
  setActiveReadChapterPlayback(reg);
  ctx.setReadChapter(reg);

  if (scriptureChapterPool.isActive()) {
    return;
  }

  const regSrc = reg.chapterAudioSrc?.trim() ?? "";
  const shouldAutoPlay =
    Boolean(regSrc) &&
    (ctx.autoPlayScriptureRef.current ||
      peekReadPlanFlowAutoplay() ||
      ctx.scriptureWantPlayingRef.current);

  const shellSrcMatchesReg =
    Boolean(ctx.scriptureSrcRef.current?.trim()) &&
    Boolean(regSrc) &&
    scriptureAudioUrlsEqual(ctx.scriptureSrcRef.current!, regSrc);
  const alreadyPlayingThisReg =
    isScripturePlaybackBusy(ctx) &&
    prev != null &&
    isSameScriptureChapter(prev, reg) &&
    ctx.isStarted() &&
    shellSrcMatchesReg;

  if (shouldAutoPlay) {
    markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
    if (alreadyPlayingThisReg) {
      ctx.autoPlayScriptureRef.current = false;
      consumeReadPlanFlowAutoplay();
      notifyPlanFlowChapterRegistered();
      return;
    }
    const forceNewChapterPlay =
      prev != null && !isSameScriptureChapter(prev, reg) ? null : prev;
    void ctx
      .tryPlayScriptureWithFallback(reg, regSrc, forceNewChapterPlay)
      .then((started) => {
        if (!started) {
          if (shouldAutoPlay) armReadPlanFlowAutoplay();
          return;
        }
        ctx.autoPlayScriptureRef.current = false;
        consumeReadPlanFlowAutoplay();
        notifyPlanFlowChapterRegistered();
      })
      .catch((err) => logShellSoundError("auto-play-scripture", err));
    return;
  }

  if (
    prev != null &&
    prev.bookId === reg.bookId &&
    prev.chapter === reg.chapter &&
    prev.translationId === reg.translationId &&
    shellSrcMatchesReg &&
    ctx.playbackModeRef.current === "scripture" &&
    ctx.isStarted()
  ) {
    return;
  }
}
