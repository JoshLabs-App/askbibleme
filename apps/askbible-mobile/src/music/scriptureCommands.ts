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

/**
 * 池当前轨是否就是「实际在播 / 正在看」的这一章：isActive() 只是个全局标记，不代表
 * 池跟当前这次播放有关——手动单独读某一章时若有残留的阅读计划池仍 active，锁屏
 * Next/Prev 若无脑信池，会把路由带去计划播放页而不是留在用户正打开的这个章页
 * （见 PlanFlowPlaybackBridge 的 navigateToChapter：只认计划路由）。
 */
function poolMatchesActiveTransport(): boolean {
  if (!scriptureChapterPool.isActive()) return false;
  const transport = resolveTransportReadChapterPlayback();
  if (!transport) return false;
  const track = scriptureChapterPool.getCurrentTrack();
  if (!track) return false;
  return (
    track.bookId === transport.bookId &&
    track.chapter === transport.chapter &&
    track.translationId === transport.translationId
  );
}

/**
 * 池正在换章（上一次 skip 触发的 playAt 还没落地）：这段窗口里 pool 的 index 已经
 * 同步自增，但驱动文字翻页的章页注册（playing transport）要等新章内容异步加载完
 * 才会更新，所以 poolMatchesActiveTransport() 此刻多半判不匹配。若照旧因此回退到
 * 运输注册回调，会拿着还没刷新的旧章算出同一个"下一章"、反复重算/反复导航到同一个
 * 目标，而 pool 的 index 却在被接下来的连点继续顶高——正是"连点几次后音频跑到第
 * 5 章、文字卡在第 2 章"的成因。因此换章窗口内直接吞掉新的 skip 请求，不做任何
 * 回退，等上一次真正落地（章页完成注册）后再接受下一次操作。
 */
function poolIsMidSkip(): boolean {
  return scriptureChapterPool.isActive() && scriptureChapterPool.isPlayInFlight();
}

/** 下一章：池优先，否则运输注册回调。 */
export async function scriptureCommandSkipNext(opts?: {
  skipNavigate?: boolean;
}): Promise<boolean> {
  if (poolIsMidSkip()) return false;
  if (poolMatchesActiveTransport()) {
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
  if (poolIsMidSkip()) return false;
  if (poolMatchesActiveTransport()) {
    return scriptureChapterPool.skipToPrev({ skipNavigate: opts?.skipNavigate });
  }
  const transport = resolveTransportReadChapterPlayback();
  if (!transport) return false;
  transport.onAdvancePreviousChapter();
  return true;
}
