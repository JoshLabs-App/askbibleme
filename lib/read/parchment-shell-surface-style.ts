import type { CSSProperties } from "react";

/** 与 `read-parchment-background.css` / `.read-bible-parchment-shell` 一致 */
export const PARCHMENT_SHELL_SURFACE_STYLE: CSSProperties = {
  backgroundColor: "var(--read-parchment-bg-canvas, #e5d2bf)",
  backgroundImage: "var(--read-parchment-bg-image)",
  backgroundRepeat: "no-repeat",
  backgroundSize: "cover",
  backgroundPosition: "center top",
};
