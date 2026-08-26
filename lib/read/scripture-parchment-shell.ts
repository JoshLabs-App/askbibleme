import {
  NATURE_HOME_THEME_LOCK_DATASET_KEY,
  NATURE_HOME_THEME_LOCK_VALUE,
} from "@/lib/nature/root-theme";
import { isParchmentShellPath } from "@/lib/shell/parchment-shell-path";

/** `document.documentElement.dataset`：壳层安全区用羊皮底图而非品牌深色块 */
export const SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY = "appShellSafeFill";
export const SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE = "parchment";

/** 与 {@link NATURE_HOME_THEME_LOCK_DATASET_KEY} 共用；值 `parchment` 时勿覆盖 theme-color */
export const SCRIPTURE_PARCHMENT_THEME_LOCK_VALUE = "parchment";

/** Android 等：`env(safe-area-inset-top)` 为 0 时由客户端量得的顶栏重叠高度 */
export const SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR = "--app-shell-safe-top-fallback";
export const SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR = "--app-shell-safe-top-effective";

/** 铺底 / 不支持透明顶栏时的兜底 */
export const SCRIPTURE_PARCHMENT_THEME_COLOR = "#ecd9b9";
export const SCRIPTURE_PARCHMENT_THEME_COLOR_DARK = "#1a1512";

/** 顶栏透明，让羊皮底延伸到状态栏下（Chrome 109+ / iOS 半透明顶栏） */
export const SCRIPTURE_PARCHMENT_STATUS_BAR_THEME = "transparent";

/** Samsung / 部分 WebView 对 `transparent` 无效时用 8 位 hex 透明 */
export const SCRIPTURE_PARCHMENT_STATUS_BAR_THEME_ALPHA_LIGHT = "#ecd9b900";
export const SCRIPTURE_PARCHMENT_STATUS_BAR_THEME_ALPHA_DARK = "#1a151200";

export const SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_KEY = "readParchmentSamsung";
export const SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_VALUE = "1";

/** 宽屏横卷：`parchment-shell-boot` 按视口写入，CSS 与 media query 双保险 */
export const SCRIPTURE_PARCHMENT_WIDE_DATASET_KEY = "readParchmentWide";
export const SCRIPTURE_PARCHMENT_WIDE_DATASET_VALUE = "1";

/** 与 `read-parchment-shell-chrome.css` 宽屏规则一致（视口宽 ≥ 高） */
export const SCRIPTURE_PARCHMENT_WIDE_MEDIA =
  "(min-width: 480px) and (min-aspect-ratio: 1 / 1)";

export function scriptureParchmentStatusBarTheme(dark: boolean, samsung: boolean): string {
  if (samsung) {
    return dark
      ? SCRIPTURE_PARCHMENT_STATUS_BAR_THEME_ALPHA_DARK
      : SCRIPTURE_PARCHMENT_STATUS_BAR_THEME_ALPHA_LIGHT;
  }
  return SCRIPTURE_PARCHMENT_STATUS_BAR_THEME;
}

/** 前台默认：全站羊皮卷壳；自然首页 / 场景 / 音乐 / 后台等见 {@link isParchmentShellExcludedPath} */
export function isScriptureParchmentPath(pathname: string): boolean {
  return isParchmentShellPath(pathname);
}

export function isThemeColorManagedOnDocument(): boolean {
  if (typeof document === "undefined") return false;
  const v = document.documentElement.dataset[NATURE_HOME_THEME_LOCK_DATASET_KEY];
  return v === NATURE_HOME_THEME_LOCK_VALUE || v === SCRIPTURE_PARCHMENT_THEME_LOCK_VALUE;
}
