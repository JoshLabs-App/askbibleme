import { pauseShellAppMusic } from "../audio/shellMediaControls";
import { setShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { setShellVerseWantPlaying } from "../audio/shellVerseWantPlaying";
import { consumeReadPlanFlowAutoplay } from "../read/read-plan-flow-autoplay";
import { resolveTransportReadChapterPlayback } from "../read/read-chapter-playback-store";
import { requestWidgetVerseStop } from "../widget/widgetPlaybackRequest";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import {
  holdScriptureUserPause,
  releaseScriptureUserPause,
  type ScripturePauseHoldReason,
} from "./scriptureUserPause";

/**
 * 读经命令入口：页面 / 闹钟 / 锁屏 / 坞 优先走这里，避免散点组合 stop+hold+清 want。
 */

/** 为独占开播（闹钟预备、睡眠定时、切金句前）安静壳层读经意图。 */
export function scriptureCommandQuietExclusive(opts?: {
  holdReason?: ScripturePauseHoldReason;
  /** 默认 true：停金句挂件意图 */
  stopVerse?: boolean;
  /** 默认 true：暂停原生主轨会话 */
  pauseShell?: boolean;
}): void {
  const holdReason = opts?.holdReason;
  if (holdReason) holdScriptureUserPause(holdReason);
  scriptureChapterPool.abortPendingPlay();
  consumeReadPlanFlowAutoplay();
  setShellScriptureWantPlaying(false);
  if (opts?.stopVerse !== false) {
    setShellVerseWantPlaying(false);
    requestWidgetVerseStop();
  }
  if (opts?.pauseShell !== false) {
    pauseShellAppMusic();
  }
}

/** 明确开播前：清掉全部粘性暂停。 */
export function scriptureCommandClearPauseHolds(): void {
  releaseScriptureUserPause();
}

/** 结束某一持有者（如闹钟 dismiss）而不影响其它 hold。 */
export function scriptureCommandEndHold(reason: ScripturePauseHoldReason): void {
  releaseScriptureUserPause(reason);
}

/** 下一章：池优先，否则运输注册回调。 */
export async function scriptureCommandSkipNext(opts?: {
  skipNavigate?: boolean;
}): Promise<boolean> {
  if (scriptureChapterPool.isActive()) {
    return scriptureChapterPool.skipToNext({ skipNavigate: opts?.skipNavigate });
  }
  const transport = resolveTransportReadChapterPlayback();
  if (!transport) return false;
  transport.onAdvanceNextChapter();
  return true;
}

/** 上一章：池优先，否则运输注册回调。 */
export async function scriptureCommandSkipPrev(opts?: {
  skipNavigate?: boolean;
}): Promise<boolean> {
  if (scriptureChapterPool.isActive()) {
    return scriptureChapterPool.skipToPrev({ skipNavigate: opts?.skipNavigate });
  }
  const transport = resolveTransportReadChapterPlayback();
  if (!transport) return false;
  transport.onAdvancePreviousChapter();
  return true;
}
