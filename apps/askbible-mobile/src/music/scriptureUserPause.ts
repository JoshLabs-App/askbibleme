/**
 * 读经「粘性暂停」：带持有原因，避免闹钟预备 hold 后漏 release 永久卡死。
 * - hold(reason) 叠加原因
 * - release(reason) 只去掉该原因；全清用 release() / releaseAll
 * - 明确点播放应 release() 全清
 */

export type ScripturePauseHoldReason =
  | "user"
  | "alarm-prelude"
  | "sleep-timer";

const holds = new Set<ScripturePauseHoldReason>();

export function holdScriptureUserPause(reason: ScripturePauseHoldReason = "user"): void {
  holds.add(reason);
}

export function releaseScriptureUserPause(reason?: ScripturePauseHoldReason): void {
  if (reason == null) {
    holds.clear();
    return;
  }
  holds.delete(reason);
}

export function releaseAllScriptureUserPause(): void {
  holds.clear();
}

export function isScriptureUserPauseHeld(): boolean {
  return holds.size > 0;
}

export function getScripturePauseHoldReasons(): ReadonlySet<ScripturePauseHoldReason> {
  return holds;
}

/** 测用 */
export function resetScriptureUserPauseForTests(): void {
  holds.clear();
}
