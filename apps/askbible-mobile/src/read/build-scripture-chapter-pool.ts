import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import type { ScripturePoolTrack } from "../music/scripture-chapter-pool";
import { ensurePlanFlowChapterAudioReady } from "./prefetch-plan-flow-chapter-audio";
import type { PlanChapterRef } from "./read-plan-flow-nav";

export type BuildScriptureChapterPoolOpts = {
  /** 只解析本地已准备好的音源，不等待整队列预取。 */
  lazySrc?: boolean;
};

async function resolvePlanFlowChapterAudioLocalSrc(args: {
  ref: PlanChapterRef;
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
}): Promise<string | null> {
  // 快速启动模式只先占位，不做逐章本地/下载检查；真正播放时再解析。
  void args;
  return "";
}

/** 将今日 planFlow 队列建成可播放列表（每章一条，含本地 src）。 */
export async function buildScriptureChapterPool(
  queue: PlanChapterRef[],
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
  opts?: BuildScriptureChapterPoolOpts,
): Promise<ScripturePoolTrack[]> {
  if (!queue.length || !translationSupportsChapterAudio(translationId)) {
    return [];
  }

  const tracks: ScripturePoolTrack[] = [];
  for (const ref of queue) {
    const bookName = getScriptureBookDisplayName(ref.bookId);
    const src = opts?.lazySrc
      ? await resolvePlanFlowChapterAudioLocalSrc({
          ref,
          translationId,
          voiceId,
        })
      : await ensurePlanFlowChapterAudioReady({
          ref,
          translationId,
          voiceId,
        });
    if (!src?.trim() && !opts?.lazySrc) {
      if (__DEV__) {
        console.warn("[scripture-pool] skip, no local src", ref.bookId, ref.chapter);
      }
      continue;
    }
    tracks.push({
      id: `${ref.bookId}:${ref.chapter}`,
      bookId: ref.bookId,
      chapter: ref.chapter,
      bookName,
      title: `${bookName} ${ref.chapter}`,
      src: src?.trim() ?? "",
      translationId,
    });
  }
  return tracks;
}
