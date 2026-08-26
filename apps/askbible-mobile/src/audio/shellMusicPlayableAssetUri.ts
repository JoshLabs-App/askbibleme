/** 最近一次可被 iOS AVAudioPlayer 打开的本地 file URI（避免 Asset.uri 与 warm 路径抖动）。 */
let shellMusicPlayableAssetUri: string | null = null;

export function getShellMusicPlayableAssetUri(): string | null {
  return shellMusicPlayableAssetUri;
}

export function setShellMusicPlayableAssetUri(uri: string | null): void {
  const next = (uri ?? "").trim();
  // 拒绝环境音 / 金句 gap 等非音乐路径写入（warmBundledModuleUri 曾误写）。
  if (next && !isPlausibleShellMusicAssetUri(next)) {
    return;
  }
  shellMusicPlayableAssetUri = next || null;
}

/** 音乐会话 URI：必须像曲目文件，不能是场景环境音或金句间隔静音。 */
export function isPlausibleShellMusicAssetUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  if (!u) return false;
  if (
    u.includes("/scenes/") ||
    u.includes("scene-") ||
    u.includes("verse-gap") ||
    u.includes("golden-verse") ||
    u.includes("read-chapter-audio") ||
    u.includes("background-silence")
  ) {
    return false;
  }
  return true;
}

/** iOS 原生 AVPlayer：只要本地 file，拒绝 Metro http（会 skip / 空转无声）。 */
export function isIosNativeLocalMusicUri(uri: string): boolean {
  const u = uri.trim();
  if (!u) return false;
  if (/^https?:\/\//i.test(u)) return false;
  return isPlausibleShellMusicAssetUri(u);
}

/**
 * iOS 音乐会话可播 URI：本地 file，或 TEMP HTTPS（R2 / Hymn Commons）。
 * 仍拒绝 Metro `http://`（空转无声）。
 */
export function isIosNativePlayableMusicUri(uri: string): boolean {
  const u = uri.trim();
  if (!u || !isPlausibleShellMusicAssetUri(u)) return false;
  if (/^http:\/\//i.test(u)) return false;
  return true;
}

/** 标准化本地 path，便于会话 payload 稳定。 */
export function normalizeShellMusicFileUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return "";
  let path = trimmed;
  if (trimmed.startsWith("file://")) {
    try {
      path = decodeURIComponent(trimmed.replace(/^file:\/\//i, ""));
    } catch {
      path = trimmed.replace(/^file:\/\//i, "");
    }
  }
  if (path.startsWith("/private/")) {
    path = path.slice("/private".length);
  }
  return path.startsWith("/") ? `file://${path}` : trimmed;
}
