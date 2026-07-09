import { useCallback } from "react";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { clearReadPlanFlowTodayLoop, clearPlanFlowSessionActive } from "../read/read-plan-flow-autoplay";
import { flushTodayPlanScriptureResume } from "../read/flushTodayPlanScriptureResume";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { isReadBibleHomeRoute } from "../read/read-route-chrome";
import { startTodayReadingScriptureFromReadHome } from "../read/startTodayReadingScriptureFromReadHome";
import {
  isReadChapterPathname,
  isShellPrimaryTabPathname,
} from "../shell/shellPrimaryRoute";

type Args = {
  playing: boolean;
  playbackMode: "music" | "scripture";
  togglePlayScriptureBase: (opts?: { forcePause?: boolean }) => Promise<void>;
  quickStart?: boolean;
};

async function pauseShellScripture(
  togglePlayScriptureBase: (opts?: { forcePause?: boolean }) => Promise<void>,
): Promise<void> {
  await flushTodayPlanScriptureResume();
  scriptureChapterPool.stop();
  clearReadPlanFlowTodayLoop();
  clearPlanFlowSessionActive();
  await togglePlayScriptureBase({ forcePause: true });
}

function isPlanFlowChapterParam(planFlow: string | string[] | undefined): boolean {
  const raw = Array.isArray(planFlow) ? planFlow[0] : planFlow;
  return String(raw || "") === "1";
}

/** Tab 一级页（首页/音乐/读经/探索）：点中央钮进入今日读经并播放；planFlow 章页内则切换当前章。 */
export function useTogglePlayScriptureWithReadHome({
  playing,
  playbackMode,
  togglePlayScriptureBase,
  quickStart,
}: Args) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useGlobalSearchParams<{ planFlow?: string | string[] }>();

  return useCallback(async () => {
    if (isReadChapterPathname(pathname)) {
      if (isPlanFlowChapterParam(params.planFlow)) {
        await togglePlayScriptureBase();
        return true;
      }
      const started = await startTodayReadingScriptureFromReadHome(router, {
        replace: true,
        quickStart,
      });
      if (!started) {
        await togglePlayScriptureBase();
      }
      return started;
    }

    if (isShellPrimaryTabPathname(pathname)) {
      if (playbackMode === "scripture" && playing) {
        await pauseShellScripture(togglePlayScriptureBase);
        return true;
      }
      if (playbackMode === "scripture" && !playing) {
        if (!scriptureChapterPool.isActive()) {
          const started = await startTodayReadingScriptureFromReadHome(router, { quickStart });
          if (!started) {
            await togglePlayScriptureBase();
          }
          return started;
        }
        await togglePlayScriptureBase();
        return true;
      }
      const started = await startTodayReadingScriptureFromReadHome(router, { quickStart });
      if (!started && isReadBibleHomeRoute(pathname)) {
        await togglePlayScriptureBase();
      }
      return started;
    }

    await togglePlayScriptureBase();
    return true;
  }, [params.planFlow, pathname, playbackMode, playing, quickStart, router, togglePlayScriptureBase]);
}
