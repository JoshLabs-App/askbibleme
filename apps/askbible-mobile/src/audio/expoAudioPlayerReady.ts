import type { AudioPlayer, AudioStatus } from "expo-audio";

/**
 * expo-audio 的 createAudioPlayer 是同步创建、原生侧异步加载；expo-av 时代 createAsync
 * 是 await 到「已加载」才返回，加载失败会 reject。这里补一个等价的等待点：监听首次
 * isLoaded=true 的 playbackStatusUpdate；超时仍未加载视为加载失败并 reject（保持旧
 * 调用方 try/catch 里「加载失败→回退/重置播放状态」的路径可达，不能静默 resolve）。
 */
export function waitForAudioPlayerLoaded(
  player: AudioPlayer,
  timeoutMs = 8000,
): Promise<AudioStatus> {
  if (player.isLoaded) {
    return Promise.resolve(player.currentStatus);
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      sub.remove();
      if (player.isLoaded) {
        resolve(player.currentStatus);
      } else {
        reject(new Error(`waitForAudioPlayerLoaded timed out after ${timeoutMs}ms`));
      }
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
