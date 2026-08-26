/**
 * TEMPORARY STRATEGY（包体）：非专辑首曲默认 R2 HTTPS 点播，边播边缓存到本机。
 * 安装包只留每专辑第一首。恢复全量进包：`MOBILE_BUNDLE_MUSIC_FULL=1` 重新 sync。
 * 禁止回落到 askbible.me / Render 流量计费。
 *
 * 对象键与 companion `src` 对齐：`/music/uploads/….mp3` → `{base}/music/uploads/….mp3`
 */
const HARDCODED_R2_PUBLIC_BASE =
  "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";

export function isMusicAudioRemoteStreamEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_MUSIC_AUDIO_STREAM?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return true;
}

export function getMusicAudioRemoteBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_MUSIC_AUDIO_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const golden = process.env.EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL?.trim();
  if (golden) return golden.replace(/\/$/, "");
  return HARDCODED_R2_PUBLIC_BASE.replace(/\/$/, "");
}

/** TEMP：赞美诗专辑直链 Hymn Commons 钢琴 MP3（用户指定不经 R2）。 */
export function isHymnCommonsDirectAudioUrl(pathOrUrl: string): boolean {
  const raw = pathOrUrl.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host !== "hymncommons.org" && !host.endsWith(".hymncommons.org")) return false;
    return /\.mp3$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function hymnCommonsCacheKey(pathOrUrl: string): string | null {
  if (!isHymnCommonsDirectAudioUrl(pathOrUrl)) return null;
  try {
    const name = new URL(pathOrUrl.trim()).pathname.split("/").filter(Boolean).pop();
    if (!name || !/\.mp3$/i.test(name)) return null;
    return `music/hymncommons/${decodeURIComponent(name)}`;
  } catch {
    return null;
  }
}

/** companion `src` 或绝对 URL → `music/uploads/….mp3`；赞美诗直链 → `music/hymncommons/….mp3` */
export function normalizeMusicAudioObjectKey(pathOrUrl: string): string | null {
  const raw = pathOrUrl.trim();
  if (!raw) return null;
  const hymnKey = hymnCommonsCacheKey(raw);
  if (hymnKey) return hymnKey;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const path = u.pathname.replace(/^\/+/, "");
      if (path.startsWith("music/uploads/")) return path;
      const m = path.match(/(music\/uploads\/[^/?#]+)$/i);
      return m?.[1] ?? null;
    }
  } catch {
    /* fall through */
  }
  const cleaned = raw.replace(/^\/+/, "");
  if (cleaned.startsWith("music/uploads/")) return cleaned;
  const m = cleaned.match(/(music\/uploads\/[^/?#]+)$/i);
  return m?.[1] ?? null;
}

export function buildMusicAudioRemoteUrl(pathOrUrl: string): string | null {
  if (!isMusicAudioRemoteStreamEnabled()) return null;
  if (isHymnCommonsDirectAudioUrl(pathOrUrl)) return pathOrUrl.trim();
  const base = getMusicAudioRemoteBaseUrl();
  if (!base) return null;
  const key = normalizeMusicAudioObjectKey(pathOrUrl);
  if (!key) return null;
  return `${base}/${key}`;
}

/** 曲目清单 JSON，与 mp3 同桶；不经 askbible.me。 */
export function buildMusicCompanionCatalogUrl(): string | null {
  if (!isMusicAudioRemoteStreamEnabled()) return null;
  const base = getMusicAudioRemoteBaseUrl();
  if (!base) return null;
  return `${base}/music/companion.json`;
}
