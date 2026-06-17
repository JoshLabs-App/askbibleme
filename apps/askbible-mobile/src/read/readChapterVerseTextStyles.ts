import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";

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
