import { HOME_DOCK_NAV_BG } from "@/lib/shell/home-dock-nav-bg";

/** 自然首页：Android 顶栏 / `theme-color` 与底栏、画布同系，减少顶缘与内容色差 */
export const NATURE_HOME_ROOT_THEME = HOME_DOCK_NAV_BG;

/** `document.documentElement.dataset`：锁定期间 `AppSkinProvider` 勿覆盖 theme-color */
export const NATURE_HOME_THEME_LOCK_DATASET_KEY = "selahThemeColorManaged";
export const NATURE_HOME_THEME_LOCK_VALUE = "nature";
