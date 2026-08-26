import { beforeEach, describe, expect, it, vi } from "vitest";

const aux = vi.hoisted(() => ({
  getShellAuxMediaOwner: vi.fn(() => null as { pause?: () => Promise<void> } | null),
}));

const media = vi.hoisted(() => ({
  setShellSleepTimerDeadline: vi.fn(),
}));

const wants = vi.hoisted(() => ({
  setShellScriptureWantPlaying: vi.fn(),
  setShellVerseWantPlaying: vi.fn(),
}));

const nature = vi.hoisted(() => ({
  pauseNatureAmbientForRemote: vi.fn(async () => {}),
}));

vi.mock("../audio/shellAuxMediaOwner", () => aux);
vi.mock("../audio/shellMediaControls", () => ({
  ...media,
  pauseShellAppMusic: vi.fn(),
}));
vi.mock("../audio/shellScriptureWantPlaying", () => ({
  setShellScriptureWantPlaying: wants.setShellScriptureWantPlaying,
}));
vi.mock("../audio/shellVerseWantPlaying", () => ({
  setShellVerseWantPlaying: wants.setShellVerseWantPlaying,
}));
vi.mock("../nature/natureAmbientExclusiveStop", () => nature);
vi.mock("../read/read-plan-flow-autoplay", () => ({
  consumeReadPlanFlowAutoplay: vi.fn(() => false),
}));
vi.mock("../widget/widgetPlaybackRequest", () => ({
  requestWidgetVerseStop: vi.fn(),
}));
vi.mock("./scripture-chapter-pool", () => ({
  scriptureChapterPool: { abortPendingPlay: vi.fn() },
}));
vi.mock("./scriptureUserPause", async () => {
  const actual = await vi.importActual<typeof import("./scriptureUserPause")>("./scriptureUserPause");
  return { ...actual, holdScriptureUserPause: vi.fn(actual.holdScriptureUserPause) };
});

import { runMusicSleepTimerFire } from "./musicSleepTimerFire";
import { holdScriptureUserPause, releaseScriptureUserPause } from "./scriptureUserPause";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import { requestWidgetVerseStop } from "../widget/widgetPlaybackRequest";
import { consumeReadPlanFlowAutoplay } from "../read/read-plan-flow-autoplay";

function makeArgs(overrides: Partial<Parameters<typeof runMusicSleepTimerFire>[0]> = {}) {
  return {
    firingRef: { current: false },
    sleepTimerDeadlineRef: { current: 1_000 as number | null },
    setSleepTimerMinutesState: vi.fn(),
    pauseShellPlayback: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("runMusicSleepTimerFire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    releaseScriptureUserPause();
    aux.getShellAuxMediaOwner.mockReturnValue(null);
  });

  it("silences playback and clears the timer", async () => {
    const args = makeArgs();
    await runMusicSleepTimerFire(args);

    expect(args.pauseShellPlayback).toHaveBeenCalledOnce();
    expect(args.setSleepTimerMinutesState).toHaveBeenCalledWith(0);
    expect(args.sleepTimerDeadlineRef.current).toBeNull();
    expect(wants.setShellVerseWantPlaying).toHaveBeenCalledWith(false);
    expect(wants.setShellScriptureWantPlaying).toHaveBeenCalledWith(false);
    expect(nature.pauseNatureAmbientForRemote).toHaveBeenCalledOnce();
    expect(holdScriptureUserPause).toHaveBeenCalledWith("sleep-timer");
    expect(scriptureChapterPool.abortPendingPlay).toHaveBeenCalled();
    expect(consumeReadPlanFlowAutoplay).toHaveBeenCalled();
    expect(requestWidgetVerseStop).toHaveBeenCalled();
    // 到期后要把原生截止时间撤掉，否则下次 arm 会被上一轮的残留干扰。
    expect(media.setShellSleepTimerDeadline).toHaveBeenCalledWith(null);
  });

  it("also pauses whoever currently owns aux media", async () => {
    const pause = vi.fn(async () => {});
    aux.getShellAuxMediaOwner.mockReturnValue({ pause });
    await runMusicSleepTimerFire(makeArgs());
    expect(pause).toHaveBeenCalledOnce();
  });

  it("still pauses playback when the aux owner throws", async () => {
    aux.getShellAuxMediaOwner.mockReturnValue({
      pause: vi.fn(async () => {
        throw new Error("aux boom");
      }),
    });
    const args = makeArgs();
    await runMusicSleepTimerFire(args);
    expect(args.pauseShellPlayback).toHaveBeenCalledOnce();
  });

  // 原生到期事件和前台兜底超时会同时到，只能停一次。
  it("ignores a re-entrant fire while one is already running", async () => {
    const args = makeArgs({ firingRef: { current: true } });
    await runMusicSleepTimerFire(args);
    expect(args.pauseShellPlayback).not.toHaveBeenCalled();
    expect(args.setSleepTimerMinutesState).not.toHaveBeenCalled();
  });

  it("reopens the gate so a later timer can fire", async () => {
    const args = makeArgs();
    await runMusicSleepTimerFire(args);
    expect(args.firingRef.current).toBe(false);
  });

  it("reopens the gate even if pausing fails", async () => {
    const args = makeArgs({
      pauseShellPlayback: vi.fn(async () => {
        throw new Error("pause boom");
      }),
    });
    await expect(runMusicSleepTimerFire(args)).rejects.toThrow("pause boom");
    expect(args.firingRef.current).toBe(false);
    expect(media.setShellSleepTimerDeadline).toHaveBeenCalledWith(null);
  });
});
