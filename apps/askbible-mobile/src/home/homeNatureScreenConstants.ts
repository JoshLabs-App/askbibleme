import { Platform } from "react-native";
import { getBundledNatureSettings } from "../api/fetchNatureSettings";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { resolveLocalizedField, toZhTwText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { NATURE_SCENE_TITLE_EN } from "../nature/ambientSceneSlots";
import { HOME_SCENE_THUMB_SIZE, HOME_SCENE_THUMB_SLOT_PAD, HOME_SCENE_THUMB_LABEL_H } from "./HomeSceneThumb";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import {
  AMBIENT_CHIP_WIDTH,
  AMBIENT_CHIP_HEIGHT,
  AMBIENT_ICON_GAP,
  AMBIENT_ICON_SIZE,
  HOME_AMBIENT_CHIP_INSET,
  HOME_BOTTOM_ICON_ROW_GAP,
  HOME_SCALE_TIMER_ROW_H,
  HOME_SCENE_STRIP_EDGE_PAD,
  HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD,
  HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD,
  QUICK_CONTROL_ICON_GAP,
  HOME_ALBUM_ROW_H,
} from "./homeNatureLayoutMetrics";

export {
  AMBIENT_CHIP_WIDTH,
  AMBIENT_CHIP_HEIGHT,
  AMBIENT_ICON_GAP,
  AMBIENT_ICON_SIZE,
  HOME_AMBIENT_CHIP_INSET,
  HOME_SCENE_STRIP_EDGE_PAD,
  HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD,
  HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD,
  QUICK_CONTROL_ICON_GAP,
  HOME_ALBUM_ROW_H,
};

export const bundledOnBoot = getBundledNatureSettings();
/**
 * Android 首启优先用安装包内场景顶住首屏，再异步补远端内容。
 * 这样开发包在真机上也能更接近“打开就能看见内容”的体感。
 */
export const bootWithBundled =
  isMobileBundledOnly() || ((Platform.OS === "android" || !__DEV__) && bundledOnBoot.videos.length > 0);

/** 首页：无操作此时间后隐藏场景条与环境音（播放行仍在） */
export const HOME_SCENE_AMBIENT_IDLE_HIDE_MS = 5000;
/** 横屏：闲置这么久后收起播放栏系列（点空白再唤出） */
export const HOME_LANDSCAPE_PLAY_BAR_AUTO_HIDE_MS = 5000;
/** 点开设置后，闲置这么久自动收起字号 / 环境音 / 场景条 */
export const HOME_SCENE_TOOLS_AUTO_CLOSE_MS = 7000;
export const HOME_VOICE_NEXT_DELAY_MS = 5000;
export const HOME_VOICE_REFERENCE_DELAY_MS = 1000;
export const HOME_VOICE_TEXT_APPEAR_DELAY_MS = 2000;
/** 场景首页 bottomBand：paddingTop + 环境音 + 场景条 + 专辑/金句条（不含 Tab 栏与安全区底） */
export const HOME_NATURE_BOTTOM_BAND_PAD_TOP = 12;
export const HOME_NATURE_BOTTOM_BAND_ALBUM_H = HOME_BOTTOM_ICON_ROW_GAP + HOME_ALBUM_ROW_H;
export const HOME_NATURE_BOTTOM_BAND_AMBIENT_H = HOME_BOTTOM_ICON_ROW_GAP + AMBIENT_CHIP_HEIGHT;
export const HOME_NATURE_BOTTOM_BAND_SCENE_ROW_PAD = 6;
/** 场景条上方的「字号 / 定时」行，与环境音 / 场景条同时显隐 */
export const HOME_NATURE_BOTTOM_BAND_SCALE_TIMER_H =
  HOME_BOTTOM_ICON_ROW_GAP + HOME_SCALE_TIMER_ROW_H;
export const HOME_NATURE_BOTTOM_CHROME_H =
  HOME_NATURE_BOTTOM_BAND_PAD_TOP +
  HOME_NATURE_BOTTOM_BAND_SCALE_TIMER_H +
  HOME_NATURE_BOTTOM_BAND_AMBIENT_H +
  (HOME_SCENE_THUMB_SIZE + HOME_SCENE_THUMB_SLOT_PAD * 2 + HOME_SCENE_THUMB_LABEL_H) +
  HOME_NATURE_BOTTOM_BAND_SCENE_ROW_PAD +
  HOME_NATURE_BOTTOM_BAND_ALBUM_H;
/** 设置收起时：仅播放条占位（竖屏经文区按此算，才能稳定放出 6 行） */
export const HOME_NATURE_BOTTOM_CHROME_H_COLLAPSED =
  HOME_NATURE_BOTTOM_BAND_PAD_TOP + HOME_NATURE_BOTTOM_BAND_ALBUM_H;
/** 横屏底栏高度（缩略图槽位更贴底；控件排列与竖屏一致） */
export const HOME_NATURE_BOTTOM_CHROME_H_LANDSCAPE =
  HOME_NATURE_BOTTOM_BAND_PAD_TOP +
  HOME_NATURE_BOTTOM_BAND_SCALE_TIMER_H +
  HOME_NATURE_BOTTOM_BAND_AMBIENT_H +
  (HOME_SCENE_THUMB_SIZE + HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD * 2 + HOME_SCENE_THUMB_LABEL_H) +
  HOME_NATURE_BOTTOM_BAND_ALBUM_H;
/** @deprecated 使用 HOME_NATURE_BOTTOM_CHROME_H */
export const HOME_SCENE_STRIP_BAND_H = HOME_NATURE_BOTTOM_CHROME_H;

export function homeNatureBottomChromeHeight(
  sceneToolsExpanded: boolean,
  landscape = false,
): number {
  if (landscape) {
    return sceneToolsExpanded
      ? HOME_NATURE_BOTTOM_CHROME_H_LANDSCAPE
      : HOME_NATURE_BOTTOM_CHROME_H_COLLAPSED;
  }
  return sceneToolsExpanded ? HOME_NATURE_BOTTOM_CHROME_H : HOME_NATURE_BOTTOM_CHROME_H_COLLAPSED;
}

export const SCENE_LOOP_ALL_ID = "__askbible_all_scene_loop__";
export const SCENE_LOOP_SWITCH_MS = 30 * 60 * 1000;

export function ambientStripContentWidth(
  count: number,
  edgePad = HOME_SCENE_STRIP_EDGE_PAD,
  leftPad = edgePad,
): number {
  if (count <= 0) return leftPad + edgePad;
  return (
    count * AMBIENT_CHIP_WIDTH +
    Math.max(0, count - 1) * AMBIENT_ICON_GAP +
    leftPad +
    edgePad
  );
}

/** 将第 index 个环境音图标滚入视口中央（与场景条 scrollX 同一套算法）。 */
export function ambientStripScrollX(
  index: number,
  viewportWidth: number,
  count: number,
  edgePad = HOME_SCENE_STRIP_EDGE_PAD,
  leftPad = edgePad,
): number {
  if (count <= 0 || viewportWidth < 1 || index < 0) return 0;
  const contentW = ambientStripContentWidth(count, edgePad, leftPad);
  const x = leftPad + index * (AMBIENT_CHIP_WIDTH + AMBIENT_ICON_GAP);
  const maxScroll = Math.max(0, contentW - viewportWidth);
  const centered = x - (viewportWidth - AMBIENT_CHIP_WIDTH) / 2;
  return Math.max(0, Math.min(maxScroll, centered));
}

export function displayTitle(raw: unknown, locale: AppLocale, sceneId?: string): string {
  if (locale === "en" && sceneId) {
    const mapped = NATURE_SCENE_TITLE_EN[sceneId]?.trim();
    if (mapped) return mapped;
  }
  if (raw == null) return "";
  if (typeof raw === "string") {
    const text = raw.trim();
    return locale === "zh-TW" ? toZhTwText(text) : text;
  }
  if (typeof raw === "object" && raw !== null && ("zh-CN" in (raw as object) || "en" in (raw as object))) {
    return resolveLocalizedField(raw as { "zh-CN"?: string; en?: string }, locale);
  }
  return "";
}

export function ambientIconColor(selected: boolean, enabled: boolean): string {
  if (selected) return LOGO_COLOR;
  if (!enabled) return "rgba(255,255,255,0.15)";
  return "rgba(255,255,255,1)";
}
