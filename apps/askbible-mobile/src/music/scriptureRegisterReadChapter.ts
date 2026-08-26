import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import { logShellSoundError } from "../audio/safeShellSound";
import {
  armReadPlanFlowAutoplay,
  consumeReadPlanFlowAutoplay,
  notifyPlanFlowChapterRegistered,
  peekReadPlanFlowAutoplay,
} from "../read/read-plan-flow-autoplay";
import {
  getPlayingReadChapterPlayback,
  setBrowseReadChapterPlayback,
  setPlayingReadChapterPlayback,
} from "../read/read-chapter-playback-store";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import {
  isSameScriptureChapter,
  isScripturePlaybackBusy,
} from "./scripturePlaybackExclusive";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import type { ChapterPlaybackCtx } from "./scriptureChapterPlaybackTypes";

/**
 * 章页 UI 注册：只写 browse。
 * 若 browse 与 playing 同章，顺带刷新 playing 的上下章回调。
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
    // 只清 browse；playing 由 stop / 换轨负责。
    const playing = getPlayingReadChapterPlayback();
    if (playing && isScripturePlaybackBusy(ctx)) {
      setBrowseReadChapterPlayback(null);
      ctx.setReadChapter(null);
      // 引擎 ref 仍指向在播章，供章末续播。
      ctx.readChapterRef.current = playing;
      return;
    }
    ctx.readChapterRef.current = null;
    setBrowseReadChapterPlayback(null);
    ctx.setReadChapter(null);
    return;
  }

  const prevBrowse = ctx.readChapterRef.current;
  const playing = getPlayingReadChapterPlayback();
  const browsingAwayFromPlaying =
    playing != null && !isSameScriptureChapter(playing, reg);

  // browse 始终更新（UI / 可用性）；运输回调不跟 browse 走。
  setBrowseReadChapterPlayback(reg);
  ctx.setReadChapter(reg);

  if (browsingAwayFromPlaying) {
    // 浏览中：勿覆盖引擎 ref / playing，锁屏 Next 仍用 playing。
    return;
  }

  // 同章或尚无 playing：同步引擎 ref，并刷新 playing 回调。
  ctx.readChapterRef.current = reg;
  if (playing != null && isSameScriptureChapter(playing, reg)) {
    setPlayingReadChapterPlayback(reg);
  }

  if (scriptureChapterPool.isActive()) {
    return;
  }

  const regSrc = reg.chapterAudioSrc?.trim() ?? "";
  // 仅显式 arm / planFlow autoplay 才自动开播；勿用 wantPlaying（计划页暂停后进读经章会误播）。
  const shouldAutoPlay =
    Boolean(regSrc) &&
    (ctx.autoPlayScriptureRef.current || peekReadPlanFlowAutoplay());

  const shellSrcMatchesReg =
    Boolean(ctx.scriptureSrcRef.current?.trim()) &&
    Boolean(regSrc) &&
    scriptureAudioUrlsEqual(ctx.scriptureSrcRef.current!, regSrc);
  const alreadyPlayingThisReg =
    isScripturePlaybackBusy(ctx) &&
    prevBrowse != null &&
    isSameScriptureChapter(prevBrowse, reg) &&
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
      prevBrowse != null && !isSameScriptureChapter(prevBrowse, reg) ? null : prevBrowse;
    void ctx
      .tryPlayScriptureWithFallback(reg, regSrc, forceNewChapterPlay)
      .then((started) => {
        if (!started) {
          if (shouldAutoPlay) armReadPlanFlowAutoplay();
          return;
        }
        setPlayingReadChapterPlayback(reg);
        ctx.autoPlayScriptureRef.current = false;
        consumeReadPlanFlowAutoplay();
        notifyPlanFlowChapterRegistered();
      })
      .catch((err) => logShellSoundError("auto-play-scripture", err));
    return;
  }

  if (
    prevBrowse != null &&
    prevBrowse.bookId === reg.bookId &&
    prevBrowse.chapter === reg.chapter &&
    prevBrowse.translationId === reg.translationId &&
    shellSrcMatchesReg &&
    ctx.playbackModeRef.current === "scripture" &&
    ctx.isStarted()
  ) {
    return;
  }
}
