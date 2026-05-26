import type { NatureSettingsV2 } from "@/lib/nature/types";

/** 首页产品默认场景（湖景）；与 `data/nature-settings.json` 的 `activeVideoId` 对齐 */
export const NATURE_HOME_DEFAULT_SCENE_ID = "5fdf12b5-d9f0-4160-a385-541c01b6a337";

const STORAGE_KEY = "askbible-nature-home-active-scene-v1";
const STORAGE_KEY_LEGACY = "selah-nature-home-active-scene-v1";

function configuredDefaultSceneId(settings: NatureSettingsV2): string {
  const fromSettings = settings.activeVideoId.trim();
  if (fromSettings && settings.videos.some((v) => v.id === fromSettings)) {
    return fromSettings;
  }
  if (settings.videos.some((v) => v.id === NATURE_HOME_DEFAULT_SCENE_ID)) {
    return NATURE_HOME_DEFAULT_SCENE_ID;
  }
  return settings.videos[0]?.id ?? "";
}

export function readNatureHomeActiveSceneId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = (localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_LEGACY))?.trim();
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
    localStorage.removeItem(STORAGE_KEY_LEGACY);
  } catch {
    /* quota / private mode */
  }
}

/** 与 SSR / hydration 首帧一致：仅用配置默认 id，不读 localStorage。 */
export function defaultNatureHomeActiveVideoId(settings: NatureSettingsV2): string {
  return configuredDefaultSceneId(settings);
}

/** 优先本机上次选择，否则用配置默认；仅返回仍存在于 `videos` 的 id。 */
export function resolveNatureHomeActiveVideoId(settings: NatureSettingsV2): string {
  const validIds = new Set(settings.videos.map((x) => x.id.trim()).filter(Boolean));
  const stored = readNatureHomeActiveSceneId()?.trim();
  if (stored && validIds.has(stored)) return stored;
  return configuredDefaultSceneId(settings);
}
