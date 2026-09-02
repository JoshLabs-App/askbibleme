import type { ReadChapterNavDirection } from "./read-chapter-nav";

type ChapterTarget = { bookId: string; chapter: number };
type Navigator = (target: ChapterTarget, direction: ReadChapterNavDirection) => void;

/**
 * 章页自己的 goNeighbor（导航+可选续播音频）只在 useReadChapterScreenNav 这个 hook
 * 实例里，scripturePlayChapterAt.ts 里的 buildReadChapterAdvanceHandlers 是纯逻辑
 * 函数，够不到 router，音频起播时只能靠这里注册的回调换页——避免章页组件已经
 * mount、但 ctx.readChapterRef 还没来得及被这次播放复用（见 keepExistingHandlers）
 * 时，退回到只管音频、不管路由的 fallback handler，造成"音频换章、页面没跟着换"。
 */
let navigator: Navigator | null = null;

export function registerReadChapterNavigate(fn: Navigator | null): void {
  navigator = fn;
}

/** 有章页在监听就导航，返回是否真的调用了（没有章页时调用方仍需自己开播音频）。 */
export function navigateToReadChapterViaRegistry(
  target: ChapterTarget,
  direction: ReadChapterNavDirection,
): boolean {
  if (!navigator) return false;
  navigator(target, direction);
  return true;
}
