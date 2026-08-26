import { readParchmentTheme as c } from "./readParchmentTheme";

export { parchmentSans, parchmentSerif } from "../fonts/parchmentType";

/** 与网站 `read-chapter-surfaces.css` 首页标题 clamp 对齐 */
export const readHeroTitle = {
  he: { fontSize: 48, lineHeight: 51, fontWeight: "600" as const },
  /** 网站 `--read-bible-home-title-zh` 上限约 50px */
  zh: { fontSize: 40, lineHeight: 44, fontWeight: "600" as const },
  en: { fontSize: 16, lineHeight: 22, fontWeight: "500" as const, letterSpacing: 0.6 },
} as const;

/** 目录书卷名（网站 parchment 约 1.03rem） */
export const readCatalogBookName = {
  fontSize: 18,
  lineHeight: 24,
  fontWeight: "600" as const,
} as const;

/** 与网站 `read-chapter-surfaces.css` 默认排版对齐 */
export const readTypography = {
  verseFontSize: 21,
  verseLineHeight: 36,
  verseFontWeight: "500" as const,
  verseColor: c.inkSoft,
  verseNumFontSize: 17,
  verseNumColor: c.verseNumMuted,
  verseNumXrefColor: c.verseNum,
  chapterTitleSize: 28,
  breadcrumbSize: 11,
  breadcrumbColor: c.faint,
  catalogSectionTracking: 2,
} as const;
