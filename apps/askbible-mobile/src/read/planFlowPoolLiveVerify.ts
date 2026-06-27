import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Router } from "expo-router";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { startTodayReadingScriptureFromReadHome } from "./startTodayReadingScriptureFromReadHome";

const LOG = "[PoolLiveVerify]";
export const RESULT_KEY = "askbible-pool-live-verify-v1";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeResult(status: "pass" | "fail", detail: string): Promise<void> {
  const payload = JSON.stringify({ status, detail, at: new Date().toISOString() });
  console.warn(`${LOG} ${status.toUpperCase()} ${detail}`);
  try {
    await AsyncStorage.setItem(RESULT_KEY, payload);
  } catch {
    /* ignore */
  }
}

/**
 * __DEV__ 真机验证：启动播放池 → 等第 1 轨开播 → 模拟章末 → 验证 playAt(1)。
 * 日志 tag：[scripture-pool] playAt 0 … ok / playAt 1 … ok
 */
export async function runPlanFlowPoolLiveVerify(
  router: Pick<Router, "push" | "replace">,
): Promise<void> {
  if (!__DEV__) return;

  try {
    const started = await startTodayReadingScriptureFromReadHome(router, {
      replace: true,
      loopTodayPlan: true,
    });
    if (!started) {
      await writeResult("fail", "startTodayReadingScriptureFromReadHome returned false");
      return;
    }

    await sleep(6000);
    const track0 = scriptureChapterPool.getCurrentTrack();
    const idx0 = scriptureChapterPool.getIndex();
    if (!track0 || idx0 !== 0) {
      await writeResult("fail", `track0 missing or wrong index (idx=${idx0})`);
      return;
    }

    console.warn(`${LOG} simulating chapter end ${track0.bookId}:${track0.chapter}`);
    scriptureChapterPool.onTrackFinished(track0.bookId, track0.chapter);

    await sleep(12000);
    const track1 = scriptureChapterPool.getCurrentTrack();
    const idx1 = scriptureChapterPool.getIndex();
    if (!track1 || idx1 !== 1) {
      await writeResult(
        "fail",
        `expected playAt(1), got idx=${idx1} track=${track1?.id ?? "null"}`,
      );
      return;
    }

    await writeResult(
      "pass",
      `playAt 0 ${track0.id} → playAt 1 ${track1.id} (pool active=${scriptureChapterPool.isActive()})`,
    );
  } catch (err) {
    await writeResult("fail", err instanceof Error ? err.message : String(err));
  }
}
