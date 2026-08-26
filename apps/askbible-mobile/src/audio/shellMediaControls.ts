import {
  DeviceEventEmitter,
  NativeModules,
  Platform,
  TurboModuleRegistry,
} from "react-native";
import { EventEmitter, requireOptionalNativeModule } from "expo-modules-core";
import { installShellAudioInterruptionBridge } from "./shellAudioInterruption";
import { getShellMusicWantPlaying } from "./shellMusicWantPlaying";
import { getShellScriptureWantPlaying } from "./shellScriptureWantPlaying";
import { getShellVerseWantPlaying } from "./shellVerseWantPlaying";

export type ShellMediaSessionKind = "music" | "scripture" | "verse" | "ambient";

export type ShellMediaSessionPayload = {
  title: string;
  artist: string;
  album?: string;
  assetUri?: string | null;
  artworkUri?: string | null;
  durationSec: number;
  positionSec: number;
  playing: boolean;
  /** music / verse / scripture（本地 URI）由 iOS App 主工程 AVPlayer 独占；环境音仍走 expo-av。 */
  kind?: ShellMediaSessionKind;
  /** iOS 金句：句间静音秒数（原生播 gapAssetUri）。 */
  gapSec?: number;
  gapAssetUri?: string | null;
  /** iOS 金句：预取的下一句本地 URI（后台 gap 后原生直接接播）。 */
  nextAssetUri?: string | null;
  /** iOS 金句：再下一句，降低后台 JS 挂起时断播。 */
  nextNextAssetUri?: string | null;
  /** Android 金句：更长原生队列，关屏后 JS 冻住仍能接播。 */
  nextAssetUris?: string[] | null;
  /** iOS 读经：播放速率 / 段末停止。 */
  rate?: number;
  stopAtSec?: number;
  userPause?: boolean;
  userPlay?: boolean;
  /** 锁屏 Previous / 用户显式重开当前句；无此标记时原生勿在句中 seek 回 0。 */
  forceRestart?: boolean;
};

type ShellMediaControlsNativeModule = {
  updateSession?: (json: string) => void | Promise<void>;
  clearSession?: (reason?: string) => void | Promise<void>;
  /** iOS / Android：用户点停 → 立刻停原生主轨 */
  pauseAppMusic?: () => void | Promise<void>;
  /** iOS / Android：用户点播 → 恢复原生主轨（带 userPlay，可越过 userPaused） */
  resumeAppMusic?: () => void | Promise<void>;
  /** 锁屏睡眠定时：墙钟截止毫秒；传 0 取消。原生一次性到期，不依赖 JS 循环。 */
  setSleepTimerDeadlineMs?: (deadlineMs: number) => void | Promise<void>;
  /** iOS / Android：读经语速写回原生播放器 */
  setPlaybackRate?: (rate: number) => void | Promise<void>;
  /** iOS / Android：主轨（读经/音乐）跳转到秒 */
  seekTo?: (positionSec: number) => void | Promise<void>;
  /** iOS / Android：音乐专辑基准音量 0…1；金句 duck 在此之上再压 */
  setMusicVolume?: (volume: number) => void | Promise<void>;
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
let lastSentPlaying: boolean | null = null;
let lastSentTitle: string | null = null;
let lastSentPositionSec = -1;
let lastSentKind: ShellMediaSessionKind | null = null;
let lastSentAssetUri: string | null = null;
let lastSentNextAssetUri: string | null = null;
let lastSentNextNextAssetUri: string | null = null;
let lastSentNextAssetUrisKey = "";
let lastSentGapSec = -1;
let lastSentGapAssetUri: string | null = null;
/** 用户划掉系统媒体控件后，禁止自动再推送会话，直到下次主动播放。 */
let shellMediaSessionUserDismissed = false;
let shellMediaSessionDismissedAt = 0;
/** 划掉后短暂吞掉仍为 playing 的同步，避免停播竞态把通知又推回来。 */
const SHELL_MEDIA_DISMISS_GRACE_MS = 900;

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
    // 用户仍要听歌/金句/读经时误清 Now Playing → 约 1 分钟后系统掐后台音频（真机日志已证实）。
    if (
      getShellMusicWantPlaying() ||
      getShellVerseWantPlaying() ||
      getShellScriptureWantPlaying() ||
      lastSentPlaying === true
    ) {
      console.warn("[shell-media] refuse clearSession", {
        wantMusic: getShellMusicWantPlaying(),
        wantVerse: getShellVerseWantPlaying(),
        wantScripture: getShellScriptureWantPlaying(),
        lastPlaying: lastSentPlaying,
      });
      return;
    }
    if (lastSessionCleared) return;
    lastSessionPayloadKey = null;
    lastSessionCleared = true;
    lastSentPlaying = null;
    lastSentTitle = null;
    lastSentPositionSec = -1;
    lastSentKind = null;
    lastSentAssetUri = null;
    lastSentNextAssetUri = null;
    lastSentNextNextAssetUri = null;
    lastSentNextAssetUrisKey = "";
    lastSentGapSec = -1;
    lastSentGapAssetUri = null;
    try {
      const clear = mod.clearSession?.bind(mod);
      if (clear) {
        const result = (clear as (reason?: string) => void | Promise<void>)("js-null-payload");
        if (result && typeof (result as Promise<void>).then === "function") {
          void (result as Promise<void>).catch(() => {});
        }
      }
    } catch {
      /* ignore */
    }
    return;
  }
  // 金句可在音乐占栏时仍推送（Android 垫底原生轨 / iOS 混播）；环境音勿盖住音乐。
  if (
    getShellMusicWantPlaying() &&
    payload.kind !== "music" &&
    payload.kind !== "scripture" &&
    payload.kind !== "verse"
  ) {
    return;
  }
  // iOS 原生引擎把未知 kind 当成 music。环境音只在「没有金句/音乐」时进会话，关屏保活。
  if (
    Platform.OS === "ios" &&
    payload.kind === "ambient" &&
    (getShellMusicWantPlaying() || getShellVerseWantPlaying())
  ) {
    return;
  }
  if (shellMediaSessionUserDismissed) {
    const withinGrace = Date.now() - shellMediaSessionDismissedAt < SHELL_MEDIA_DISMISS_GRACE_MS;
    if (withinGrace || !payload.playing) {
      // 划掉后：忽略暂停态元数据，以及宽限期内仍为 playing 的刷新。
      return;
    }
    // 宽限后再次 playing → 用户在 App 内重新开播。
    shellMediaSessionUserDismissed = false;
  }
  // 进度由原生 timer 推进；JS 仅在标题/播放态/资源队列变化或进度跳变时推送，避免每 0.25s 刷会话。
  const pos = Number.isFinite(payload.positionSec) ? payload.positionSec : 0;
  const assetUri = payload.assetUri ?? null;
  const nextAssetUri = payload.nextAssetUri ?? null;
  const nextNextAssetUri = payload.nextNextAssetUri ?? null;
  const nextAssetUrisKey = Array.isArray(payload.nextAssetUris)
    ? payload.nextAssetUris.filter(Boolean).join("\n")
    : "";
  const gapSec = Number.isFinite(payload.gapSec) ? Number(payload.gapSec) : -1;
  const gapAssetUri = payload.gapAssetUri ?? null;
  const kind = payload.kind ?? null;
  const sameMeta =
    lastSentPlaying === payload.playing &&
    lastSentTitle === payload.title &&
    lastSentKind === kind &&
    lastSentAssetUri === assetUri &&
    lastSentNextAssetUri === nextAssetUri &&
    lastSentNextNextAssetUri === nextNextAssetUri &&
    lastSentNextAssetUrisKey === nextAssetUrisKey &&
    lastSentGapSec === gapSec &&
    lastSentGapAssetUri === gapAssetUri &&
    !lastSessionCleared;
  // iOS 原生接管后进度由原生心跳推进；JS 勿高频 updateSession（会重建/打断原生定时器）。
  // 金句/读经的 next* 补队列必须能通过：否则原生吃完预取后约 2 句就断播。
  // userPlay / userPause 必须送达：点播会先被壳层 sync 成同元数据、无 userPlay，
  // 若这里当重复丢掉，原生仍停在 userPaused，就会只亮黄标、不出声。
  const nativeOwnsMusic =
    Platform.OS === "ios" &&
    payload.kind === "music" &&
    payload.playing &&
    getShellMusicWantPlaying();
  const nativeOwnsVerse =
    (Platform.OS === "ios" || Platform.OS === "android") &&
    payload.kind === "verse" &&
    payload.playing &&
    getShellVerseWantPlaying();
  if (
    !payload.userPlay &&
    !payload.userPause &&
    sameMeta &&
    (nativeOwnsMusic || nativeOwnsVerse || Math.abs(pos - lastSentPositionSec) < 2.5)
  ) {
    return;
  }
  const payloadKey = JSON.stringify(payload);
  // 同一曲再点播时 JSON 可能完全相同；userPlay 仍必须再送一次，否则原生停在 userPaused。
  if (
    payloadKey === lastSessionPayloadKey &&
    !lastSessionCleared &&
    !payload.userPlay &&
    !payload.userPause
  ) {
    return;
  }
  lastSessionPayloadKey = payloadKey;
  lastSessionCleared = false;
  lastSentPlaying = payload.playing;
  lastSentTitle = payload.title;
  lastSentPositionSec = pos;
  lastSentKind = kind;
  lastSentAssetUri = assetUri;
  lastSentNextAssetUri = nextAssetUri;
  lastSentNextNextAssetUri = nextNextAssetUri;
  lastSentNextAssetUrisKey = nextAssetUrisKey;
  lastSentGapSec = gapSec;
  lastSentGapAssetUri = gapAssetUri;
  invokeNativeVoid(() => mod.updateSession?.(payloadKey));
}

/** 用户关闭系统媒体控件：清会话，并抑制自动再弹出。 */
export function markShellMediaSessionUserDismissed(): void {
  shellMediaSessionUserDismissed = true;
  shellMediaSessionDismissedAt = Date.now();
  lastSessionPayloadKey = null;
  if (!lastSessionCleared) {
    lastSessionCleared = true;
    lastSentPlaying = null;
    lastSentTitle = null;
    lastSentPositionSec = -1;
    lastSentKind = null;
    lastSentAssetUri = null;
    lastSentNextAssetUri = null;
    lastSentNextNextAssetUri = null;
    lastSentNextAssetUrisKey = "";
    lastSentGapSec = -1;
    lastSentGapAssetUri = null;
    const mod = getNativeModule();
    try {
      const clear = mod?.clearSession?.bind(mod);
      if (clear) {
        const result = (clear as (reason?: string) => void | Promise<void>)("user-dismissed");
        if (result && typeof (result as Promise<void>).then === "function") {
          void (result as Promise<void>).catch(() => {});
        }
      }
    } catch {
      /* ignore */
    }
  }
}

/** 用户在 App 内再次开播时解除抑制。 */
export function clearShellMediaSessionUserDismissed(): void {
  shellMediaSessionUserDismissed = false;
  shellMediaSessionDismissedAt = 0;
}

/** 音乐专辑基准音量写入原生主轨（如睡眠专辑 0.3）。原生 duck 会在此之上再压。 */
export function setShellMusicVolume(volume: number): void {
  const next = Math.max(0, Math.min(1, Number(volume)));
  if (!Number.isFinite(next)) return;
  const call = (mod: ShellMediaControlsNativeModule | null | undefined) => {
    if (typeof mod?.setMusicVolume !== "function") return false;
    invokeNativeVoid(() => mod.setMusicVolume?.(next));
    return true;
  };
  if (call(getNativeModule())) return;
  for (const moduleName of MODULE_NAMES) {
    if (call(NativeModules[moduleName] as ShellMediaControlsNativeModule | undefined)) return;
  }
}

const SLEEP_TIMER_FIRED_EVENT = "ShellMediaSleepTimerFired";

/** 睡眠定时墙钟：锁屏后由原生一次性触发。传 null/0 取消。 */
export function setShellSleepTimerDeadline(deadlineMs: number | null): void {
  const ms =
    deadlineMs != null && Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : 0;
  const call = (mod: ShellMediaControlsNativeModule | null | undefined) => {
    if (typeof mod?.setSleepTimerDeadlineMs !== "function") return false;
    invokeNativeVoid(() => mod.setSleepTimerDeadlineMs?.(ms));
    return true;
  };
  if (call(getNativeModule())) return;
  for (const moduleName of MODULE_NAMES) {
    if (call(NativeModules[moduleName] as ShellMediaControlsNativeModule | undefined)) return;
  }
}

export function subscribeShellSleepTimerFired(onFire: () => void): () => void {
  if (Platform.OS === "android") {
    const sub = DeviceEventEmitter.addListener(SLEEP_TIMER_FIRED_EVENT, onFire);
    return () => sub.remove();
  }
  if (Platform.OS !== "ios") return () => {};

  let mod: ShellMediaControlsNativeModule | undefined;
  for (const moduleName of MODULE_NAMES) {
    mod = (globalThis as ExpoHostGlobal).expo?.modules?.[moduleName];
    if (mod) break;
  }
  if (mod) {
    const emitter = new EventEmitter(mod as never) as {
      addListener: (eventName: string, handler: () => void) => RemoteSubscription;
    };
    const sub = emitter.addListener(SLEEP_TIMER_FIRED_EVENT, onFire);
    return () => sub.remove();
  }
  const sub = DeviceEventEmitter.addListener(SLEEP_TIMER_FIRED_EVENT, onFire);
  return () => sub.remove();
}

/** 用户点暂停时立刻停原生主轨（勿只改 UI）。 */
export function pauseShellAppMusic(): void {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const mod = getNativeModule();
  try {
    const pause = mod?.pauseAppMusic?.bind(mod);
    if (!pause) return;
    const result = pause();
    if (result && typeof (result as Promise<void>).then === "function") {
      void (result as Promise<void>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/** 用户点播放时显式恢复原生主轨（带 userPlay）。 */
export function resumeShellAppMusic(): void {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const mod = getNativeModule();
  try {
    const resume = mod?.resumeAppMusic?.bind(mod);
    if (!resume) return;
    const result = resume();
    if (result && typeof (result as Promise<void>).then === "function") {
      void (result as Promise<void>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

function subscribeExpoRemoteEvents(handlers: {
  onPlay: () => void;
  onPause: (payload?: unknown) => void;
  onToggle: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onStop?: () => void;
  onReadingToggle?: () => void;
  onMusicToggle?: () => void;
  onVerseToggle?: (verseKey?: string) => void;
}): (() => void) | null {
  let mod: ShellMediaControlsNativeModule | undefined;
  for (const moduleName of MODULE_NAMES) {
    mod = (globalThis as ExpoHostGlobal).expo?.modules?.[moduleName];
    if (mod) break;
  }
  if (!mod) return null;

  const emitter = new EventEmitter(mod as never) as {
    addListener: (eventName: string, handler: (payload?: unknown) => void) => RemoteSubscription;
  };
  const subs: RemoteSubscription[] = [
    emitter.addListener("RemotePlay", handlers.onPlay),
    emitter.addListener("RemotePause", handlers.onPause),
    emitter.addListener("RemoteToggle", handlers.onToggle),
    emitter.addListener("AudioSessionInterruptionBegan", () => {
      DeviceEventEmitter.emit("AudioSessionInterruptionBegan");
    }),
    emitter.addListener("AudioSessionInterruptionEnded", () => {
      DeviceEventEmitter.emit("AudioSessionInterruptionEnded");
    }),
    emitter.addListener("ShellMediaPlaybackPulse", () => {
      DeviceEventEmitter.emit("ShellMediaPlaybackPulse");
    }),
    emitter.addListener("ShellMediaNativeTakeover", (payload) => {
      DeviceEventEmitter.emit("ShellMediaNativeTakeover", payload);
    }),
    emitter.addListener("ShellMediaNativeRelease", (payload) => {
      DeviceEventEmitter.emit("ShellMediaNativeRelease", payload);
    }),
    emitter.addListener("ShellMediaNativeStopped", (payload) => {
      DeviceEventEmitter.emit("ShellMediaNativeStopped", payload);
    }),
    emitter.addListener("ShellMediaNativeProgress", (payload) => {
      DeviceEventEmitter.emit("ShellMediaNativeProgress", payload);
    }),
    emitter.addListener("ShellMediaNativeVerseAdvance", (payload) => {
      DeviceEventEmitter.emit("ShellMediaNativeVerseAdvance", payload);
    }),
    emitter.addListener("ShellMediaNativeVerseRestart", (payload) => {
      DeviceEventEmitter.emit("ShellMediaNativeVerseRestart", payload);
    }),
    emitter.addListener("ShellMediaNativeScriptureEnded", (payload) => {
      DeviceEventEmitter.emit("ShellMediaNativeScriptureEnded", payload);
    }),
    emitter.addListener("ShellMediaNativeMusicEnded", (payload) => {
      DeviceEventEmitter.emit("ShellMediaNativeMusicEnded", payload);
    }),
  ];
  if (handlers.onNext) {
    subs.push(emitter.addListener("RemoteNext", handlers.onNext));
  }
  if (handlers.onPrevious) {
    subs.push(emitter.addListener("RemotePrevious", handlers.onPrevious));
  }
  if (handlers.onStop) {
    subs.push(emitter.addListener("RemoteStop", handlers.onStop));
  }
  if (handlers.onReadingToggle) {
    subs.push(emitter.addListener("RemoteReadingToggle", handlers.onReadingToggle));
  }
  if (handlers.onMusicToggle) {
    subs.push(emitter.addListener("RemoteMusicToggle", handlers.onMusicToggle));
  }
  if (handlers.onVerseToggle) {
    const onVerse = handlers.onVerseToggle;
    subs.push(
      emitter.addListener("RemoteVerseToggle", (payload) => {
        onVerse(typeof payload === "string" ? payload : undefined);
      }),
    );
  }
  return () => {
    for (const sub of subs) sub.remove();
  };
}

function subscribeDeviceRemoteEvents(handlers: {
  onPlay: () => void;
  onPause: (payload?: unknown) => void;
  onToggle: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onStop?: () => void;
  onReadingToggle?: () => void;
  onMusicToggle?: () => void;
  onVerseToggle?: (verseKey?: string) => void;
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
  if (handlers.onStop) {
    subs.push(DeviceEventEmitter.addListener("RemoteStop", handlers.onStop));
  }
  if (handlers.onReadingToggle) {
    subs.push(DeviceEventEmitter.addListener("RemoteReadingToggle", handlers.onReadingToggle));
  }
  if (handlers.onMusicToggle) {
    subs.push(DeviceEventEmitter.addListener("RemoteMusicToggle", handlers.onMusicToggle));
  }
  if (handlers.onVerseToggle) {
    const onVerse = handlers.onVerseToggle;
    subs.push(
      DeviceEventEmitter.addListener("RemoteVerseToggle", (payload) => {
        onVerse(typeof payload === "string" ? payload : undefined);
      }),
    );
  }
  return () => {
    for (const sub of subs) sub.remove();
  };
}

export function subscribeShellMediaRemoteCommands(handlers: {
  onPlay: () => void;
  onPause: (payload?: unknown) => void;
  onToggle: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  /** 用户划掉 / 关闭系统媒体控件。 */
  onStop?: () => void;
  /** 桌面挂件「读经」键：只作用于本日读经音频。 */
  onReadingToggle?: () => void;
  /** 桌面挂件「音乐」键：只作用于音乐播放器。 */
  onMusicToggle?: () => void;
  /** 桌面挂件「喇叭」键：播放挂件当前经文。 */
  onVerseToggle?: (verseKey?: string) => void;
}): () => void {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return () => {};
  installShellAudioInterruptionBridge();

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
  clearShellMediaSessionUserDismissed();
  // 点播必须送达：清去重，避免与壳层 sync 撞上同一 JSON。
  lastSessionPayloadKey = null;
  lastSessionCleared = false;
  syncShellMediaSession(payload);
}

/** 读经已由原生接管：改语速须写回当前播放器。 */
export function syncShellMediaPlaybackRate(rate: number): void {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const normalized = Number.isFinite(rate) ? Math.max(0.5, Math.min(2, rate)) : 1;
  const mod = getNativeModule();
  if (typeof mod?.setPlaybackRate === "function") {
    invokeNativeVoid(() => mod.setPlaybackRate?.(normalized));
    return;
  }
  if (lastSentKind !== "scripture" || lastSentPlaying !== true || !lastSentAssetUri) return;
  lastSessionPayloadKey = null;
  syncShellMediaSession({
    title: lastSentTitle ?? "",
    artist: "AskBible.me",
    assetUri: lastSentAssetUri,
    durationSec: 0,
    positionSec: lastSentPositionSec > 0 ? lastSentPositionSec : 0,
    playing: true,
    kind: "scripture",
    rate: normalized,
    nextAssetUri: lastSentNextAssetUri,
    nextNextAssetUri: lastSentNextNextAssetUri,
  });
}

/** 读经/音乐主轨跳转。同曲 updateSession 会忽略新位置，必须走独立 seek。 */
export function seekShellMediaPosition(positionSec: number): boolean {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  if (!Number.isFinite(positionSec) || positionSec < 0) return false;
  const mod = getNativeModule();
  if (typeof mod?.seekTo !== "function") return false;
  invokeNativeVoid(() => mod.seekTo?.(positionSec));
  lastSentPositionSec = positionSec;
  return true;
}
