import type { AudioPlayer, AudioStatus } from "expo-audio";

/**
 * expo-audio 的 createAudioPlayer 是同步创建、原生侧异步加载；expo-av 时代 createAsync
 * 是 await 到「已加载」才返回。这里补一个等价的等待点：监听首次 isLoaded=true 的
 * playbackStatusUpdate，超时兜底返回当时的 currentStatus（不 reject，保持旧调用方
 * "await 完再看 status.isLoaded" 的写法不用大改）。
 */
export function waitForAudioPlayerLoaded(
  player: AudioPlayer,
  timeoutMs = 8000,
): Promise<AudioStatus> {
  if (player.isLoaded) {
    return Promise.resolve(player.currentStatus);
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      sub.remove();
      resolve(player.currentStatus);
    }, timeoutMs);
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (settled || !status.isLoaded) return;
      settled = true;
      clearTimeout(timer);
      sub.remove();
      resolve(status);
    });
  });
}
