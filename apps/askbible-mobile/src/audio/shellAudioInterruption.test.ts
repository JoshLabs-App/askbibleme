import { beforeEach, describe, expect, it, vi } from "vitest";

const listeners = new Map<string, Array<(payload?: unknown) => void>>();

vi.mock("react-native", () => ({
  DeviceEventEmitter: {
    addListener: (name: string, cb: (payload?: unknown) => void) => {
      const list = listeners.get(name) ?? [];
      list.push(cb);
      listeners.set(name, list);
      return { remove: vi.fn() };
    },
  },
}));

describe("shellAudioInterruption", () => {
  beforeEach(() => {
    listeners.clear();
    vi.resetModules();
  });

  it("blocks recover while a phone-call interruption is active", async () => {
    const { getShellAudioInterrupted, installShellAudioInterruptionBridge } =
      await import("./shellAudioInterruption");
    installShellAudioInterruptionBridge();
    expect(getShellAudioInterrupted()).toBe(false);

    listeners.get("AudioSessionInterruptionBegan")?.forEach((cb) => cb());
    expect(getShellAudioInterrupted()).toBe(true);

    listeners.get("AudioSessionInterruptionEnded")?.forEach((cb) => cb());
    expect(getShellAudioInterrupted()).toBe(false);
  });
});
