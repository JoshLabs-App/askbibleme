import {
  armReadPlanFlowTodayLoop,
  clearPlanFlowSessionActive,
  clearReadPlanFlowTodayLoop,
  markPlanFlowSessionActive,
} from "../read/read-plan-flow-autoplay";
import {
  markTodayReadingAudioChapterComplete,
  resolveLocalTodayReadingScopeKey,
} from "../read/reading-plan/today-reading-done";
import { writeTodayPlanScriptureResume } from "../read/today-plan-scripture-resume";

/** 播放池条目：结构对齐音乐 PlaybackTrack，一章一轨。 */
export type ScripturePoolTrack = {
  id: string;
  bookId: string;
  chapter: number;
  bookName: string;
  title: string;
  src: string;
  translationId: string;
};

export type ScripturePoolPlayArgs = {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
  chapterAudioSrc: string;
};

type PoolDeps = {
  playScriptureChapter: (
    args: ScripturePoolPlayArgs,
    opts?: { startAtSec?: number },
  ) => Promise<boolean>;
  navigateToChapter: (ref: { bookId: string; chapter: number }) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 今日读经播放池：点播放 = 载入列表 + playAt(index)。
 * 曲末自动 playAt(index+1)，与音乐队列相同，不依赖章页 register/autoplay。
 */
class ScriptureChapterPool {
  private deps: PoolDeps | null = null;
  private tracks: ScripturePoolTrack[] = [];
  private index = 0;
  private loop = false;
  private active = false;
  private advancing = false;

  registerDeps(deps: PoolDeps | null): void {
    this.deps = deps;
  }

  isActive(): boolean {
    return this.active && this.tracks.length > 0;
  }

  getIndex(): number {
    return this.index;
  }

  getCurrentTrack(): ScripturePoolTrack | null {
    return this.tracks[this.index] ?? null;
  }

  getTracks(): readonly ScripturePoolTrack[] {
    return this.tracks;
  }

  /** 章页卸载时不得 stop 音频。 */
  shouldPreservePlaybackOnUIUnmount(): boolean {
    return this.isActive() || this.advancing;
  }

  load(tracks: ScripturePoolTrack[], opts: { loop: boolean }): void {
    this.tracks = tracks;
    this.loop = opts.loop;
    this.active = tracks.length > 0;
    this.index = 0;
    this.advancing = false;
    markPlanFlowSessionActive();
    if (opts.loop) {
      armReadPlanFlowTodayLoop();
    }
  }

  stop(): void {
    this.active = false;
    this.advancing = false;
    this.tracks = [];
    this.index = 0;
    clearPlanFlowSessionActive();
    clearReadPlanFlowTodayLoop();
  }

  /** 从池中指定索引开播（音乐 playTrackAt 同款）。 */
  async playAt(
    index: number,
    opts?: { skipNavigate?: boolean; startAtSec?: number; maxAttempts?: number; retryDelayMs?: number },
  ): Promise<boolean> {
    if (!this.deps || !this.active || this.tracks.length === 0) return false;

    let idx = index;
    if (idx >= this.tracks.length) {
      if (this.loop) {
        idx = 0;
      } else {
        this.stop();
        return false;
      }
    }
    if (idx < 0) idx = 0;

    this.index = idx;
    const track = this.tracks[idx]!;
    if (!opts?.skipNavigate) {
      this.deps.navigateToChapter({ bookId: track.bookId, chapter: track.chapter });
    }

    const maxAttempts = Math.max(1, Math.floor(opts?.maxAttempts ?? 4));
    const retryDelayMs = Math.max(0, Math.floor(opts?.retryDelayMs ?? 450));
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (!this.active) return false;
      if (attempt > 0) await sleep(retryDelayMs);
      const playOpts =
        opts?.startAtSec != null && opts.startAtSec > 0
          ? { startAtSec: opts.startAtSec }
          : undefined;
      const started = await this.deps.playScriptureChapter(
        {
          bookId: track.bookId,
          chapter: track.chapter,
          bookName: track.bookName,
          translationId: track.translationId,
          chapterAudioSrc: track.src,
        },
        playOpts,
      );
      if (__DEV__) {
        console.warn(
          "[scripture-pool] playAt",
          idx,
          track.id,
          "attempt",
          attempt + 1,
          started ? "ok" : "fail",
        );
      }
      if (started) return true;
    }
    return false;
  }

  /** 当前轨 natural end → 下一轨。 */
  onTrackFinished(fromBookId: string, fromChapter: number): void {
    if (!this.active || !this.deps || this.advancing) return;
    void markTodayReadingAudioChapterComplete(fromBookId, fromChapter);
    void this.persistResumeForUpcomingTrack();
    void this.advanceToNext();
  }

  private async persistResumeForUpcomingTrack(): Promise<void> {
    const nextIdx = this.index + 1;
    let idx = nextIdx;
    if (idx >= this.tracks.length) {
      if (!this.loop) return;
      idx = 0;
    }
    const next = this.tracks[idx];
    if (!next) return;
    const scopeKey = await resolveLocalTodayReadingScopeKey();
    await writeTodayPlanScriptureResume({
      scopeKey,
      bookId: next.bookId,
      chapter: next.chapter,
      positionSec: 0,
    });
  }

  private async advanceToNext(): Promise<void> {
    if (this.advancing || !this.active) return;
    this.advancing = true;
    try {
      const nextIdx = this.index + 1;
      if (nextIdx >= this.tracks.length && !this.loop) {
        this.stop();
        return;
      }
      await this.playAt(nextIdx);
    } finally {
      this.advancing = false;
    }
  }

  async retryCurrent(): Promise<boolean> {
    if (!this.active) return false;
    return this.playAt(this.index, { skipNavigate: true });
  }

  async skipToNext(): Promise<boolean> {
    if (!this.active) return false;
    return this.playAt(this.index + 1);
  }
}

export const scriptureChapterPool = new ScriptureChapterPool();
