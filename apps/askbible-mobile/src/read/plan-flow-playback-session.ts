import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import type { PlanChapterRef } from "./read-plan-flow-nav";

export type PlanFlowPlaybackDeps = {
  playScriptureChapter: (args: {
    bookId: string;
    chapter: number;
    bookName: string;
    translationId: string;
    chapterAudioSrc?: string | null;
  }) => Promise<boolean>;
  navigateToChapter: (ref: PlanChapterRef) => void;
};

/** @deprecated 使用 scriptureChapterPool */
export const planFlowPlaybackSession = {
  registerDeps(deps: PlanFlowPlaybackDeps | null): void {
    if (!deps) {
      scriptureChapterPool.registerDeps(null);
      return;
    }
    scriptureChapterPool.registerDeps({
      playScriptureChapter: (args) =>
        deps.playScriptureChapter({
          ...args,
          chapterAudioSrc: args.chapterAudioSrc ?? "",
        }),
      navigateToChapter: deps.navigateToChapter,
    });
  },
  isActive(): boolean {
    return scriptureChapterPool.isActive();
  },
  ownsAutoplay(): boolean {
    return scriptureChapterPool.isActive();
  },
  begin(): Promise<void> {
    return Promise.resolve();
  },
  stop(): void {
    scriptureChapterPool.stop();
  },
  playChapter(ref: PlanChapterRef): Promise<boolean> {
    const idx = scriptureChapterPool.getTracks().findIndex(
      (t) => t.bookId === ref.bookId && t.chapter === ref.chapter,
    );
    return scriptureChapterPool.playAt(idx >= 0 ? idx : 0);
  },
  onChapterFinished(from: PlanChapterRef): Promise<void> {
    scriptureChapterPool.onTrackFinished(from.bookId, from.chapter);
    return Promise.resolve();
  },
};
