import {
  BRAND_PRESET_ORDER,
  BRAND_PRESETS,
  brandPresetLabel,
  type BrandPresetId,
  DEFAULT_BRAND_COLORS,
  brandColorsToCssVars,
} from "@/lib/site-branding-colors";

export const USER_SKIN_STORAGE_KEY = "askbible-user-skin-v1";
export const USER_SKIN_STORAGE_KEY_LEGACY = "selah-user-skin-v1";

/** 与站点后台预设一致；`site` 表示不覆盖，沿用服务端写入的配色 */
export type UserSkinId = "site" | Exclude<BrandPresetId, "custom">;

export const USER_SKIN_ORDER: UserSkinId[] = ["site", ...BRAND_PRESET_ORDER];

/** 清除 `body` 上的品牌变量覆盖时，逐项移除 */
export const BRAND_CSS_VAR_NAMES = Object.keys(brandColorsToCssVars(DEFAULT_BRAND_COLORS));

export { brandPresetLabel };

export function parseUserSkin(raw: string | null | undefined): UserSkinId {
  if (!raw || typeof raw !== "string") return "site";
  if (raw === "site") return "site";
  if (raw in BRAND_PRESETS) return raw as UserSkinId;
  return "site";
}

export function presetColorsForUserSkin(id: UserSkinId) {
  if (id === "site") return null;
  return BRAND_PRESETS[id];
}
