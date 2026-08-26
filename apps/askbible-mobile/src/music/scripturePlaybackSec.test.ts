import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getScripturePlaybackSecNow,
  getScripturePlaybackSecSnapshot,
  publishScripturePlaybackSec,
  setScripturePlaybackClockPlaying,
  setScripturePlaybackSecForeground,
} from "./scripturePlaybackSec";

describe("scripturePlaybackSec clock", () => {
  afterEach(() => {
    setScripturePlaybackClockPlaying(false);
    setScripturePlaybackSecForeground(true);
    publishScripturePlaybackSec(0);
    vi.useRealTimers();
  });

  it("stays at the last published second while paused", () => {
    publishScripturePlaybackSec(12);
    setScripturePlaybackClockPlaying(false);
    expect(getScripturePlaybackSecSnapshot()).toBe(12);
  });

  it("advances with wall clock while playing", () => {
    vi.useFakeTimers();
    publishScripturePlaybackSec(10);
    setScripturePlaybackClockPlaying(true, 1);
    vi.advanceTimersByTime(500);
    expect(getScripturePlaybackSecSnapshot()).toBeCloseTo(10.5, 2);
  });

  it("returns a cached snapshot until the store notifies", () => {
    vi.useFakeTimers();
    publishScripturePlaybackSec(10);
    setScripturePlaybackClockPlaying(true, 1);
    const a = getScripturePlaybackSecSnapshot();
    const b = getScripturePlaybackSecSnapshot();
    expect(a).toBe(b);
    expect(a).toBe(10);
  });

  it("stops the highlight ticker in the background", () => {
    vi.useFakeTimers();
    publishScripturePlaybackSec(10);
    setScripturePlaybackClockPlaying(true, 1);
    setScripturePlaybackSecForeground(false);
    vi.advanceTimersByTime(2500);
    // 后台只保留切换那一刻发布的值，不再推动 React 快照
    expect(getScripturePlaybackSecSnapshot()).toBeCloseTo(10, 2);
  });

  it("keeps the real position accurate while backgrounded", () => {
    vi.useFakeTimers();
    publishScripturePlaybackSec(10);
    setScripturePlaybackClockPlaying(true, 1);
    setScripturePlaybackSecForeground(false);
    vi.advanceTimersByTime(2500);
    // 媒体控制读的是实时值，不受计时器停摆影响
    expect(getScripturePlaybackSecNow()).toBeCloseTo(12.5, 2);
  });

  it("catches the snapshot up when returning to the foreground", () => {
    vi.useFakeTimers();
    publishScripturePlaybackSec(10);
    setScripturePlaybackClockPlaying(true, 1);
    setScripturePlaybackSecForeground(false);
    vi.advanceTimersByTime(2500);
    setScripturePlaybackSecForeground(true);
    expect(getScripturePlaybackSecSnapshot()).toBeCloseTo(12.5, 2);
    vi.advanceTimersByTime(500);
    expect(getScripturePlaybackSecSnapshot()).toBeCloseTo(13.0, 2);
  });
});
