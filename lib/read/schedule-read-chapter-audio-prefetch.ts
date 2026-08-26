import { resolveReadChapterNeighbors } from "@/lib/bible/read-chapter-neighbors";
import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import { prefetchNextReadChapterAssetsIdle } from "@/lib/pwa/prefetch-read-chapter-assets";
import { readPlanFlowActive } from "@/lib/read/plan-flow-session";
import {
  ensurePlanFlowChapterAudioReadyWeb,
  prefetchUpcomingPlanFlowChapterAudioWeb,
} from "@/lib/read/prefetch-plan-flow-chapter-audio-web";
import { readReadingPlanAudioSession } from "@/lib/read/reading-plan-audio-session";

const NEIGHBOR_PREFETCH_DELAY_MS = 2800;

type Args = {
  bookId: string;
  bookName: string;
  chapter: number;
  translationId: string;
  effectiveVoiceId: (bookId: string) => CuvChapterAudioVoiceId;
};

/** 章页聚焦后预取邻章 / planFlow 后续章（对齐 App `useReadChapterAudio`）。 */
export function scheduleReadChapterAudioPrefetch({
  bookId,
  bookName,
  chapter,
  translationId,
  effectiveVoiceId,
}: Args): () => void {
  if (!translationSupportsChapterAudio(translationId)) return () => undefined;

  let cancelled = false;
  const timer = window.setTimeout(() => {
    if (cancelled) return;

    const planSession = readReadingPlanAudioSession();
    if (readPlanFlowActive() && planSession?.queue.length) {
      prefetchUpcomingPlanFlowChapterAudioWeb(
        planSession.queue,
        { bookId, chapter },
        {
          translationId,
          voiceId: effectiveVoiceId(bookId),
          ahead: 3,
        },
      );
      return;
    }

    const voiceId = effectiveVoiceId(bookId);
    prefetchNextReadChapterAssetsIdle({
      bookId,
      bookName,
      chapter,
      translationId,
      voiceId,
    });

    const { prev } = resolveReadChapterNeighbors(bookId, chapter);
    if (prev) {
      void ensurePlanFlowChapterAudioReadyWeb({
        ref: { bookId: prev.bookId, chapter: prev.chapter },
        translationId,
        voiceId: effectiveVoiceId(prev.bookId),
      });
    }
  }, NEIGHBOR_PREFETCH_DELAY_MS);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
