import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAux: vi.fn(),
  getMusicWant: vi.fn(),
  getVerseWant: vi.fn(),
  getScriptureWant: vi.fn(),
  isAmbientAudible: vi.fn(),
  pauseAmbient: vi.fn(),
  resumeAmbient: vi.fn(),
  getAmbientSlotId: vi.fn(),
  clearAmbientSlot: vi.fn(),
  restoreAmbientSlot: vi.fn(),
}));

vi.mock("./shellAuxMediaOwner", () => ({
  getShellAuxMediaOwner: () => mocks.getAux(),
}));
vi.mock("./shellMusicWantPlaying", () => ({
  getShellMusicWantPlaying: () => mocks.getMusicWant(),
}));
vi.mock("./shellVerseWantPlaying", () => ({
  getShellVerseWantPlaying: () => mocks.getVerseWant(),
}));
vi.mock("./shellScriptureWantPlaying", () => ({
  getShellScriptureWantPlaying: () => mocks.getScriptureWant(),
}));
vi.mock("../nature/natureAmbientExclusiveStop", () => ({
  isNatureAmbientAudible: () => mocks.isAmbientAudible(),
  pauseNatureAmbientForRemote: () => mocks.pauseAmbient(),
  resumeNatureAmbientForRemote: () => mocks.resumeAmbient(),
  getNatureAmbientSlotId: () => mocks.getAmbientSlotId(),
  clearNatureAmbientSlot: () => mocks.clearAmbientSlot(),
  restoreNatureAmbientSlot: (id: string) => mocks.restoreAmbientSlot(id),
}));

import {
  clearAndroidRemoteMuteSnapshot,
  isAndroidRemoteAudioActive,
  pauseAndroidRemoteAudio,
  resumeAndroidRemoteAudio,
} from "./androidRemotePlaybackMute";

describe("androidRemotePlaybackMute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAndroidRemoteMuteSnapshot();
    mocks.getAux.mockReturnValue(null);
    mocks.getMusicWant.mockReturnValue(false);
    mocks.getVerseWant.mockReturnValue(false);
    mocks.getScriptureWant.mockReturnValue(false);
    mocks.isAmbientAudible.mockReturnValue(false);
    mocks.getAmbientSlotId.mockReturnValue("");
  });

  it("pauses music, verse, and ambient together, then resumes the same set", () => {
    const aux = { id: "home-golden-verse", pause: vi.fn(), resume: vi.fn() };
    mocks.getAux.mockReturnValue(aux);
    mocks.getMusicWant.mockReturnValue(true);
    mocks.getVerseWant.mockReturnValue(true);
    mocks.isAmbientAudible.mockReturnValue(true);
    mocks.getAmbientSlotId.mockReturnValue("scene-water");

    const playback = {
      playing: true,
      playbackMode: "music" as const,
      pauseShellPlayback: vi.fn(async () => {
        mocks.getMusicWant.mockReturnValue(false);
      }),
      ensureShellPlaybackActive: vi.fn(async () => undefined),
      togglePlayScripture: vi.fn(async () => undefined),
    };

    expect(isAndroidRemoteAudioActive(playback)).toBe(true);
    pauseAndroidRemoteAudio(playback);

    expect(aux.pause).toHaveBeenCalledTimes(1);
    expect(playback.pauseShellPlayback).toHaveBeenCalledTimes(1);
    expect(mocks.pauseAmbient).toHaveBeenCalledTimes(1);
    expect(mocks.clearAmbientSlot).toHaveBeenCalledTimes(1);
    expect(playback.togglePlayScripture).not.toHaveBeenCalled();

    mocks.getMusicWant.mockReturnValue(false);
    mocks.getVerseWant.mockReturnValue(false);
    mocks.isAmbientAudible.mockReturnValue(false);
    mocks.getAmbientSlotId.mockReturnValue("");
    expect(isAndroidRemoteAudioActive({ ...playback, playing: true })).toBe(false);

    expect(resumeAndroidRemoteAudio({ ...playback, playing: false })).toBe(true);
    expect(aux.resume).toHaveBeenCalledTimes(1);
    expect(playback.ensureShellPlaybackActive).toHaveBeenCalledTimes(1);
    expect(mocks.restoreAmbientSlot).toHaveBeenCalledWith("scene-water");
  });
});
