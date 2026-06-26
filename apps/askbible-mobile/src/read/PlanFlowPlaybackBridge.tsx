import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
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
      navigateToChapter: (ref) => {
        replaceReadPlanFlowChapterAudio(router, ref);
      },
    });
    return () => scriptureChapterPool.registerDeps(null);
  }, [playScriptureChapter, router]);

  return null;
}
