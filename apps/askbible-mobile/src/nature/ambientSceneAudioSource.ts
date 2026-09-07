import { createRemoteMediaCache } from "../media/remoteMediaCache";
import type { NatureAmbientSceneSlotId } from "./ambientSceneSlots";

/**
 * 自然场景音效（白噪音/雨声/篝火…）2026-09 起不再打进安装包（原先 9 条 17M 常驻体积），
 * 改为 R2 点播 + 首次播放边播边缓存到本机；上传：
 * `npx wrangler r2 object put askbible-media/audio/scenes/{file} --file=assets/audio/scenes/{file} --remote`
 */
const R2_PUBLIC_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";

const AMBIENT_SCENE_AUDIO_FILES: Record<NatureAmbientSceneSlotId, string> = {
  "scene-fire": "scene-campfire-forest-452486.mp3",
  "scene-water": "scene-water-lake-120.mp3",
  "scene-rain": "scene-rain-drops-roof-ofs.mp3",
  "scene-waves": "scene-waves-ocean.mp3",
  "scene-thunder": "scene-thunderstorm-28.mp3",
  "scene-birds": "scene-birds-forest-810419.mp3",
  "scene-wind": "scene-wind-hum-1177.mp3",
  "scene-white-noise": "scene-white-noise-41.mp3",
  "scene-cafe": "scene-cafe-120.mp3",
};

const cache = createRemoteMediaCache({
  cacheDirName: "ambient-scene-r2-cache",
  maxBytes: 60 * 1024 * 1024, // 9 条循环全存下也就 17M；60M 给足余量,不用频繁淘汰。
  extensions: [".mp3"],
});

export function isAmbientSceneSlotAvailable(id: string): id is NatureAmbientSceneSlotId {
  return Object.prototype.hasOwnProperty.call(AMBIENT_SCENE_AUDIO_FILES, id);
}

function remoteUrlFor(id: NatureAmbientSceneSlotId): string {
  return `${R2_PUBLIC_BASE}/audio/scenes/${AMBIENT_SCENE_AUDIO_FILES[id]}`;
}

/** 同步 peek：本次进程里已经缓存命中过，直接给本地文件；否则先给远端直链即时播放。 */
export function peekAmbientSceneAudioSrc(id: NatureAmbientSceneSlotId): string {
  return cache.peekCachedUri(AMBIENT_SCENE_AUDIO_FILES[id]) ?? remoteUrlFor(id);
}

/** 后台把当前场景下到本机；下次选它直接吃本地缓存，不用再等网络。 */
export function warmAmbientSceneAudioCache(id: NatureAmbientSceneSlotId): void {
  const key = AMBIENT_SCENE_AUDIO_FILES[id];
  if (!key || cache.peekCachedUri(key)) return;
  void cache.downloadToCache(key, remoteUrlFor(id));
}

export function markAmbientSceneAudioActiveUri(uri: string | null | undefined): void {
  cache.markActiveUri(uri);
}
