/**
 * D-47 统一内核 <-> 原生轻壳 5 组最小双向契约（Contract First）
 * 所有业务代码与原生桥接统一走此契约定义。
 */

export const LOCAL_DB_ROUTES = {
  chapter: "/local-db/chapter",
  search: "/local-db/search",
  translations: "/local-db/translations",
} as const;

export type PlatformKind = "ios" | "android" | "web";

/* -------------------------------------------------------------------------- */
/* 1. 本地经文库 (bible)                                                      */
/* -------------------------------------------------------------------------- */

export interface BibleVerse {
  verse: number;
  text: string;
  redLetter?: boolean;
  refCount?: number;
}

export interface BibleChapterPayload {
  translationId: string;
  bookId: string;
  chapter: number;
  verses: BibleVerse[];
  source: "sqlite" | "indexeddb" | "network" | "bundled";
}

export interface BibleSearchHit {
  translationId: string;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleTranslationInfo {
  id: string;
  name: string;
  shortName: string;
  language: "zh-Hans" | "zh-Hant" | "en" | "es";
  bundled?: boolean;
  downloaded?: boolean;
  sizeBytes?: number;
}

/* -------------------------------------------------------------------------- */
/* 2. 三路音频 (audio)                                                        */
/* -------------------------------------------------------------------------- */

export type AudioStreamKind = "music" | "scripture" | "verse";

export type AudioAction =
  | "play"
  | "pause"
  | "resume"
  | "stop"
  | "seek"
  | "next"
  | "prev"
  | "setQueue";

export interface AudioIntentRequest {
  stream: AudioStreamKind;
  action: AudioAction;
  payload?: {
    trackId?: string;
    albumId?: string;
    title?: string;
    url?: string;
    bookId?: string;
    chapter?: number;
    verse?: number;
    translationId?: string;
    positionSec?: number;
  };
  origin?: string;
}

export interface AudioStreamState {
  wantPlaying: boolean;
  isPlaying: boolean;
  title: string;
  subtitle?: string;
  url?: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  positionSec: number;
  durationSec: number;
}

export interface AudioStateSnapshot {
  audibleStreams: AudioStreamKind[];
  music: AudioStreamState;
  scripture: AudioStreamState;
  verse: AudioStreamState;
  updatedAt: number;
}

/* -------------------------------------------------------------------------- */
/* 3. 导航壳联动 (shell)                                                      */
/* -------------------------------------------------------------------------- */

export type ShellTabId = "home" | "panorama" | "plan" | "read" | "explore";

export type ThemeMode = "light" | "dark" | "system";

export type HapticStyle = "light" | "medium" | "success";

/* -------------------------------------------------------------------------- */
/* 4. 离线包与热更 (pack)                                                     */
/* -------------------------------------------------------------------------- */

export interface PackStatus {
  bundleId: string;
  builtAt: string;
  pendingBundleId?: string | null;
  readyToSwap: boolean;
  platform: PlatformKind;
  downloadedTranslations: string[];
  lastCheckedAt?: string | null;
}

export interface PackReadyToSwapPayload {
  bundleId: string;
}

/* -------------------------------------------------------------------------- */
/* 5. 账号与系统 (auth / sys)                                                 */
/* -------------------------------------------------------------------------- */

export type AuthProvider = "apple" | "google" | "email";

export interface AuthSession {
  signedIn: boolean;
  userId?: string;
  email?: string;
  displayName?: string;
  provider?: AuthProvider;
}

export interface ReminderConfig {
  enabled: boolean;
  hour: number;
  minute: number;
}

/* -------------------------------------------------------------------------- */
/* 统一双向 Method & Event 映射                                               */
/* -------------------------------------------------------------------------- */

export interface AskBibleBridgeMethodMap {
  "audio.intent": {
    args: AudioIntentRequest;
    result: AudioStateSnapshot;
  };
  "shell.setTab": {
    args: { tab: ShellTabId; route?: string };
    result: { ok: boolean };
  };
  "shell.setTheme": {
    args: { mode: ThemeMode };
    result: { ok: boolean; resolved: "light" | "dark" };
  };
  "shell.haptic": {
    args: { style: HapticStyle };
    result: { ok: boolean };
  };
  "pack.status": {
    args: undefined;
    result: PackStatus;
  };
  "pack.checkNow": {
    args: undefined;
    result: { hasUpdate: boolean; bundleId: string; pendingBundleId?: string | null };
  };
  "pack.downloadTranslation": {
    args: { id: string };
    result: { ok: boolean; id: string; cachedCount?: number };
  };
  "pack.commitSwap": {
    args: { bundleId?: string } | undefined;
    result: { ok: boolean };
  };
  "auth.signIn": {
    args: { provider: AuthProvider; email?: string };
    result: AuthSession;
  };
  "auth.getSession": {
    args: undefined;
    result: AuthSession;
  };
  "auth.signOut": {
    args: undefined;
    result: { ok: boolean };
  };
  "sys.setReminder": {
    args: ReminderConfig;
    result: { ok: boolean; enabled: boolean; hour: number; minute: number };
  };
  "sys.syncWidget": {
    args: { verse: { ref: string; text: string; bookId: string; chapter: number } };
    result: { ok: boolean };
  };
  "sys.shareImage": {
    args: { dataUrl?: string; text: string };
    result: { ok: boolean; method: "native" | "web-share" | "clipboard" };
  };
}

export type BridgeMethodName = keyof AskBibleBridgeMethodMap;

export interface AskBibleBridgeEventMap {
  "audio.state": AudioStateSnapshot;
  "shell.tabSelected": { tab: ShellTabId; route?: string };
  "shell.backPressed": { timestamp?: number };
  "pack.readyToSwap": PackReadyToSwapPayload;
}

export type BridgeEventName = keyof AskBibleBridgeEventMap;

export interface AskBibleBridge {
  call<M extends BridgeMethodName>(
    method: M,
    ...args: AskBibleBridgeMethodMap[M]["args"] extends undefined
      ? [args?: AskBibleBridgeMethodMap[M]["args"]]
      : [args: AskBibleBridgeMethodMap[M]["args"]]
  ): Promise<AskBibleBridgeMethodMap[M]["result"]>;
}

declare global {
  interface Window {
    AskBibleBridge?: AskBibleBridge & { platform?: PlatformKind };
    AskBibleNative?: {
      call(method: string, argsJson: string): Promise<string> | string;
    };
    webkit?: {
      messageHandlers?: {
        askbible?: {
          postMessage(payload: { id: string; method: string; args: unknown }): void;
        };
      };
    };
    __askbibleEmit?: <E extends BridgeEventName>(
      event: E,
      payload: AskBibleBridgeEventMap[E],
    ) => void;
    __askbibleResolve?: (id: string, ok: boolean, dataOrError: unknown) => void;
  }
}
