import {
  NATURE_HOME_THEME_LOCK_DATASET_KEY,
  NATURE_HOME_THEME_LOCK_VALUE,
} from "@/lib/nature/root-theme";

/** `document.documentElement.dataset`：壳层安全区用羊皮底图而非品牌深色块 */
export const SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY = "appShellSafeFill";
export const SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE = "parchment";

/** 与 {@link NATURE_HOME_THEME_LOCK_DATASET_KEY} 共用；值 `parchment` 时勿被 `AppSkinProvider` 覆盖 */
export const SCRIPTURE_PARCHMENT_THEME_LOCK_VALUE = "parchment";

/** Android 等：`env(safe-area-inset-top)` 为 0 时由客户端量得的顶栏重叠高度 */
export const SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR = "--app-shell-safe-top-fallback";
export const SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR = "--app-shell-safe-top-effective";

export const SCRIPTURE_PARCHMENT_THEME_COLOR = "#ecd9b9";
export const SCRIPTURE_PARCHMENT_THEME_COLOR_DARK = "#1a1512";

export function isScriptureParchmentPath(pathname: string): boolean {
  const p = pathname || "";
  return p === "/read" || p.startsWith("/read/") || p === "/prayer" || p.startsWith("/prayer/");
}

export function isThemeColorManagedOnDocument(): boolean {
  if (typeof document === "undefined") return false;
  const v = document.documentElement.dataset[NATURE_HOME_THEME_LOCK_DATASET_KEY];
  return v === NATURE_HOME_THEME_LOCK_VALUE || v === SCRIPTURE_PARCHMENT_THEME_LOCK_VALUE;
}
