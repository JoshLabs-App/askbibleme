import { parchmentSans } from "../fonts/parchmentType";
import { READ_PARCHMENT_COLOR_MODE, readParchmentTheme as c } from "./readParchmentTheme";

export const readChapterVerseTextStyles = {
  divine: {
    ...parchmentSans(700),
    color: c.divineSpeech,
  },
  human: {
    color: c.humanSpeech,
  },
  charHighlight: {
    borderRadius: 2,
  },
  savedHighlight: {
    borderRadius: 2,
    paddingHorizontal: 1,
    paddingVertical: 0,
  },
  /**
   * 跟读高亮：贴着当前这一句的字铺，不再整行铺底。
   * LOGO 黄叠透明度（浅 .55 / 深 .34），比划重点的灯油黄 .45 重一点，
   * 让「机器读到这里」和「我自己划的」分得开。
   */
  audioFollow: {
    borderRadius: 2,
    paddingHorizontal: 1,
    backgroundColor:
      READ_PARCHMENT_COLOR_MODE === "dark" ? "rgba(255, 177, 3, 0.34)" : "rgba(255, 177, 3, 0.55)",
  },
  preciseHighlightFlow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    alignItems: "flex-start" as const,
  },
  preciseHighlightUnit: {
    borderRadius: 3,
    marginRight: 1,
    marginBottom: 2,
    paddingHorizontal: 1,
    paddingVertical: 1,
  },
  preciseHighlightUnitPressed: {
    opacity: 0.82,
  },
  preciseHighlightUnitText: {
    includeFontPadding: false,
  },
  searchKeyword: {
    color: c.parchmentAccent,
    ...parchmentSans(700),
  },
};
