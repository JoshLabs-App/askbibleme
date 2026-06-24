import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import {
  buildChapterAudioPlayableSrcSync,
  prefetchScriptureChapterAudioSrc,
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import { isMobileScriptureAudioStreamAllowed } from "../config/mobileBundledOnly";
import { downloadChapterAudioToCache, resolveDownloadedChapterAudioUri } from "./read-audio-package-download";
import type { PlanChapterRef } from "./read-plan-flow-nav";

const PLAN_FLOW_PREFETCH_CONCURRENCY = 3;
export const PLAN_FLOW_CHAPTER_AUDIO_WAIT_MS = 12_000;

function isRemotePlayableSrc(src: string): boolean {
  return /^https?:\/\//i.test(src.trim());
}

function isLocalPlayableSrc(src: string): boolean {
  const s = src.trim();
  return Boolean(s) && !isRemotePlayableSrc(s);
}

/** 确保单章音频可本地播放；远程源会下载到与「朗读音频下载」相同目录。 */
export async function ensurePlanFlowChapterAudioReady(args: {
  ref: PlanChapterRef;
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  timeoutMs?: number;
}): Promise<string | null> {
  const timeoutMs = args.timeoutMs ?? PLAN_FLOW_CHAPTER_AUDIO_WAIT_MS;
  const work = ensurePlanFlowChapterAudioReadyInner(args);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<string | null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ensurePlanFlowChapterAudioReadyInner(args: {
  ref: PlanChapterRef;
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
}): Promise<string | null> {
  if (!translationSupportsChapterAudio(args.translationId)) return null;

  const bookName = getScriptureBookDisplayName(args.ref.bookId);
  const cacheArgs = {
    translationId: args.translationId,
    voiceId: args.voiceId,
    bookId: args.ref.bookId,
    chapter: args.ref.chapter,
  };

  const downloaded = await resolveDownloadedChapterAudioUri(cacheArgs);
  if (downloaded) {
    void prefetchScriptureChapterAudioSrc({ ...cacheArgs, bookName });
    return downloaded;
  }

  const bundled = buildChapterAudioPlayableSrcSync({
    translationId: args.translationId,
    bookId: args.ref.bookId,
    chapter: args.ref.chapter,
    bookName,
    voiceId: args.voiceId,
  });
  if (bundled && isLocalPlayableSrc(bundled)) {
    void prefetchScriptureChapterAudioSrc({ ...cacheArgs, bookName });
    return bundled;
  }

  const resolved = await resolveScripturePlayableSrcForChapter({
    translationId: args.translationId,
    bookId: args.ref.bookId,
    chapter: args.ref.chapter,
    bookName,
    voiceId: args.voiceId,
    cachedSrc: bundled,
  });
  if (!resolved) return null;
  if (isLocalPlayableSrc(resolved)) return resolved;

  if (!isMobileScriptureAudioStreamAllowed()) return null;

  const cached = await downloadChapterAudioToCache({ ...cacheArgs, remoteSrc: resolved });
  return cached ?? resolved;
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

/** 预下载今日 planFlow 队列；默认先 await 首章，其余并行后台拉取。 */
export async function prefetchTodayReadingPlanQueueAudio(
  queue: PlanChapterRef[],
  opts: {
    translationId: string;
    voiceId: CuvChapterAudioVoiceId;
    awaitFirst?: boolean;
  },
): Promise<void> {
  if (!queue.length || !translationSupportsChapterAudio(opts.translationId)) return;

  if (opts.awaitFirst !== false) {
    await ensurePlanFlowChapterAudioReady({
      ref: queue[0]!,
      translationId: opts.translationId,
      voiceId: opts.voiceId,
    });
  }

  const rest = opts.awaitFirst === false ? queue : queue.slice(1);
  await runWithConcurrency(rest, PLAN_FLOW_PREFETCH_CONCURRENCY, async (ref) => {
    await ensurePlanFlowChapterAudioReady({
      ref,
      translationId: opts.translationId,
      voiceId: opts.voiceId,
      timeoutMs: PLAN_FLOW_CHAPTER_AUDIO_WAIT_MS * 2,
    });
  });
}

/** 从当前章起预取 planFlow 队列中后续若干章（不阻塞 UI）。 */
export function prefetchUpcomingPlanFlowChapterAudio(
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
  const upcoming = queue.slice(idx + 1, idx + 1 + Math.max(1, opts.ahead ?? 3));
  if (!upcoming.length) return;
  void prefetchTodayReadingPlanQueueAudio(upcoming, {
    translationId: opts.translationId,
    voiceId: opts.voiceId,
    awaitFirst: false,
  });
}
