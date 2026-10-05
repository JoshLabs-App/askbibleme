import type { NatureSettingsV2 } from "@/lib/nature/types";

/** 首页产品默认场景（湖景）；与 `data/nature-settings.json` 的 `activeVideoId` 对齐 */
export const NATURE_HOME_DEFAULT_SCENE_ID = "5fdf12b5-d9f0-4160-a385-541c01b6a337";

const STORAGE_KEY = "askbible-nature-home-active-scene-v1";
const STORAGE_KEY_LEGACY = "selah-nature-home-active-scene-v1";
/** 当前场景是哪一天定下的（本地日序号 = 1970-01-01 起的天数），跨天进来就换景（D-36） */
const SCENE_DAY_KEY = "askbible-nature-home-scene-day-v1";

function localDayNumber(now = new Date()): number {
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000);
}

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

/**
 * 存当前场景。`markToday`（默认开）= 这是今天的选择，当天不再自动轮换；
 * 云端同步回填别的设备的旧选择时传 false，免得挡掉今天的轮换。
 */
export function writeNatureHomeActiveSceneId(id: string, opts?: { markToday?: boolean }): void {
  if (typeof window === "undefined") return;
  const v = id.trim();
  if (!v) return;
  try {
    localStorage.setItem(STORAGE_KEY, v);
    localStorage.removeItem(STORAGE_KEY_LEGACY);
    if (opts?.markToday !== false) localStorage.setItem(SCENE_DAY_KEY, String(localDayNumber()));
  } catch {
    /* quota / private mode */
  }
}

/**
 * 每天换一个场景（D-36，与 iOS / 安卓 `NatureHomePrefs.rotateIfNewDay` 同一公式）：
 * 跨天第一次进来轮到 `videos[日序号 % 景数]`（恰好是当前景就顺延一个），同一天内不动；
 * 没记过日子（首次 / 刚升级）只记下今天，明天开始轮换。返回轮换后的 id，不需要换时返回 null。
 */
function rotateNatureHomeSceneIfNewDay(settings: NatureSettingsV2, current: string): string | null {
  try {
    const today = localDayNumber();
    const raw = localStorage.getItem(SCENE_DAY_KEY);
    const stored = raw == null ? null : Number(raw);
    if (stored === today) return null;
    localStorage.setItem(SCENE_DAY_KEY, String(today));
    if (stored == null || !Number.isFinite(stored)) return null;
    const ids = settings.videos.map((x) => x.id.trim()).filter(Boolean);
    if (ids.length < 2) return null;
    let next = ids[((today % ids.length) + ids.length) % ids.length];
    if (next === current) next = ids[(ids.indexOf(next) + 1) % ids.length];
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}

/** 与 SSR / hydration 首帧一致：仅用配置默认 id，不读 localStorage。 */
export function defaultNatureHomeActiveVideoId(settings: NatureSettingsV2): string {
  return configuredDefaultSceneId(settings);
}

/** 优先本机上次选择，否则用配置默认；跨天先按 D-36 轮换。仅返回仍存在于 `videos` 的 id。 */
export function resolveNatureHomeActiveVideoId(settings: NatureSettingsV2): string {
  const validIds = new Set(settings.videos.map((x) => x.id.trim()).filter(Boolean));
  const stored = readNatureHomeActiveSceneId()?.trim();
  const current = stored && validIds.has(stored) ? stored : configuredDefaultSceneId(settings);
  if (typeof window === "undefined") return current;
  return rotateNatureHomeSceneIfNewDay(settings, current) ?? current;
}
