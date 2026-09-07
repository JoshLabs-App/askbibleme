import { createRemoteMediaCache } from "./remoteMediaCache";

/**
 * 自然场景视频 2026-09 起只打第一个场景（约 1.5M）进安装包，其余 5 个（原共 9.7M）
 * 改为 R2 点播 + 首次播放边播边缓存到本机——原先「只有 `MOBILE_BUNDLE_OFFLINE_MEDIA=1`
 * 才打全量」的做法反过来了：默认只打首个，其余始终可播（不再是「不打包=不能看」）。
 * 上传：`npx wrangler r2 object put askbible-media/nature/videos/{id}.mp4 --file=... --remote`
 * 与 `natureResourcePackSync.ts`（走 askbible.me/Render，且默认被 MOBILE_BUNDLED_ONLY 关闭）
 * 无关——这条固定走 R2，不受那个开关影响，也不产生 Render 流量。
 */
const R2_PUBLIC_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";

const cache = createRemoteMediaCache({
  cacheDirName: "nature-video-r2-cache",
  maxBytes: 200 * 1024 * 1024, // 5 条 720p 全存下约 8M；给足空间避免频繁重下。
  extensions: [".mp4"],
});

function objectKey(videoId: string): string {
  return `${videoId}.mp4`;
}

function remoteUrlFor(videoId: string): string {
  return `${R2_PUBLIC_BASE}/nature/videos/${objectKey(videoId)}`;
}

/** 同步 peek：已缓存过给本地文件；否则给 R2 直链即时播放。 */
export function peekNatureVideoR2Src(videoId: string): string {
  const id = videoId.trim();
  if (!id) return "";
  return cache.peekCachedUri(objectKey(id)) ?? remoteUrlFor(id);
}

/** 后台把这个场景下到本机；下次切回同一场景直接吃本地缓存。 */
export function warmNatureVideoR2Cache(videoId: string): void {
  const id = videoId.trim();
  if (!id) return;
  const key = objectKey(id);
  if (cache.peekCachedUri(key)) return;
  void cache.downloadToCache(key, remoteUrlFor(id));
}

export function markNatureVideoR2ActiveUri(uri: string | null | undefined): void {
  cache.markActiveUri(uri);
}
