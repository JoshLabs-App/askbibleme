import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addListener: vi.fn(() => ({ remove: vi.fn() })),
  eventEmitterCtor: vi.fn(),
  requireOptionalNativeModule: vi.fn(),
  getTurboModule: vi.fn(),
}));

vi.mock("react-native", () => ({
  DeviceEventEmitter: { addListener: mocks.addListener },
  NativeModules: {},
  Platform: { OS: "android" },
  TurboModuleRegistry: { get: mocks.getTurboModule },
}));

vi.mock("expo-modules-core", () => ({
  EventEmitter: mocks.eventEmitterCtor,
  requireOptionalNativeModule: mocks.requireOptionalNativeModule,
}));

import {
  subscribeShellMediaRemoteCommands,
  subscribeShellSleepTimerFired,
} from "./shellMediaControls";

describe("subscribeShellMediaRemoteCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses DeviceEventEmitter on Android", () => {
    const unsubscribe = subscribeShellMediaRemoteCommands({
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onToggle: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
      onStop: vi.fn(),
    });

    expect(mocks.addListener).toHaveBeenCalledWith("RemotePlay", expect.any(Function));
    expect(mocks.addListener).toHaveBeenCalledWith("RemotePause", expect.any(Function));
    expect(mocks.addListener).toHaveBeenCalledWith("RemoteToggle", expect.any(Function));
    expect(mocks.addListener).toHaveBeenCalledWith("RemoteNext", expect.any(Function));
    expect(mocks.addListener).toHaveBeenCalledWith("RemotePrevious", expect.any(Function));
    expect(mocks.addListener).toHaveBeenCalledWith("RemoteStop", expect.any(Function));
    expect(mocks.eventEmitterCtor).not.toHaveBeenCalled();
    expect(mocks.requireOptionalNativeModule).not.toHaveBeenCalled();
    expect(typeof unsubscribe).toBe("function");
  });
});

describe("subscribeShellSleepTimerFired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listens on DeviceEventEmitter on Android", () => {
    const onFire = vi.fn();
    const unsubscribe = subscribeShellSleepTimerFired(onFire);
    expect(mocks.addListener).toHaveBeenCalledWith(
      "ShellMediaSleepTimerFired",
      onFire,
    );
    expect(typeof unsubscribe).toBe("function");
  });
});
