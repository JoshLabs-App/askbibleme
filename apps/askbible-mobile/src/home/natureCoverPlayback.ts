import { Platform } from "react-native";

/** 首页自然场景单层播放源（APK 内优先 require，否则 URI） */
export type NatureCoverPlayback = {
  sceneId: string;
  uri: string;
  /** `require()` 模块 id；iOS 可用；Android release 优先 local file URI */
  bundledModule?: number;
};

export type ResolveNatureCoverPlayback = (sceneId: string) => NatureCoverPlayback | null;

export function natureCoverAvSource(playback: NatureCoverPlayback | null) {
  if (!playback) return null;
  if (playback.bundledModule != null) return playback.bundledModule;
  const uri = (playback.uri ?? "").trim();
  return uri ? { uri } : null;
}

/** expo-video `useVideoPlayer` 源：Android release 用 file URI；iOS 可用 require 模块 id */
export function natureCoverVideoSource(playback: NatureCoverPlayback | null): string | number | null {
  if (!playback) return null;
  const uri = (playback.uri ?? "").trim();
  if (Platform.OS === "android") {
    return uri || null;
  }
  if (playback.bundledModule != null) return playback.bundledModule;
  return uri || null;
}

export function isNatureCoverPlaybackPlayable(playback: NatureCoverPlayback | null): boolean {
  if (!playback) return false;
  return playback.bundledModule != null || (playback.uri ?? "").trim().length > 0;
}
