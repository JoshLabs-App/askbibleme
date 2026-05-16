import type { CSSProperties } from "react";

/** 与 `read-parchment-background.css` / `.read-bible-parchment-shell` 一致 */
export const PARCHMENT_SHELL_SURFACE_STYLE: CSSProperties = {
  backgroundColor: "var(--read-parchment-bg-canvas, #ecd9b9)",
  backgroundImage: "var(--read-parchment-bg-image)",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 100%",
  backgroundPosition: "center center",
};
