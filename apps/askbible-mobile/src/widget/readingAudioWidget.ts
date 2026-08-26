import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * 桌面每日经文小挂件上「音乐 / 喇叭(经文) / 读经」三个播放按钮的显示快照。
 */
export type PlaybackWidgetSnapshot = {
  scripturePlaying: boolean;
  scriptureHasContent: boolean;
  /** App 被杀后点读经键：打开并自动续播上次读经（含 ?autoplay=1）。 */
  scriptureDeepLink: string;
  musicPlaying: boolean;
  musicHasContent: boolean;
  /** App 被杀后点音乐键：打开 App（音乐无章节深链）。 */
  musicDeepLink: string;
  /** 挂件当前经文（金句）是否正在播。 */
  versePlaying: boolean;
};

export const PLAYBACK_WIDGET_SNAPSHOT_KEY = "askbible-reading-audio-widget-v1";

type WidgetPrefsNativeModule = {
  setReadingAudioSnapshot?: (json: string) => void;
  minimizeAfterWidgetPlayback?: () => void;
};

type MinimizeNativeModule = {
  minimizeAppToBackground?: () => void;
};

const IOS_SHELL_MEDIA_MODULE_NAMES = [
  "AskBibleShellMediaControls",
  "AskbibleShellMediaControls",
] as const;

type ExpoHostGlobal = typeof globalThis & {
  expo?: { modules?: Record<string, MinimizeNativeModule | undefined> };
};

function getAndroidWidgetPrefs(): WidgetPrefsNativeModule | undefined {
  if (Platform.OS !== "android") return undefined;
  return NativeModules.AskBibleWidgetPrefs as WidgetPrefsNativeModule | undefined;
}

function callIosMinimize(): boolean {
  let called = false;
  for (const moduleName of IOS_SHELL_MEDIA_MODULE_NAMES) {
    const fromHost = (globalThis as ExpoHostGlobal).expo?.modules?.[moduleName];
    if (typeof fromHost?.minimizeAppToBackground === "function") {
      fromHost.minimizeAppToBackground();
      called = true;
    }
    try {
      const fromExpo = requireOptionalNativeModule<MinimizeNativeModule>(moduleName);
      if (typeof fromExpo?.minimizeAppToBackground === "function") {
        fromExpo.minimizeAppToBackground();
        called = true;
      }
    } catch {
      /* optional */
    }
    try {
      const fromTurbo = TurboModuleRegistry.get(moduleName) as MinimizeNativeModule | null;
      if (typeof fromTurbo?.minimizeAppToBackground === "function") {
        fromTurbo.minimizeAppToBackground();
        called = true;
      }
    } catch {
      /* optional */
    }
    const legacy = NativeModules[moduleName] as MinimizeNativeModule | undefined;
    if (typeof legacy?.minimizeAppToBackground === "function") {
      legacy.minimizeAppToBackground();
      called = true;
    }
  }
  return called;
}

let lastIosPlaybackVisualKey: string | null = null;
let iosPlaybackReloadTimer: ReturnType<typeof setTimeout> | null = null;

function playbackVisualKey(snapshot: PlaybackWidgetSnapshot): string {
  return [
    snapshot.musicPlaying ? "1" : "0",
    snapshot.versePlaying ? "1" : "0",
    snapshot.scripturePlaying ? "1" : "0",
  ].join("");
}

async function writeIosPlaybackSnapshot(snapshot: PlaybackWidgetSnapshot): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const { ExtensionStorage } = await import("@bacons/apple-targets");
    const storage = new ExtensionStorage("group.me.askbible.shared");
    storage.set(PLAYBACK_WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
    // 图标色才需要 reload；每次开播都 reloadAll 会让整张挂件抖一下。
    const visualKey = playbackVisualKey(snapshot);
    if (visualKey === lastIosPlaybackVisualKey) return;
    const prev = lastIosPlaybackVisualKey;
    lastIosPlaybackVisualKey = visualKey;
    // 冷启动写入「全未播」：只写盘，不刷新挂件（避免点挂件拉起 App 时整卡抖）。
    if (prev === null && visualKey === "000") return;
    if (iosPlaybackReloadTimer) clearTimeout(iosPlaybackReloadTimer);
    iosPlaybackReloadTimer = setTimeout(() => {
      iosPlaybackReloadTimer = null;
      try {
        ExtensionStorage.reloadWidget();
      } catch {
        /* ignore */
      }
    }, 450);
  } catch {
    /* widget target may be absent in some builds */
  }
}

/**
 * 写入播放挂件快照。传 null 不做任何事（保留上次持久化状态，
 * 避免启动初期误清空「上次收听」信息）。
 */
export function syncPlaybackWidget(snapshot: PlaybackWidgetSnapshot | null): void {
  if (!snapshot) return;
  if (Platform.OS === "android") {
    const mod = getAndroidWidgetPrefs();
    if (!mod?.setReadingAudioSnapshot) return;
    try {
      mod.setReadingAudioSnapshot(JSON.stringify(snapshot));
    } catch {
      /* native bridge unavailable */
    }
    return;
  }
  if (Platform.OS === "ios") {
    void writeIosPlaybackSnapshot(snapshot);
  }
}

/** 音乐已停但挂件仍黄：强制灭黄并 reload（保留其它键状态尽量只改 music）。 */
export function syncPlaybackWidgetForceIdleMusic(): void {
  const idle: PlaybackWidgetSnapshot = {
    scripturePlaying: false,
    scriptureHasContent: false,
    scriptureDeepLink: "",
    musicPlaying: false,
    musicHasContent: true,
    musicDeepLink: "askbible://",
    versePlaying: false,
  };
  // 允许冷启后立刻刷黄→灰。
  lastIosPlaybackVisualKey = "111";
  syncPlaybackWidget(idle);
}

/** 挂件开播后尽量回桌面（Android moveTaskToBack；iOS suspend）。 */
export function minimizeAfterWidgetPlayback(): void {
  if (Platform.OS === "android") {
    try {
      getAndroidWidgetPrefs()?.minimizeAfterWidgetPlayback?.();
    } catch {
      /* ignore */
    }
    return;
  }
  if (Platform.OS === "ios") {
    try {
      callIosMinimize();
    } catch {
      /* ignore */
    }
  }
}
