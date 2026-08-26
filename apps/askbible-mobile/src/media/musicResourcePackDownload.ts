import * as FileSystem from "expo-file-system/legacy";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import type { MusicPackAsset, MusicPackManifest } from "./musicResourcePackState";
import {
  ensureMusicPackParentDir,
  isValidMusicPackManifest,
  localMusicPackUriForPath,
  normalizeMusicAssetPath,
} from "./musicResourcePackState";

export async function fetchMusicPackManifest(): Promise<MusicPackManifest | null> {
  if (isMobileBundledOnly()) return null;
  if (!(await isNetworkAvailable())) return null;
  const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
  const manifestUrl = `${baseUrl}/api/mobile/resource-pack/music/manifest`;
  const res = await fetchWithTimeout(manifestUrl, {
    headers: { Accept: "application/json" },
    timeoutMs: 8000,
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json();
  if (!isValidMusicPackManifest(raw)) return null;
  return raw;
}

export async function downloadMusicPackAsset(
  baseUrl: string,
  asset: MusicPackAsset,
  onUnitProgress?: (percent: number) => void,
): Promise<string | null> {
  const pathNorm = normalizeMusicAssetPath(asset.path);
  if (!pathNorm.startsWith("/music/") || pathNorm.includes("..")) return null;

  const target = localMusicPackUriForPath(pathNorm);
  const existing = await FileSystem.getInfoAsync(target, { md5: true });
  if (existing.exists && existing.size === asset.size && existing.md5 === asset.md5) {
    onUnitProgress?.(100);
    return target;
  }

  const remote = toAbsoluteUrl(baseUrl, pathNorm);
  if (!remote) return null;

  await ensureMusicPackParentDir(target);
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    /* ignore */
  }

  if (onUnitProgress) {
    const resumable = FileSystem.createDownloadResumable(remote, target, {}, (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      const pct =
        total > 0 ? Math.min(100, Math.floor((progress.totalBytesWritten / total) * 100)) : 0;
      onUnitProgress(pct);
    });
    const result = await resumable.downloadAsync();
    if (!result?.uri || result.status !== 200) return null;
    const verified = await FileSystem.getInfoAsync(target, { md5: true });
    if (!verified.exists || verified.size !== asset.size || verified.md5 !== asset.md5) return null;
    onUnitProgress(100);
    return target;
  }

  const result = await FileSystem.downloadAsync(remote, target, { md5: true });
  if (!result?.uri) return null;
  if (result.status !== 200) return null;
  if (result.md5 !== asset.md5) return null;
  return result.uri;
}

export async function downloadMusicAssetDirect(
  baseUrl: string,
  assetPath: string,
  onUnitProgress?: (percent: number) => void,
): Promise<string | null> {
  const pathNorm = normalizeMusicAssetPath(assetPath);
  if (!pathNorm.startsWith("/music/") || pathNorm.includes("..")) return null;
  const remote = toAbsoluteUrl(baseUrl, pathNorm);
  if (!remote) return null;
  const target = localMusicPackUriForPath(pathNorm);
  await ensureMusicPackParentDir(target);
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    /* ignore */
  }
  if (onUnitProgress) {
    const resumable = FileSystem.createDownloadResumable(remote, target, {}, (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      const pct =
        total > 0 ? Math.min(100, Math.floor((progress.totalBytesWritten / total) * 100)) : 0;
      onUnitProgress(pct);
    });
    const result = await resumable.downloadAsync();
    if (!result?.uri || result.status !== 200) return null;
    onUnitProgress(100);
    return target;
  }
  const result = await FileSystem.downloadAsync(remote, target);
  if (!result?.uri || result.status !== 200) return null;
  return target;
}
