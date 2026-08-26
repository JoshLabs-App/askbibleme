import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import {
  resolveChapterAudioPlayableSrc,
  translationSupportsChapterAudio,
} from "@/lib/bible/read-chapter-audio";
import type { PlanChapterRef } from "@/lib/read/read-plan-flow-nav";

const PLAN_FLOW_PREFETCH_CONCURRENCY = 3;

function prefetchAudioUrl(url: string): void {
  const src = url.trim();
  if (!src) return;
  try {
    void fetch(src, { mode: "cors", credentials: "omit", cache: "force-cache" });
  } catch {
    /* ignore */
  }
}

export async function ensurePlanFlowChapterAudioReadyWeb(args: {
  ref: PlanChapterRef;
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
}): Promise<string | null> {
  if (!translationSupportsChapterAudio(args.translationId)) return null;
  const bookName = getScriptureBookDisplayName(args.ref.bookId);
  const resolved = await resolveChapterAudioPlayableSrc({
    translationId: args.translationId,
    bookId: args.ref.bookId,
    chapter: args.ref.chapter,
    bookName,
    voiceId: args.voiceId,
  });
  if (!resolved.ok || !resolved.src.trim()) return null;
  prefetchAudioUrl(resolved.src);
  return resolved.src;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (!items.length) return;
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index;
      index += 1;
      await worker(items[i]!);
    }
  });
  await Promise.all(runners);
}

/** 预取今日 planFlow 队列章音频（浏览器 HTTP 缓存）。 */
export async function prefetchTodayReadingPlanQueueAudioWeb(
  queue: PlanChapterRef[],
  opts: {
    translationId: string;
    voiceId: CuvChapterAudioVoiceId;
    awaitFirst?: boolean;
  },
): Promise<void> {
  if (!queue.length || !translationSupportsChapterAudio(opts.translationId)) return;

  if (opts.awaitFirst !== false) {
    await ensurePlanFlowChapterAudioReadyWeb({
      ref: queue[0]!,
      translationId: opts.translationId,
      voiceId: opts.voiceId,
    });
  }

  const rest = opts.awaitFirst === false ? queue : queue.slice(1);
  if (!rest.length) return;

  void runWithConcurrency(rest, PLAN_FLOW_PREFETCH_CONCURRENCY, async (ref) => {
    await ensurePlanFlowChapterAudioReadyWeb({
      ref,
      translationId: opts.translationId,
      voiceId: opts.voiceId,
    });
  });
}

/** 从当前章起预取后续若干章（不阻塞 UI）。 */
export function prefetchUpcomingPlanFlowChapterAudioWeb(
  queue: PlanChapterRef[],
  current: PlanChapterRef,
  opts: {
    translationId: string;
    voiceId: CuvChapterAudioVoiceId;
    ahead?: number;
  },
): void {
  if (!queue.length || !translationSupportsChapterAudio(opts.translationId)) return;
  const idx = queue.findIndex((r) => r.bookId === current.bookId && r.chapter === current.chapter);
  if (idx < 0) return;
  const upcoming = queue.slice(idx + 1, idx + 1 + Math.max(1, opts.ahead ?? 2));
  if (!upcoming.length) return;
  void prefetchTodayReadingPlanQueueAudioWeb(upcoming, {
    translationId: opts.translationId,
    voiceId: opts.voiceId,
    awaitFirst: false,
  });
}
