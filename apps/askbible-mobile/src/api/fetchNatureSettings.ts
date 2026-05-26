import type { NatureSettingsV2 } from "../types/nature";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { readSyncedNatureSettings } from "../media/natureResourcePackSync";

const bundledRaw = require("../../assets/content/nature-settings.json") as NatureSettingsV2;

function normalizeNatureSettings(raw: NatureSettingsV2): NatureSettingsV2 {
  return {
    version: raw.version ?? 2,
    videos: Array.isArray(raw.videos) ? raw.videos : [],
    ambientClips: Array.isArray(raw.ambientClips) ? raw.ambientClips : [],
    activeVideoId: String(raw.activeVideoId ?? "").trim(),
    playbackRate: typeof raw.playbackRate === "number" ? raw.playbackRate : 1,
    posterSrc: raw.posterSrc,
  };
}

const bundledSettings = normalizeNatureSettings(bundledRaw);

function mediaFingerprint(row: {
  src?: string;
  src1080?: string;
  src4k?: string;
  previewFrameSrc?: string;
}): string {
  const preferred =
    row.src4k?.trim() ||
    row.src1080?.trim() ||
    row.src?.trim() ||
    row.previewFrameSrc?.trim() ||
    "";
  if (!preferred) return "";
  const base = preferred.split("?")[0]?.split("#")[0] ?? preferred;
  const name = base.split("/").pop() ?? base;
  return name
    .replace(/\.master\.mp4$/i, "")
    .replace(/-(720|1080)\.mp4$/i, "")
    .replace(/\.(mp4|webm|mov|m4v|jpg|jpeg|png)$/i, "")
    .trim()
    .toLowerCase();
}

function pickBundledMatch(
  remoteRow: NatureSettingsV2["videos"][number],
  bundledById: Map<string, NatureSettingsV2["videos"][number]>,
  bundledByFingerprint: Map<string, NatureSettingsV2["videos"][number][]>,
  usedBundledIds: Set<string>,
): NatureSettingsV2["videos"][number] | null {
  const byId = bundledById.get(remoteRow.id);
  if (byId && !usedBundledIds.has(byId.id)) return byId;
  const fp = mediaFingerprint(remoteRow);
  if (!fp) return null;
  const bucket = bundledByFingerprint.get(fp) ?? [];
  return bucket.find((row) => !usedBundledIds.has(row.id)) ?? null;
}

function mergeBundledScenesByRemoteOrder(remote: NatureSettingsV2): NatureSettingsV2 {
  const bundledById = new Map(bundledSettings.videos.map((row) => [row.id, row]));
  const bundledByFingerprint = new Map<string, NatureSettingsV2["videos"][number][]>();
  for (const row of bundledSettings.videos) {
    const fp = mediaFingerprint(row);
    if (!fp) continue;
    const bucket = bundledByFingerprint.get(fp) ?? [];
    bucket.push(row);
    bundledByFingerprint.set(fp, bucket);
  }

  const usedBundledIds = new Set<string>();

  const mergedOrdered = remote.videos
    .map((row) => {
      const bundled = pickBundledMatch(
        row,
        bundledById,
        bundledByFingerprint,
        usedBundledIds,
      );
      if (!bundled) return null;
      usedBundledIds.add(bundled.id);
      return {
        ...bundled,
        ...row,
        // 保留 bundled id，确保本地资源解析与已存偏好稳定
        id: bundled.id,
        // bundled 包中保持本地可用的媒体路径；后台顺序/标题/分类等仍可覆盖
        src: bundled.src,
        src1080: bundled.src1080,
        src4k: bundled.src4k,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  // 只展示后台仍存在的场景；不要把已被后台删除的 bundled 尾项再补回前台。
  const videos = mergedOrdered;

  const remoteActiveRow = remote.videos.find((row) => row.id === remote.activeVideoId);
  const activeMappedBundledId =
    remoteActiveRow
      ? pickBundledMatch(
          remoteActiveRow,
          bundledById,
          bundledByFingerprint,
          new Set<string>(),
        )?.id ?? ""
      : "";

  const activeVideoId =
    (activeMappedBundledId && videos.some((v) => v.id === activeMappedBundledId)
      ? activeMappedBundledId
      : "") ||
    (bundledSettings.activeVideoId && videos.some((v) => v.id === bundledSettings.activeVideoId)
      ? bundledSettings.activeVideoId
      : "") ||
    (videos[0]?.id ?? "");

  return {
    ...bundledSettings,
    videos,
    activeVideoId,
    playbackRate: remote.playbackRate ?? bundledSettings.playbackRate,
    posterSrc: remote.posterSrc ?? bundledSettings.posterSrc,
  };
}

export function getBundledNatureSettings(): NatureSettingsV2 {
  return bundledSettings;
}

export async function fetchNatureSettings(): Promise<NatureSettingsV2> {
  if (isMobileBundledOnly()) return bundledSettings;

  try {
    const localPack = await readSyncedNatureSettings();
    if (!localPack) return bundledSettings;
    const localSettings = normalizeNatureSettings(localPack);
    if (!localSettings.videos.length) return bundledSettings;
    // 本地已下载包若比内置更旧（例如历史缓存），优先使用内置，避免“新场景被旧包覆盖”。
    if (localSettings.videos.length < bundledSettings.videos.length) {
      return bundledSettings;
    }
    return mergeBundledScenesByRemoteOrder(localSettings);
  } catch {
    return bundledSettings;
  }
}
