import { NativeModules, Platform } from "react-native";

/**
 * 桌面每日经文小挂件上「音乐 / 读经」两个播放按钮的显示快照（仅 Android）。
 * 两路状态独立：读经与音乐各有自己的「是否有内容 / 是否正在播 / 冷启动深链」。
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
};

type WidgetPrefsNativeModule = {
  setReadingAudioSnapshot?: (json: string) => void;
};

function getNativeModule(): WidgetPrefsNativeModule | undefined {
  if (Platform.OS !== "android") return undefined;
  return NativeModules.AskBibleWidgetPrefs as WidgetPrefsNativeModule | undefined;
}

/**
 * 写入播放挂件快照。传 null 不做任何事（保留上次持久化状态，
 * 避免启动初期误清空「上次收听」信息）。
 */
export function syncPlaybackWidget(snapshot: PlaybackWidgetSnapshot | null): void {
  if (!snapshot) return;
  const mod = getNativeModule();
  if (!mod?.setReadingAudioSnapshot) return;
  try {
    mod.setReadingAudioSnapshot(JSON.stringify(snapshot));
  } catch {
    /* native bridge unavailable */
  }
}
