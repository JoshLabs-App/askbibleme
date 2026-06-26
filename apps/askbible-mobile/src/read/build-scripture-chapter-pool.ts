import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import type { ScripturePoolTrack } from "../music/scripture-chapter-pool";
import { ensurePlanFlowChapterAudioReady } from "./prefetch-plan-flow-chapter-audio";
import type { PlanChapterRef } from "./read-plan-flow-nav";

/** 将今日 planFlow 队列建成可播放列表（每章一条，含本地 src）。 */
export async function buildScriptureChapterPool(
  queue: PlanChapterRef[],
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
): Promise<ScripturePoolTrack[]> {
  if (!queue.length || !translationSupportsChapterAudio(translationId)) {
    return [];
  }

  const tracks: ScripturePoolTrack[] = [];
  for (const ref of queue) {
    const bookName = getScriptureBookDisplayName(ref.bookId);
    const src = await ensurePlanFlowChapterAudioReady({
      ref,
      translationId,
      voiceId,
    });
    if (!src?.trim()) {
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
      src: src.trim(),
      translationId,
    });
  }
  return tracks;
}
