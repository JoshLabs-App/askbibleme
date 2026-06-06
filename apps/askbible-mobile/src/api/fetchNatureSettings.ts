import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NatureSettingsV2 } from "../types/nature";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { readSyncedNatureSettings } from "../media/natureResourcePackSync";

const bundledRaw = require("../../assets/content/nature-settings.json") as NatureSettingsV2;
const NATURE_SETTINGS_CACHE_KEY = "askbible-nature-settings-cache-v1";
const NATURE_SETTINGS_CACHE_TTL_MS = 60_000;

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

function isNatureSettingsShape(raw: unknown): raw is NatureSettingsV2 {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.videos);
}

function isLocalLikeHostFromBase(base: string): boolean {
  try {
    const u = new URL(base);
    const h = u.hostname.trim().toLowerCase();
    if (!h) return true;
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
    if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
    const m = h.match(/^172\.(\d+)\./);
    if (m) {
      const octet = Number(m[1]);
      if (Number.isFinite(octet) && octet >= 16 && octet <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

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

/** Web 场景列表为真源；APK 内置仅用于已有媒体的本地路径回退。 */
export function mergeBundledScenesByRemoteOrder(remote: NatureSettingsV2): NatureSettingsV2 {
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

  const videos = remote.videos
    .map((row) => {
      const bundled = pickBundledMatch(
        row,
        bundledById,
        bundledByFingerprint,
        usedBundledIds,
      );
      if (!bundled) {
        return row;
      }
      usedBundledIds.add(bundled.id);
      return {
        ...bundled,
        ...row,
        id: bundled.id,
        src: bundled.src,
        src1080: bundled.src1080,
        src4k: bundled.src4k,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const remoteActive = remote.activeVideoId?.trim() ?? "";
  const remoteActiveRow = remote.videos.find((row) => row.id === remoteActive);
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
    (remoteActive && videos.some((v) => v.id === remoteActive) ? remoteActive : "") ||
    (activeMappedBundledId && videos.some((v) => v.id === activeMappedBundledId)
      ? activeMappedBundledId
      : "") ||
    (bundledSettings.activeVideoId && videos.some((v) => v.id === bundledSettings.activeVideoId)
      ? bundledSettings.activeVideoId
      : "") ||
    (videos[0]?.id ?? "");

  return {
    ...remote,
    version: remote.version ?? bundledSettings.version,
    ambientClips:
      remote.ambientClips.length > 0 ? remote.ambientClips : bundledSettings.ambientClips,
    videos,
    activeVideoId,
    playbackRate: remote.playbackRate ?? bundledSettings.playbackRate,
    posterSrc: remote.posterSrc ?? bundledSettings.posterSrc,
  };
}

export function getBundledNatureSettings(): NatureSettingsV2 {
  return bundledSettings;
}

type CachedNatureSettings = {
  fetchedAt: number;
  settings: NatureSettingsV2;
};

async function readCachedNatureSettings(): Promise<NatureSettingsV2 | null> {
  try {
    const raw = await AsyncStorage.getItem(NATURE_SETTINGS_CACHE_KEY);
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<CachedNatureSettings>;
    if (!parsed.settings || !isNatureSettingsShape(parsed.settings)) return null;
    const age = Date.now() - (typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0);
    if (age > NATURE_SETTINGS_CACHE_TTL_MS) return null;
    return normalizeNatureSettings(parsed.settings);
  } catch {
    return null;
  }
}

async function writeCachedNatureSettings(settings: NatureSettingsV2): Promise<void> {
  try {
    const payload: CachedNatureSettings = { fetchedAt: Date.now(), settings };
    await AsyncStorage.setItem(NATURE_SETTINGS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** 从 askbible.me（或联调本机）拉取 Web 真源场景配置。 */
export async function fetchNatureSettingsFromRemote(): Promise<NatureSettingsV2 | null> {
  const primaryBase = getAskBibleBaseUrl().replace(/\/$/, "");
  const candidates = [primaryBase];
  if (isLocalLikeHostFromBase(primaryBase) && !candidates.includes("https://askbible.me")) {
    candidates.push("https://askbible.me");
  }

  for (const base of candidates) {
    try {
      const res = await fetchWithTimeout(`${base}/api/nature/settings`, {
        headers: { Accept: "application/json" },
        timeoutMs: 5000,
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/json")) continue;
      const data = normalizeNatureSettings((await res.json()) as NatureSettingsV2);
      if (data.videos.length > 0) return data;
    } catch {
      /* 离线或本机未启动时继续尝试下一候选 */
    }
  }
  return null;
}

export async function fetchNatureSettings(): Promise<NatureSettingsV2> {
  const remote = await fetchNatureSettingsFromRemote();
  if (remote) {
    const merged = mergeBundledScenesByRemoteOrder(remote);
    await writeCachedNatureSettings(remote);
    return merged;
  }

  try {
    const localPack = await readSyncedNatureSettings();
    if (localPack?.videos?.length) {
      return mergeBundledScenesByRemoteOrder(normalizeNatureSettings(localPack));
    }
  } catch {
    /* ignore */
  }

  const cached = await readCachedNatureSettings();
  if (cached?.videos.length) {
    return mergeBundledScenesByRemoteOrder(cached);
  }

  return bundledSettings;
}
