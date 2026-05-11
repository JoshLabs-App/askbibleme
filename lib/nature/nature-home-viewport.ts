import type { Viewport } from "next";
import { NATURE_HOME_ROOT_THEME } from "@/lib/nature/root-theme";

/** 供 `/` 与 `/nature` 导出，覆盖根 `generateViewport` 的浅色 theme-color */
export const natureHomeViewport: Viewport = {
  themeColor: NATURE_HOME_ROOT_THEME,
};
