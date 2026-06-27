import { getBundledNatureSettings } from "../api/fetchNatureSettings";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { resolveLocalizedField } from "../i18n/site-copy";
import { HOME_SCENE_THUMB_SIZE, HOME_SCENE_THUMB_SLOT_PAD } from "./HomeSceneThumb";

export const bundledOnBoot = getBundledNatureSettings();
/** Release 安装包内已有场景时秒开，避免 TestFlight 首启等网络卡在占位屏。 */
export const bootWithBundled =
  isMobileBundledOnly() || (!__DEV__ && bundledOnBoot.videos.length > 0);

export const AUTO_IMMERSIVE_DELAY_MS = 60_000;
/** 横屏窄屏：更快进入沉浸，隐藏场景条与环境音 */
export const AUTO_IMMERSIVE_LANDSCAPE_DELAY_MS = 10_000;
export const HOME_VOICE_NEXT_DELAY_MS = 5000;
export const HOME_VOICE_REFERENCE_DELAY_MS = 1000;
export const HOME_VOICE_TEXT_APPEAR_DELAY_MS = 2000;

/** 与 `EdgeFadeHorizontalScrollView` 缘渐隐宽度一致，保证最后一项可滚出渐隐区 */
export const HOME_SCENE_STRIP_EDGE_PAD = 22;
/** 横屏沉浸：场景条/环境音条左右留白加大 */
export const HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD = 48;
/** 横屏沉浸：缩略图槽位上下留白缩小，场景条更贴底 */
export const HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD = 4;
export const AMBIENT_ICON_SIZE = 28;
export const AMBIENT_ICON_GAP = 10;
/** 场景首页 bottomBand：paddingTop + 音乐播放 + 环境音 + 场景条（不含 Tab 栏与安全区底） */
export const HOME_NATURE_BOTTOM_BAND_PAD_TOP = 12;
export const HOME_NATURE_BOTTOM_BAND_PLAY_H = 72 + 8;
export const HOME_NATURE_BOTTOM_BAND_AMBIENT_H = 4 + 4 + AMBIENT_ICON_SIZE;
export const HOME_NATURE_BOTTOM_BAND_SCENE_ROW_PAD = 6;
export const HOME_NATURE_BOTTOM_CHROME_H =
  HOME_NATURE_BOTTOM_BAND_PAD_TOP +
  HOME_NATURE_BOTTOM_BAND_PLAY_H +
  HOME_NATURE_BOTTOM_BAND_AMBIENT_H +
  HOME_NATURE_BOTTOM_BAND_SCENE_ROW_PAD +
  (HOME_SCENE_THUMB_SIZE + HOME_SCENE_THUMB_SLOT_PAD * 2) +
  HOME_NATURE_BOTTOM_BAND_SCENE_ROW_PAD;
/** @deprecated 使用 HOME_NATURE_BOTTOM_CHROME_H */
export const HOME_SCENE_STRIP_BAND_H = HOME_NATURE_BOTTOM_CHROME_H;
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
  return selected ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.55)";
}
