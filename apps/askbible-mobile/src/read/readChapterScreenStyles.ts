import { readChapterScreenChromeStyles } from "./readChapterScreenChromeStyles";
import { readChapterScreenLayoutStyles } from "./readChapterScreenLayoutStyles";
import { readChapterScreenVerseStyles } from "./readChapterScreenVerseStyles";

export const readChapterScreenStyles = {
  ...readChapterScreenLayoutStyles,
  ...readChapterScreenVerseStyles,
  ...readChapterScreenChromeStyles,
};
