import { readParchmentTheme as c } from "./readParchmentTheme";

export { parchmentSans, parchmentSerif } from "../fonts/parchmentType";


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
