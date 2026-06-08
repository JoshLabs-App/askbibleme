/** 首页自然场景单层播放源（APK 内优先 require，否则 URI） */
export type NatureCoverPlayback = {
  sceneId: string;
  uri: string;
  /** `require()` 模块 id；expo-av 直连包内 mp4，比 Asset.uri 更快 */
  bundledModule?: number;
};

export type ResolveNatureCoverPlayback = (sceneId: string) => NatureCoverPlayback | null;

export function natureCoverAvSource(playback: NatureCoverPlayback | null) {
  if (!playback) return null;
  if (playback.bundledModule != null) return playback.bundledModule;
  const uri = playback.uri.trim();
  return uri ? { uri } : null;
}

/** expo-video `useVideoPlayer` 源：`require()` 模块 id 或 URI 字符串 */
export function natureCoverVideoSource(playback: NatureCoverPlayback | null): string | number | null {
  if (!playback) return null;
  if (playback.bundledModule != null) return playback.bundledModule;
  const uri = playback.uri.trim();
  return uri || null;
}

export function isNatureCoverPlaybackPlayable(playback: NatureCoverPlayback | null): boolean {
  if (!playback) return false;
  return playback.bundledModule != null || playback.uri.trim().length > 0;
}
