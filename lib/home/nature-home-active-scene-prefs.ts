import type { NatureSettingsV2 } from "@/lib/nature/types";

const STORAGE_KEY = "selah-nature-home-active-scene-v1";

export function readNatureHomeActiveSceneId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function writeNatureHomeActiveSceneId(id: string): void {
  if (typeof window === "undefined") return;
  const v = id.trim();
  if (!v) return;
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* quota / private mode */
  }
}

/** 优先本机上次选择，否则用配置默认；仅返回仍存在于 `videos` 的 id。 */
export function resolveNatureHomeActiveVideoId(settings: NatureSettingsV2): string {
  const validIds = new Set(settings.videos.map((x) => x.id.trim()).filter(Boolean));
  const stored = readNatureHomeActiveSceneId()?.trim();
  if (stored && validIds.has(stored)) return stored;
  return settings.activeVideoId.trim() || settings.videos[0]?.id || "";
}
