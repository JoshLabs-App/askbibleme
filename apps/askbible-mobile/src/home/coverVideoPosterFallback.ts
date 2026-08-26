/** 首页场景视频首帧等待上限；超时后改用静帧背景（老 Android 常见「状态 ready 但画面黑」） */
export const COVER_VIDEO_READY_TIMEOUT_MS = 4500;

let sessionPosterOnly = false;
const listeners = new Set<() => void>();

export function subscribeCoverVideoPosterOnly(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCoverVideoPosterOnly(): boolean {
  return sessionPosterOnly;
}

/** 本次启动内后续场景均改用静帧，避免每台老机每个场景都黑屏等待。 */
export function markCoverVideoSessionPosterOnly(): void {
  if (sessionPosterOnly) return;
  sessionPosterOnly = true;
  listeners.forEach((l) => l());
}

/** 用户重新打开直播视频时解除会话静帧锁，允许再试解码。 */
export function clearCoverVideoSessionPosterOnly(): void {
  if (!sessionPosterOnly) return;
  sessionPosterOnly = false;
  listeners.forEach((l) => l());
}

export function hasCoverVideoPosterAsset(posterModule?: number | null, posterUri?: string): boolean {
  return posterModule != null || Boolean(posterUri?.trim());
}
