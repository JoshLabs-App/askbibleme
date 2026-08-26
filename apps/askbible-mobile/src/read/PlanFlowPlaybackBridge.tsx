import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { getPlanFlowUiHost } from "./read-plan-flow-autoplay";
import { replaceReadPlanFlowChapterAudio } from "./read-plan-flow-nav";

/** 绑定播放池与全局播放器 / 路由（常驻）。 */
export function PlanFlowPlaybackBridge() {
  const router = useRouter();
  const { playScriptureChapter } = useMusicPlayback();

  useEffect(() => {
    scriptureChapterPool.registerDeps({
      playScriptureChapter: (args, opts) =>
        playScriptureChapter(
          {
            bookId: args.bookId,
            chapter: args.chapter,
            bookName: args.bookName,
            translationId: args.translationId,
            chapterAudioSrc: args.chapterAudioSrc,
          },
          opts,
        ),
      navigateToChapter: (_ref) => {
        if (getPlanFlowUiHost() === "listen") {
          // 播放页订阅播放池；续章不改路由，避免 remount。
          return;
        }
        replaceReadPlanFlowChapterAudio(router, _ref);
      },
    });
    return () => scriptureChapterPool.registerDeps(null);
  }, [playScriptureChapter, router]);

  return null;
}
