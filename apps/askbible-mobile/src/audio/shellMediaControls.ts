import {
  DeviceEventEmitter,
  NativeModules,
  Platform,
  TurboModuleRegistry,
} from "react-native";
import { EventEmitter, requireOptionalNativeModule } from "expo-modules-core";

export type ShellMediaSessionPayload = {
  title: string;
  artist: string;
  album?: string;
  assetUri?: string | null;
  artworkUri?: string | null;
  durationSec: number;
  positionSec: number;
  playing: boolean;
};

type ShellMediaControlsNativeModule = {
  updateSession?: (json: string) => void | Promise<void>;
  clearSession?: () => void | Promise<void>;
};

const MODULE_NAMES = ["AskBibleShellMediaControls", "AskbibleShellMediaControls"] as const;

type ExpoHostGlobal = typeof globalThis & {
  expo?: { modules?: Record<string, ShellMediaControlsNativeModule | undefined> };
};

type RemoteSubscription = { remove: () => void };

let cachedModule: ShellMediaControlsNativeModule | undefined;
let lastSessionPayloadKey: string | null = null;
let lastSessionCleared = false;
let lastMissingModuleWarnAt = 0;

function isUsableShellMediaModule(
  mod: ShellMediaControlsNativeModule | null | undefined,
): mod is ShellMediaControlsNativeModule {
  return typeof mod?.updateSession === "function";
}

/** Expo 54 + New Architecture：优先读 `globalThis.expo.modules`（与 copy-scripture-verse-clipboard 同路）。 */
function getNativeModule(): ShellMediaControlsNativeModule | null {
  if (cachedModule) return cachedModule;
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }

  for (const moduleName of MODULE_NAMES) {
    const fromHost = (globalThis as ExpoHostGlobal).expo?.modules?.[moduleName];
    if (isUsableShellMediaModule(fromHost)) {
      cachedModule = fromHost;
      return cachedModule;
    }

    try {
      const fromTurbo = TurboModuleRegistry.get(moduleName) as ShellMediaControlsNativeModule | null;
      if (isUsableShellMediaModule(fromTurbo)) {
        cachedModule = fromTurbo;
        return cachedModule;
      }
    } catch {
      /* module not in Turbo registry */
    }

    try {
      const fromExpo = requireOptionalNativeModule<ShellMediaControlsNativeModule>(moduleName);
      if (isUsableShellMediaModule(fromExpo)) {
        cachedModule = fromExpo;
        return cachedModule;
      }
    } catch {
      /* optional module probe failed */
    }

    const legacy = NativeModules[moduleName] as ShellMediaControlsNativeModule | undefined;
    if (isUsableShellMediaModule(legacy)) {
      cachedModule = legacy;
      return cachedModule;
    }
  }

  const now = Date.now();
  if (now - lastMissingModuleWarnAt > 3000 && __DEV__) {
    lastMissingModuleWarnAt = now;
    const expoKeys = Object.keys((globalThis as ExpoHostGlobal).expo?.modules ?? {}).slice(0, 20);
    const nativeKeys = Object.keys(NativeModules)
      .filter((key) => key.toLowerCase().includes("media") || key.toLowerCase().includes("askbible"))
      .slice(0, 20);
    console.warn("[shell-media] native module unavailable", { expoKeys, nativeKeys });
  }
  return null;
}

function invokeNativeVoid(fn: (() => void | Promise<void>) | undefined): void {
  if (!fn) return;
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).then === "function") {
      void (result as Promise<void>).catch(() => {});
    }
  } catch {
    /* native bridge unavailable */
  }
}

export function syncShellMediaSession(payload: ShellMediaSessionPayload | null): void {
  const mod = getNativeModule();
  if (!mod) return;
  if (!payload) {
    if (lastSessionCleared) return;
    lastSessionPayloadKey = null;
    lastSessionCleared = true;
    invokeNativeVoid(mod.clearSession?.bind(mod));
    return;
  }
  const payloadKey = JSON.stringify(payload);
  if (payloadKey === lastSessionPayloadKey && !lastSessionCleared) return;
  lastSessionPayloadKey = payloadKey;
  lastSessionCleared = false;
  if (__DEV__) {
    console.warn("[shell-media] sync session", {
      title: payload.title,
      playing: payload.playing,
      durationSec: payload.durationSec,
      positionSec: payload.positionSec,
    });
  }
  invokeNativeVoid(() => mod.updateSession?.(payloadKey));
}

function subscribeExpoRemoteEvents(handlers: {
  onPlay: () => void;
  onPause: () => void;
  onToggle: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onReadingToggle?: () => void;
  onMusicToggle?: () => void;
}): (() => void) | null {
  let mod: ShellMediaControlsNativeModule | undefined;
  for (const moduleName of MODULE_NAMES) {
    mod = (globalThis as ExpoHostGlobal).expo?.modules?.[moduleName];
    if (mod) break;
  }
  if (!mod) return null;

  const emitter = new EventEmitter(mod as never) as {
    addListener: (eventName: string, handler: () => void) => RemoteSubscription;
  };
  const subs: RemoteSubscription[] = [
    emitter.addListener("RemotePlay", handlers.onPlay),
    emitter.addListener("RemotePause", handlers.onPause),
    emitter.addListener("RemoteToggle", handlers.onToggle),
  ];
  if (handlers.onNext) {
    subs.push(emitter.addListener("RemoteNext", handlers.onNext));
  }
  if (handlers.onPrevious) {
    subs.push(emitter.addListener("RemotePrevious", handlers.onPrevious));
  }
  if (handlers.onReadingToggle) {
    subs.push(emitter.addListener("RemoteReadingToggle", handlers.onReadingToggle));
  }
  if (handlers.onMusicToggle) {
    subs.push(emitter.addListener("RemoteMusicToggle", handlers.onMusicToggle));
  }
  return () => {
    for (const sub of subs) sub.remove();
  };
}

function subscribeDeviceRemoteEvents(handlers: {
  onPlay: () => void;
  onPause: () => void;
  onToggle: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onReadingToggle?: () => void;
  onMusicToggle?: () => void;
}): () => void {
  const subs: RemoteSubscription[] = [
    DeviceEventEmitter.addListener("RemotePlay", handlers.onPlay),
    DeviceEventEmitter.addListener("RemotePause", handlers.onPause),
    DeviceEventEmitter.addListener("RemoteToggle", handlers.onToggle),
  ];
  if (handlers.onNext) {
    subs.push(DeviceEventEmitter.addListener("RemoteNext", handlers.onNext));
  }
  if (handlers.onPrevious) {
    subs.push(DeviceEventEmitter.addListener("RemotePrevious", handlers.onPrevious));
  }
  if (handlers.onReadingToggle) {
    subs.push(DeviceEventEmitter.addListener("RemoteReadingToggle", handlers.onReadingToggle));
  }
  if (handlers.onMusicToggle) {
    subs.push(DeviceEventEmitter.addListener("RemoteMusicToggle", handlers.onMusicToggle));
  }
  return () => {
    for (const sub of subs) sub.remove();
  };
}

export function subscribeShellMediaRemoteCommands(handlers: {
  onPlay: () => void;
  onPause: () => void;
  onToggle: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  /** 桌面挂件「读经」键：只作用于本日读经音频。 */
  onReadingToggle?: () => void;
  /** 桌面挂件「音乐」键：只作用于音乐播放器。 */
  onMusicToggle?: () => void;
}): () => void {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return () => {};

  if (Platform.OS === "android") {
    return subscribeDeviceRemoteEvents(handlers);
  }

  const unsubscribeExpo = subscribeExpoRemoteEvents(handlers);
  if (unsubscribeExpo) return unsubscribeExpo;

  if (!getNativeModule()) return () => {};
  return subscribeDeviceRemoteEvents(handlers);
}

/** 播放刚开始时立即推送（不依赖 React state / effect 时序）。 */
export function syncShellMediaSessionExplicit(payload: ShellMediaSessionPayload): void {
  syncShellMediaSession(payload);
}
