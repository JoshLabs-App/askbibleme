import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NatureVideoEntry } from "../types/nature";

const STORAGE_KEY = "askbible.mobile.nature-scene-usage.v1";

export type NatureSceneUsageMap = Record<string, number>;

function normalizeUsageMap(raw: unknown): NatureSceneUsageMap {
  if (!raw || typeof raw !== "object") return {};
  const out: NatureSceneUsageMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = k.trim();
    if (!id) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    out[id] = Math.floor(n);
  }
  return out;
}

export async function readNatureSceneUsageMap(): Promise<NatureSceneUsageMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return {};
    return normalizeUsageMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function bumpNatureSceneUsage(sceneId: string): Promise<NatureSceneUsageMap> {
  const id = sceneId.trim();
  if (!id) return readNatureSceneUsageMap();
  const current = await readNatureSceneUsageMap();
  const next: NatureSceneUsageMap = {
    ...current,
    [id]: (current[id] ?? 0) + 1,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore storage write failures */
  }
  return next;
}

export function sortNatureScenesByUsage(
  videos: NatureVideoEntry[],
  usage: NatureSceneUsageMap,
): NatureVideoEntry[] {
  if (!videos.length) return videos;
  const stable = videos.map((video, index) => ({ video, index }));
  stable.sort((a, b) => {
    const ua = usage[a.video.id] ?? 0;
    const ub = usage[b.video.id] ?? 0;
    if (ua !== ub) return ub - ua;
    return a.index - b.index;
  });
  return stable.map((x) => x.video);
}

