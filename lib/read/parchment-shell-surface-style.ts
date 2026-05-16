import type { CSSProperties } from "react";

/** 羊皮卷路由：底图由 `html`/`body` 单层绘制，其它壳层保持透明 */
export const PARCHMENT_SHELL_SURFACE_STYLE: CSSProperties = {
  backgroundColor: "transparent",
  backgroundImage: "none",
};
