import { useEffect, useRef } from "react";
import { useNavigation, useRouter } from "expo-router";
import { usePlaybackStream } from "../audio/playbackState";
import { lookupScriptureQueueChapter } from "../music/scriptureQueueChapterMap";
import { navigateReadChapter } from "./read-chapter-nav";

type Args = {
  /** 当前页显示的章；为空表示章还没加载好。 */
  displayed: { bookId: string; chapter: number } | null;
};

/**
 * 原生自己接到下一章时，把阅读页翻过去。**只翻页，不碰音频。**
 *
 * 以前换章是 JS driven：章末事件 → JS 挑下一章 → 导航 → 再点播。导航是那条链的副作用。
 * 现在原生按队列静默接章（关屏也走），JS 只需要跟上显示——如果不跟，就会出现
 * 「音轨已经在读创世记 2 章，页面还停在 1 章」（2026-09-08 真机复现）。
 *
 * 章号来自建队列时记下的 URI→章映射，不再独立推演一次「下一章是谁」。
 */
export function useFollowNativeScriptureChapterPage({ displayed }: Args): void {
  const scripture = usePlaybackStream("scripture");
  const router = useRouter();
  const navigation = useNavigation();
  const lastNavigatedUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (!displayed || !scripture.playing || !scripture.uri) return;
    if (scripture.uri === lastNavigatedUriRef.current) return;

    const ref = lookupScriptureQueueChapter(scripture.uri);
    if (!ref) return;
    if (ref.bookId === displayed.bookId && ref.chapter === displayed.chapter) {
      /** 已经在这一章了，记下来免得之后重复判断。 */
      lastNavigatedUriRef.current = scripture.uri;
      return;
    }

    lastNavigatedUriRef.current = scripture.uri;
    navigateReadChapter(router, { bookId: ref.bookId, chapter: ref.chapter }, "forward", {
      getNavigationState: () => navigation.getState(),
    });
  }, [scripture.playing, scripture.uri, displayed, router, navigation]);
}
