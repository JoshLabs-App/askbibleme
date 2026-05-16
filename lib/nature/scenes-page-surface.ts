import type { CSSProperties } from "react";

/** `/scenes` 整屏底：品牌深蓝为腰，顶缘天光、底部压暗 */
export const SCENES_PAGE_SURFACE_STYLE: CSSProperties = {
  backgroundColor: "rgb(var(--brand-app-dark-rgb))",
  backgroundImage: [
    "radial-gradient(ellipse 120% 75% at 50% -12%, rgba(88, 158, 204, 0.38) 0%, transparent 54%)",
    "linear-gradient(180deg, rgb(36 96 138) 0%, rgb(var(--brand-app-dark-rgb)) 46%, rgb(6 22 40) 100%)",
  ].join(", "),
};

export function isScenesShellPath(pathname: string): boolean {
  const p = pathname || "";
  return p === "/scenes" || p.startsWith("/scenes/");
}
