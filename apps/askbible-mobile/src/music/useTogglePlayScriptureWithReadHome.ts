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
  togglePlayScriptureBase: () => Promise<void>;
};

async function pauseShellScripture(togglePlayScriptureBase: () => Promise<void>): Promise<void> {
  await flushTodayPlanScriptureResume();
  scriptureChapterPool.stop();
  clearReadPlanFlowTodayLoop();
  clearPlanFlowSessionActive();
  await togglePlayScriptureBase();
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
}: Args) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useGlobalSearchParams<{ planFlow?: string | string[] }>();

  return useCallback(async () => {
    if (isReadChapterPathname(pathname)) {
      if (isPlanFlowChapterParam(params.planFlow)) {
        await togglePlayScriptureBase();
        return;
      }
      const started = await startTodayReadingScriptureFromReadHome(router, {
        replace: true,
      });
      if (!started) {
        await togglePlayScriptureBase();
      }
      return;
    }

    if (isShellPrimaryTabPathname(pathname)) {
      if (playbackMode === "scripture" && playing) {
        await pauseShellScripture(togglePlayScriptureBase);
        return;
      }
      if (playbackMode === "scripture" && !playing) {
        if (!scriptureChapterPool.isActive()) {
          const started = await startTodayReadingScriptureFromReadHome(router);
          if (!started) {
            await togglePlayScriptureBase();
          }
          return;
        }
        await togglePlayScriptureBase();
        return;
      }
      const started = await startTodayReadingScriptureFromReadHome(router);
      if (!started && isReadBibleHomeRoute(pathname)) {
        await togglePlayScriptureBase();
      }
      return;
    }

    await togglePlayScriptureBase();
  }, [params.planFlow, pathname, playbackMode, playing, router, togglePlayScriptureBase]);
}
