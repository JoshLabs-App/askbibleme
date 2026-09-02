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
import { requestWidgetVerseStop } from "../widget/widgetPlaybackRequest";
import { isScriptureUserPauseHeld, releaseScriptureUserPause } from "./scriptureUserPause";
import { Platform } from "react-native";

/** 原生读经预取章数。安卓关屏后 JS 易冻住，只预取 2 章约半小时就会断播。 */
export const SCRIPTURE_NATIVE_NEXT_PREFETCH = Platform.OS === "android" ? 10 : 4;


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
    opts?: { startAtSec?: number; respectUserPause?: boolean },
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
  private loop = true;
  private active = false;
  private advancing = false;
  private playToken = 0;
  private playInFlight = false;
  private lastRetryFailAt = 0;
  private lastRetryTrackId: string | null = null;
  private version = 0;
  private listeners = new Set<() => void>();

  /** 用户暂停：作废在途 playAt，避免稍后又把音轨拉起来。 */
  abortPendingPlay(): void {
    this.playToken += 1;
    this.playInFlight = false;
  }

  registerDeps(deps: PoolDeps | null): void {
    this.deps = deps;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getVersion(): number {
    return this.version;
  }

  private notify(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
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

  /** 上一次 playAt（含 skipToNext/Prev）还没落地：换章中的窗口。 */
  isPlayInFlight(): boolean {
    return this.playInFlight;
  }

  /** 预取后续章（含循环）；不推进 index。 */
  peekUpcoming(count: number): ScripturePoolTrack[] {
    if (!this.active || this.tracks.length === 0 || count <= 0) return [];
    const out: ScripturePoolTrack[] = [];
    for (let offset = 1; offset <= count; offset += 1) {
      let idx = this.index + offset;
      if (idx >= this.tracks.length) {
        if (!this.loop) break;
        idx = idx % this.tracks.length;
      }
      const track = this.tracks[idx];
      if (!track) break;
      // 单章循环池：避免 next 指向自己。
      if (track.id === this.tracks[this.index]?.id && this.tracks.length === 1) break;
      out.push(track);
    }
    return out;
  }

  getTracks(): readonly ScripturePoolTrack[] {
    return this.tracks;
  }

  getLoop(): boolean {
    return this.loop;
  }

  setLoop(loop: boolean): void {
    if (this.loop === loop) return;
    this.loop = loop;
    if (loop) {
      armReadPlanFlowTodayLoop();
    } else {
      clearReadPlanFlowTodayLoop();
    }
    this.notify();
  }

  /** 章页卸载时不得 stop 音频。 */
  shouldPreservePlaybackOnUIUnmount(): boolean {
    return this.isActive() || this.advancing;
  }

  load(tracks: ScripturePoolTrack[], opts?: { loop?: boolean }): void {
    this.tracks = tracks;
    if (opts?.loop != null) {
      this.loop = opts.loop;
    }
    this.active = tracks.length > 0;
    this.index = 0;
    this.advancing = false;
    markPlanFlowSessionActive();
    if (this.loop) {
      armReadPlanFlowTodayLoop();
    } else {
      clearReadPlanFlowTodayLoop();
    }
    this.notify();
  }

  stop(): void {
    this.active = false;
    this.advancing = false;
    this.playToken += 1;
    this.playInFlight = false;
    this.lastRetryFailAt = 0;
    this.lastRetryTrackId = null;
    this.tracks = [];
    this.index = 0;
    clearPlanFlowSessionActive();
    clearReadPlanFlowTodayLoop();
    this.notify();
  }

  /** 从池中指定索引开播（音乐 playTrackAt 同款）。 */
  async playAt(
    index: number,
    opts?: {
      skipNavigate?: boolean;
      startAtSec?: number;
      maxAttempts?: number;
      retryDelayMs?: number;
      respectUserPause?: boolean;
    },
  ): Promise<boolean> {
    if (!this.deps || !this.active || this.tracks.length === 0) return false;
    if (opts?.respectUserPause && isScriptureUserPauseHeld()) return false;
    if (opts?.respectUserPause && this.playInFlight) return false;
    if (!opts?.respectUserPause) {
      releaseScriptureUserPause();
    }
    // 读经计划与金句互斥。
    requestWidgetVerseStop();

    const token = ++this.playToken;
    this.playInFlight = true;

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

    const prevIndex = this.index;
    // 乐观更新 index 便于 UI；失败时回滚，避免「章号已变、音轨未切」。
    this.index = idx;
    this.notify();
    const track = this.tracks[idx]!;
    if (!opts?.skipNavigate) {
      this.deps.navigateToChapter({ bookId: track.bookId, chapter: track.chapter });
    }

    const maxAttempts = Math.max(1, Math.floor(opts?.maxAttempts ?? 4));
    const retryDelayMs = Math.max(0, Math.floor(opts?.retryDelayMs ?? 450));
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (token !== this.playToken || !this.active) return false;
        if (opts?.respectUserPause && isScriptureUserPauseHeld()) return false;
        if (attempt > 0) await sleep(retryDelayMs);
        if (token !== this.playToken || !this.active) return false;
        if (opts?.respectUserPause && isScriptureUserPauseHeld()) return false;
        const playOpts =
          opts?.startAtSec != null && opts.startAtSec > 0
            ? { startAtSec: opts.startAtSec, respectUserPause: opts.respectUserPause }
            : { respectUserPause: opts?.respectUserPause };
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
        if (started) {
          this.lastRetryFailAt = 0;
          this.lastRetryTrackId = null;
          return true;
        }
      }
      if (token === this.playToken && this.active && this.index === idx) {
        this.index = prevIndex;
        this.notify();
      }
      return false;
    } finally {
      if (token === this.playToken) this.playInFlight = false;
    }
  }

  /** 当前轨 natural end → 下一轨。 */
  onTrackFinished(fromBookId: string, fromChapter: number): void {
    if (!this.active || !this.deps || this.advancing) return;
    void markTodayReadingAudioChapterComplete(fromBookId, fromChapter);
    void this.persistResumeForUpcomingTrack();
    void this.advanceToNext();
  }

  /**
   * iOS 原生已接播下一章：只推进池 index / 导航 / 完成标记，勿再 playAt。
   * @returns 新的当前轨（已在播）
   */
  onNativeChained(fromBookId: string, fromChapter: number): ScripturePoolTrack | null {
    if (!this.active || this.tracks.length === 0) return null;
    void markTodayReadingAudioChapterComplete(fromBookId, fromChapter);
    void this.persistResumeForUpcomingTrack();
    let nextIdx = this.index + 1;
    if (nextIdx >= this.tracks.length) {
      if (!this.loop) {
        this.stop();
        return null;
      }
      nextIdx = 0;
    }
    this.index = nextIdx;
    this.notify();
    const track = this.tracks[nextIdx] ?? null;
    if (track && this.deps && !this.advancing) {
      this.deps.navigateToChapter({ bookId: track.bookId, chapter: track.chapter });
    }
    return track;
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
      await this.playAt(nextIdx, { respectUserPause: true });
    } finally {
      this.advancing = false;
    }
  }

  async retryCurrent(): Promise<boolean> {
    if (!this.active || this.playInFlight) return false;
    if (isScriptureUserPauseHeld()) return false;
    const track = this.tracks[this.index];
    if (
      track &&
      this.lastRetryTrackId === track.id &&
      Date.now() - this.lastRetryFailAt < 8000
    ) {
      return false;
    }
    const ok = await this.playAt(this.index, {
      skipNavigate: true,
      maxAttempts: 1,
      respectUserPause: true,
    });
    if (!ok && track) {
      this.lastRetryFailAt = Date.now();
      this.lastRetryTrackId = track.id;
    }
    return ok;
  }

  async skipToNext(opts?: { skipNavigate?: boolean }): Promise<boolean> {
    if (!this.active) return false;
    // 上一次 skip 还没落地（音频没起播/路由没换完）就再点：this.index 是同步自增的，
    // 但驱动文字换页靠的是 navigateToChapter → 章页异步加载新章内容 → 重新注册
    // playing。这段异步差期间再连点，会把 index 一路顶到 N+5，文字侧的匹配判断
    // 却还在对着没跟上的旧注册，结果文字卡在 N+1、音频已经在 N+5——见人工测试
    // 反馈。此处直接吞掉连点，等上一次真正落地再接受下一次 skip。
    if (this.playInFlight) return false;
    return this.playAt(this.index + 1, { skipNavigate: opts?.skipNavigate });
  }

  async skipToPrev(opts?: { skipNavigate?: boolean }): Promise<boolean> {
    if (!this.active || this.tracks.length === 0) return false;
    if (this.playInFlight) return false;
    const prev = this.index - 1;
    if (prev < 0) {
      if (!this.loop) return false;
      return this.playAt(this.tracks.length - 1, { skipNavigate: opts?.skipNavigate });
    }
    return this.playAt(prev, { skipNavigate: opts?.skipNavigate });
  }
}

export const scriptureChapterPool = new ScriptureChapterPool();
