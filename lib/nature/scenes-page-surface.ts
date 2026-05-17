import type { CSSProperties } from "react";

/** `/scenes` 整屏底：浅蓝（上）→ 深蓝（下），无视频层 */
export const SCENES_PAGE_SURFACE_STYLE: CSSProperties = {
  backgroundColor: "#0f2744",
  backgroundImage: "linear-gradient(180deg, #8ec5e8 0%, #3d7aa8 42%, #1a4a6e 72%, #0f2744 100%)",
};

export function isScenesShellPath(pathname: string): boolean {
  const p = pathname || "";
  return p === "/scenes" || p.startsWith("/scenes/");
}
