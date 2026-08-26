import { DEFAULT_BRAND_COLORS } from "@/lib/site-branding-colors";

/** 自然首页：Android 顶栏 / `theme-color` 与底栏「深色应用」同系，减少顶缘与内容色差 */
export const NATURE_HOME_ROOT_THEME = DEFAULT_BRAND_COLORS.appDark;

/** `document.documentElement.dataset`：锁定期间勿覆盖 theme-color */
export const NATURE_HOME_THEME_LOCK_DATASET_KEY = "selahThemeColorManaged";
export const NATURE_HOME_THEME_LOCK_VALUE = "nature";
