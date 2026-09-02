import { getShellAuxMediaOwner } from "../audio/shellAuxMediaOwner";
import { setShellSleepTimerDeadline } from "../audio/shellMediaControls";
import { pauseNatureAmbientForRemote } from "../nature/natureAmbientExclusiveStop";
import type { ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import type { MutableRefObject } from "react";
import { scriptureCommandQuietExclusive } from "./scriptureCommands";

type Args = {
  firingRef: MutableRefObject<boolean>;
  sleepTimerDeadlineRef: MutableRefObject<number | null>;
  setSleepTimerMinutesState: (minutes: 0 | ShellSleepTimerMinutes) => void;
  pauseShellPlayback: () => Promise<void>;
};

/**
 * 睡眠定时到期后要静下来的全部东西。
 *
 * 原生到期事件和前台兜底超时都会走到这里，两路可能同时到，靠 firingRef 只跑一次。
 */
export async function runMusicSleepTimerFire({
  firingRef,
  sleepTimerDeadlineRef,
  setSleepTimerMinutesState,
  pauseShellPlayback,
}: Args): Promise<void> {
  if (firingRef.current) return;
  firingRef.current = true;
  sleepTimerDeadlineRef.current = null;
  setSleepTimerMinutesState(0);
  // 读经：粘性暂停（sleep-timer），阻止打断恢复 / 池续章把声音拉回来。
  scriptureCommandQuietExclusive({ holdReason: "sleep-timer" });
  const aux = getShellAuxMediaOwner();
  if (aux?.pause) {
    try {
      await aux.pause();
    } catch {
      /* ignore */
    }
  }
  void pauseNatureAmbientForRemote();
  try {
    await pauseShellPlayback();
  } finally {
    // 上面几个 await 期间，用户可能已经点了「再加 N 分钟」重新武装了新 deadline
    // （sleepTimerDeadlineRef 会被写成非 null）；此时不能再无条件把原生 deadline
    // 清掉，否则会把用户刚重新武装的定时器悄悄取消掉。
    if (sleepTimerDeadlineRef.current === null) {
      setShellSleepTimerDeadline(null);
    }
    firingRef.current = false;
  }
}
