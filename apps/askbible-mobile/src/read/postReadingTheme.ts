import { readParchmentTheme as c } from "./readParchmentTheme";

/** 与网站 `read-chapter-post-reading-editions` 配色（白天羊皮） */
export const postReadingTheme = {
  discover: "#A56A2D",
  discoverBorder: "rgba(120, 75, 30, 0.26)",
  consult: "#A56A2D",
  consultBorder: "rgba(120, 75, 30, 0.26)",
  /** 卡片底由羊皮卷图 stretch 铺满，不再用白底 */
  panelFill: "transparent",
  heading: c.ink,
  headingRule: "rgba(72, 52, 34, 0.28)",
  blurb: "rgba(48, 38, 28, 0.78)",
  mdBody: "rgba(28, 20, 16, 0.82)",
  mdHeading: c.ink,
} as const;
