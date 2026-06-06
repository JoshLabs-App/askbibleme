import type { NatureHomeVerseTextEffectV1 } from "@/lib/home/nature-home-verse-appearance-prefs";

/** 与 App `natureHomePrefs` `NATURE_HOME_VERSE_TEXT_EFFECTS` 展示顺序一致 */
export const NATURE_HOME_VERSE_TEXT_EFFECTS: readonly NatureHomeVerseTextEffectV1[] = [
  "classic",
  "insetCarved",
  "bold",
  "barStrip",
] as const;
