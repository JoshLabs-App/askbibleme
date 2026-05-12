import type { Viewport } from "next";
import { NATURE_HOME_ROOT_THEME } from "@/lib/nature/root-theme";

/** 供 `/` 与 `/nature` 导出：深色 theme-color + 显式 `cover`，保证刘海机 `env(safe-area-inset-*)` 与根布局一致 */
export const natureHomeViewport: Viewport = {
  themeColor: NATURE_HOME_ROOT_THEME,
  viewportFit: "cover",
};
