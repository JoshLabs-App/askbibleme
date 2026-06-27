import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { awaitPlanFlowHandoffRelease } from "../music/scripturePlanFlowHandoff";
import { ensurePlanFlowChapterAudioReady } from "./prefetch-plan-flow-chapter-audio";
import {
  armReadPlanFlowAutoplay,
  notifyPlanFlowChapterRegistered,
} from "./read-plan-flow-autoplay";

type PlayChapterArgs = {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
  chapterAudioSrc?: string | null;
};

type PlayFn = (args: PlayChapterArgs) => Promise<boolean>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 导航完成后强制开播目标章（planFlow 续章 / 邻章自动朗读）。 */
export async function kickReadChapterScriptureAfterNavigate(
  playScriptureChapter: PlayFn,
  target: { bookId: string; chapter: number },
  translationId: string,
  cachedChapterAudioSrc?: string | null,
  voiceId?: CuvChapterAudioVoiceId,
): Promise<boolean> {
  await awaitPlanFlowHandoffRelease();
  armReadPlanFlowAutoplay();

  let resolvedSrc = cachedChapterAudioSrc?.trim() || null;
  if (!resolvedSrc && voiceId) {
    resolvedSrc = await ensurePlanFlowChapterAudioReady({
      ref: target,
      translationId,
      voiceId,
    });
  }

  const bookName = getScriptureBookDisplayName(target.bookId);
  const playArgs: PlayChapterArgs = {
    bookId: target.bookId,
    chapter: target.chapter,
    bookName,
    translationId,
    chapterAudioSrc: resolvedSrc,
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) {
      await sleep(400);
      armReadPlanFlowAutoplay();
      if (!playArgs.chapterAudioSrc?.trim() && voiceId) {
        playArgs.chapterAudioSrc = await ensurePlanFlowChapterAudioReady({
          ref: target,
          translationId,
          voiceId,
        });
      }
    }
    const started = await playScriptureChapter(playArgs);
    if (__DEV__) {
      console.warn(
        "[planFlow-kick]",
        target.bookId,
        target.chapter,
        "attempt",
        attempt + 1,
        started ? "started" : "retry",
        playArgs.chapterAudioSrc ? "has-src" : "no-src",
      );
    }
    if (started) {
      notifyPlanFlowChapterRegistered();
      return true;
    }
  }
  armReadPlanFlowAutoplay();
  return false;
}
