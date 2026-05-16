import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

/**
 * `/read` 圣经入口专用：经文内容只谈「圣经 / 神的话」本身（默示、真理、永存、脚前的灯等），
 * 仅作金句池解析失败时的回退；正常展示与 `external-home-verse-rotation` 同源。
 */
const READ_SCRIPTURE_ABOUT_ZH: HomeVerseEntry[] = [
  {
    lines: ["圣经都是神所默示的，", "于教训、督责、使人归正、教导人学义都是有益的。"],
    ref: "提摩太后书 3:16",
  },
  {
    lines: ["神的道是活泼的，是有功效的，", "比一切两刃的剑更快。"],
    ref: "希伯来书 4:12",
  },
  {
    lines: ["你的话是我脚前的灯，", "是我路上的光。"],
    ref: "诗篇 119:105",
  },
  {
    lines: ["草必枯干，花必凋残，", "惟有我们神的话必永远立定。"],
    ref: "以赛亚书 40:8",
  },
  {
    lines: ["求你用真理使他们成圣；", "你的道就是真理。"],
    ref: "约翰福音 17:17",
  },
  {
    lines: ["人活着不是单靠食物，", "乃是靠耶和华口里所出的一切话。"],
    ref: "申命记 8:3",
  },
  {
    lines: ["少年人用什么洁净他的行为呢？", "是要遵行你的话。"],
    ref: "诗篇 119:9",
  },
  {
    lines: ["你们应该作行道的人，", "不要单作听道的人，自己欺哄自己。"],
    ref: "雅各书 1:22",
  },
];

const READ_SCRIPTURE_ABOUT_EN: HomeVerseEntry[] = [
  {
    lines: [
      "All Scripture is breathed out by God,",
      "and profitable for teaching, reproof, correction, and training in righteousness.",
    ],
    ref: "2 Timothy 3:16",
  },
  {
    lines: ["The word of God is living and active,", "sharper than any two-edged sword."],
    ref: "Hebrews 4:12",
  },
  {
    lines: ["Your word is a lamp to my feet", "and a light to my path."],
    ref: "Psalm 119:105",
  },
  {
    lines: ["The grass withers, the flower fades,", "but the word of our God will stand forever."],
    ref: "Isaiah 40:8",
  },
  {
    lines: ["Sanctify them in the truth;", "your word is truth."],
    ref: "John 17:17",
  },
  {
    lines: ["Man shall not live by bread alone,", "but by every word that comes from the mouth of the Lord."],
    ref: "Deuteronomy 8:3",
  },
  {
    lines: ["How can a young man keep his way pure?", "By guarding it according to your word."],
    ref: "Psalm 119:9",
  },
  {
    lines: ["Be doers of the word,", "and not hearers only, deceiving yourselves."],
    ref: "James 1:22",
  },
];

export const READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE: Record<AppLocale, HomeVerseEntry[]> = {
  "zh-CN": READ_SCRIPTURE_ABOUT_ZH,
  en: READ_SCRIPTURE_ABOUT_EN,
};
