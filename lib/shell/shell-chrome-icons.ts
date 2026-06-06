/** 壳层浮层图标（对齐 App `shellChromeIcons.ts`） */
export const SHELL_ICON = "rgba(255,255,255,0.72)";
export const SHELL_TAB_BAR_ICON = "#FFFFFF";
export const SHELL_MENU_ICON_SIZE_PX = 26;
export const SHELL_SETTINGS_ICON_SIZE_PX = 22;
export const SHELL_CHROME_HIT_PX = 44;

export const SHELL_ICON_TEXT_SHADOW =
  "0 1px 6px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.8)";

/** App `ShellTabBar` / 自然首页环境音条（glyph 较 App 内 22px 略放大，便于 Web 辨认） */
export const SHELL_TAB_ICON_SIZE_PX = 28;
/** 与 App `AMBIENT_ICON_SIZE` 触控区一致 */
export const SHELL_AMBIENT_CHIP_SIZE_PX = 28;
/** App `MaterialCommunityIcons` size={22}；Web 用 28 填满触控区，视觉更接近 iPhone */
export const SHELL_AMBIENT_ICON_GLYPH_PX = 28;
export const SHELL_AMBIENT_ICON_GAP_PX = 10;

export type ShellTabMaterialIconName = "home" | "music-note" | "menu-book" | "explore";
export type ShellPlayMaterialIconName = "play-arrow" | "pause";

export function shellTabMaterialIcon(tab: "home" | "music" | "read" | "explore"): ShellTabMaterialIconName {
  switch (tab) {
    case "home":
      return "home";
    case "music":
      return "music-note";
    case "read":
      return "menu-book";
    case "explore":
      return "explore";
  }
}
