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

/**
 * 确保单章有可播 URI。
 * 本地已有 → 直接用；远程 → 默认可先返回 URL 开播，并后台落到 10 天流式缓存。
 */
export async function ensurePlanFlowChapterAudioReady(args: {
  ref: PlanChapterRef;
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  timeoutMs?: number;
  /**
   * true（默认）：远程先流式返回，后台落盘，避免首点干等整文件。
   * false：等下载完再返回（适合后台预取后续章）。
   */
  streamFirst?: boolean;
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
  streamFirst?: boolean;
}): Promise<string | null> {
  if (!translationSupportsChapterAudio(args.translationId)) return null;

  const bookName = getScriptureBookDisplayName(args.ref.bookId);
  const cacheArgs = {
    translationId: args.translationId,
    voiceId: args.voiceId,
    bookId: args.ref.bookId,
    chapter: args.ref.chapter,
  };
  const streamFirst = args.streamFirst !== false;

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

  if (streamFirst) {
    void downloadChapterAudioToCache({ ...cacheArgs, remoteSrc: resolved });
    return resolved;
  }

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

/**
 * 预取今日 planFlow 队列音频。
 * 首章默认 streamFirst（可先播再落盘）；后续章后台尽量下完，减少换章等待。
 */
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
      streamFirst: true,
    });
  }

  const rest = opts.awaitFirst === false ? queue : queue.slice(1);
  if (!rest.length) return;

  // 后台预取：不 await；后续章等落盘，换章更稳。
  void runWithConcurrency(rest, PLAN_FLOW_PREFETCH_CONCURRENCY, async (ref) => {
    await ensurePlanFlowChapterAudioReady({
      ref,
      translationId: opts.translationId,
      voiceId: opts.voiceId,
      timeoutMs: PLAN_FLOW_CHAPTER_AUDIO_WAIT_MS * 2,
      streamFirst: false,
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
