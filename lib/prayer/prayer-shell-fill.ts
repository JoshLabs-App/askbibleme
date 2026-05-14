/** 祷告路由下 `ShellTemplateChromeLayout` 与 `[data-app-shell-scroll]` 衬底（浅色） */
export const PRAYER_SHELL_FILL_LIGHT = "#efe3d8";

/** 深色模式祷告页衬底 */
export const PRAYER_SHELL_FILL_DARK = "#151210";

/**
 * 与 {@link PRAYER_SHELL_FILL_DARK} 同屏时的 `--brand-*-rgb`，避免仍用壳模板浅色 ink（深字叠深底）。
 * 数值为手调暖灰，与 `PrayerHomeFirstScreen` 的 amber/stone 暗色卡一致。
 */
export const PRAYER_WARM_DARK_BRAND_RGB: Record<string, string> = {
  "--brand-ink-rgb": "236 229 220",
  "--brand-muted-rgb": "168 156 143",
  "--brand-border-rgb": "72 64 56",
  "--brand-surface-rgb": "44 38 34",
  "--brand-canvas-rgb": "21 18 16",
  "--brand-sand-rgb": "212 165 116",
};
