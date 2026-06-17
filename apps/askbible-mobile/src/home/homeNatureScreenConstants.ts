import { getBundledNatureSettings } from "../api/fetchNatureSettings";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { resolveLocalizedField } from "../i18n/site-copy";

export const bundledOnBoot = getBundledNatureSettings();
/** Release 安装包内已有场景时秒开，避免 TestFlight 首启等网络卡在占位屏。 */
export const bootWithBundled =
  isMobileBundledOnly() || (!__DEV__ && bundledOnBoot.videos.length > 0);

export const AUTO_IMMERSIVE_DELAY_MS = 60_000;
export const HOME_VOICE_NEXT_DELAY_MS = 5000;
export const HOME_VOICE_REFERENCE_DELAY_MS = 1000;
export const HOME_VOICE_TEXT_APPEAR_DELAY_MS = 2000;

/** 与 `EdgeFadeHorizontalScrollView` 缘渐隐宽度一致，保证最后一项可滚出渐隐区 */
export const HOME_SCENE_STRIP_EDGE_PAD = 22;
export const AMBIENT_ICON_SIZE = 28;
export const AMBIENT_ICON_GAP = 10;
export const SCENE_LOOP_ALL_ID = "__askbible_all_scene_loop__";
export const SCENE_LOOP_SWITCH_MS = 30 * 60 * 1000;

export function ambientStripContentWidth(count: number): number {
  if (count <= 0) return HOME_SCENE_STRIP_EDGE_PAD * 2;
  return (
    count * AMBIENT_ICON_SIZE +
    Math.max(0, count - 1) * AMBIENT_ICON_GAP +
    HOME_SCENE_STRIP_EDGE_PAD * 2
  );
}

export function displayTitle(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw !== null && ("zh-CN" in (raw as object) || "en" in (raw as object))) {
    return resolveLocalizedField(raw as { "zh-CN"?: string; en?: string });
  }
  return "";
}

export function ambientIconColor(selected: boolean, enabled: boolean): string {
  if (!enabled) return "rgba(255,255,255,0.15)";
  return selected ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.3)";
}
