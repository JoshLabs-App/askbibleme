import { useCallback } from "react";
import { usePathname, useRouter } from "expo-router";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { pushReadPlanPlay } from "../read/read-plan-flow-nav";
import { resolveChapterPageScripturePlayTarget } from "../read/resolveChapterPageScripturePlayTarget";
import {
  isReadChapterPathname,
  isReadPlanPlayPathname,
  isShellPrimaryTabPathname,
} from "../shell/shellPrimaryRoute";
import type { PlayScriptureChapterFn } from "./scriptureChapterPlayback";

type Args = {
  playing: boolean;
  playbackMode: "music" | "scripture";
  togglePlayScriptureBase: (opts?: { forcePause?: boolean }) => Promise<void>;
  playScriptureChapter: PlayScriptureChapterFn;
  quickStart?: boolean;
};

/** Tab 一级页：中央钮只进入读经计划播放页；章页坞内播放只播本章，不跳计划页。 */
export function useTogglePlayScriptureWithReadHome({
  playing,
  playbackMode,
  togglePlayScriptureBase,
  playScriptureChapter,
  quickStart: _quickStart,
}: Args) {
  const pathname = usePathname();
  const router = useRouter();

  return useCallback(
    async (opts?: { forcePause?: boolean }) => {
      // 金句 / 挂件等调用方要「纯停读经」时必须直达底层，禁止跳进计划页。
      if (opts?.forcePause) {
        await togglePlayScriptureBase({ forcePause: true });
        return true;
      }

      if (isReadPlanPlayPathname(pathname)) {
        if (playbackMode === "scripture" && playing) {
          await togglePlayScriptureBase({ forcePause: true });
          return true;
        }
        if (playbackMode === "scripture" && !playing && scriptureChapterPool.isActive()) {
          await togglePlayScriptureBase();
          return true;
        }
        // 未开播：留在播放页，由页内播放键启动
        return true;
      }

      if (isReadChapterPathname(pathname)) {
        // 经文章页：暂停停当前轨；再播以路由章为准（离开计划池异章），勿误续计划。
        if (playbackMode === "scripture" && playing) {
          await togglePlayScriptureBase({ forcePause: true });
          return true;
        }
        const target = resolveChapterPageScripturePlayTarget(pathname ?? "");
        if (target) {
          await playScriptureChapter(target);
          return true;
        }
        await togglePlayScriptureBase();
        return true;
      }

      if (isShellPrimaryTabPathname(pathname)) {
        // 挂件 listen 开播后常留在一级 Tab：已在读经模式时中央键应暂停/续播，勿只跳页。
        if (playbackMode === "scripture") {
          if (playing) {
            await togglePlayScriptureBase({ forcePause: true });
          } else if (scriptureChapterPool.isActive()) {
            await togglePlayScriptureBase();
          } else {
            pushReadPlanPlay(router);
          }
          return true;
        }
        // 未在读经：中央键作「计划播放页」入口
        pushReadPlanPlay(router);
        return true;
      }

      await togglePlayScriptureBase();
      return true;
    },
    [
      pathname,
      playbackMode,
      playing,
      playScriptureChapter,
      router,
      togglePlayScriptureBase,
    ],
  );
}
