import type { AppLocale } from "@/lib/i18n/config";

export type HomeVerseEntry = { lines: string[]; ref: string };

const HOME_VERSES_ZH: HomeVerseEntry[] = [
  { lines: ["耶和华是我的牧者，", "我必不至缺乏。"], ref: "诗篇 23:1" },
  { lines: ["你要专心仰赖耶和华，", "不可倚靠自己的聪明。"], ref: "箴言 3:5" },
  {
    lines: ["神爱世人，", "甚至将他的独生子赐给他们，", "叫一切信他的，不致灭亡，反得永生。"],
    ref: "约翰福音 3:16",
  },
  {
    lines: ["应当一无挂虑，", "只要凡事藉着祷告、祈求，和感谢，", "将你们所要的告诉神。"],
    ref: "腓立比书 4:6",
  },
  {
    lines: ["你要保守你心，", "胜过保守一切，", "因为一生的果效由心发出。"],
    ref: "箴言 4:23",
  },
  { lines: ["我们晓得万事都互相效力，", "叫爱神的人得益处。"], ref: "罗马书 8:28" },
  { lines: ["因我们行事为人是凭着信心，", "不是凭着眼见。"], ref: "哥林多后书 5:7" },
  { lines: ["你们要休息，", "要知道我是神。"], ref: "诗篇 46:10" },
  { lines: ["我的心哪，你要称颂耶和华！"], ref: "诗篇 103:1" },
  { lines: ["凡劳苦担重担的人可以到我这里来，", "我就使你们得安息。"], ref: "马太福音 11:28" },
];

const HOME_VERSES_EN: HomeVerseEntry[] = [
  { lines: ["The Lord is my shepherd;", "I shall not want."], ref: "Psalm 23:1" },
  {
    lines: ["Trust in the Lord with all your heart,", "and do not lean on your own understanding."],
    ref: "Proverbs 3:5",
  },
  {
    lines: [
      "For God so loved the world",
      "that he gave his only Son,",
      "that whoever believes in him should not perish but have eternal life.",
    ],
    ref: "John 3:16",
  },
  {
    lines: [
      "Do not be anxious about anything,",
      "but in everything by prayer and supplication with thanksgiving",
      "let your requests be made known to God.",
    ],
    ref: "Philippians 4:6",
  },
  {
    lines: ["Keep your heart with all vigilance,", "for from it flow the springs of life."],
    ref: "Proverbs 4:23",
  },
  {
    lines: ["We know that for those who love God", "all things work together for good."],
    ref: "Romans 8:28",
  },
  {
    lines: ["We walk by faith,", "not by sight."],
    ref: "2 Corinthians 5:7",
  },
  { lines: ["Be still,", "and know that I am God."], ref: "Psalm 46:10" },
  { lines: ["Bless the Lord, O my soul!"], ref: "Psalm 103:1" },
  {
    lines: ["Come to me, all who labor and are heavy laden,", "and I will give you rest."],
    ref: "Matthew 11:28",
  },
];

export const HOME_VERSES_BY_LOCALE: Record<AppLocale, HomeVerseEntry[]> = {
  "zh-CN": HOME_VERSES_ZH,
  en: HOME_VERSES_EN,
};
