/** Ported from mobile ExploreEncouragingWordsScreen for web alignment. */

export type EncouragingQuote = {
  id: number;
  en: string;
  zh: string;
  ref?: string;
};

export type EncouragingSection = {
  titleZh: string;
  titleEn: string;
  quotes: EncouragingQuote[];
};

export const ENCOURAGING_WORDS_SECTIONS: EncouragingSection[] = [
  {
    titleZh: "安静 / 平安 / 放松",
    titleEn: "Stillness / Peace / Rest",
    quotes: [
      { id: 1, en: "Be still, and know that I am God.", zh: "静下来，知道我是神。", ref: "Psalm 46:10" },
      { id: 2, en: "Peace I leave with you.", zh: "我留下平安给你们。", ref: "John 14:27" },
      { id: 3, en: "Do not worry about tomorrow.", zh: "不要为明天忧虑。", ref: "Matthew 6:34" },
      { id: 4, en: "He restores my soul.", zh: "他使我的灵魂苏醒。", ref: "Psalm 23:3" },
      { id: 5, en: "Come to me, all who are weary.", zh: "凡劳苦担重担的人，可以到我这里来。", ref: "Matthew 11:28" },
      { id: 6, en: "The light shines in the darkness.", zh: "光照在黑暗里。", ref: "John 1:5" },
      { id: 7, en: "Perfect love drives out fear.", zh: "爱里没有惧怕。", ref: "1 John 4:18" },
      { id: 8, en: "My peace I give you.", zh: "我将平安赐给你们。", ref: "John 14:27" },
      { id: 9, en: "Be strong and courageous.", zh: "刚强壮胆。", ref: "Joshua 1:9" },
      { id: 10, en: "The Lord is my shepherd.", zh: "耶和华是我的牧者。", ref: "Psalm 23:1" },
    ],
  },
  {
    titleZh: "焦虑 / 疲惫 / 内耗",
    titleEn: "Anxiety / Weariness / Burnout",
    quotes: [
      { id: 11, en: "Cast all your anxiety on Him.", zh: "卸下你一切的忧虑。", ref: "1 Peter 5:7" },
      { id: 12, en: "Fear not.", zh: "不要惧怕。", ref: "Isaiah 41:10" },
      { id: 13, en: "I am with you always.", zh: "我常与你们同在。", ref: "Matthew 28:20" },
      { id: 14, en: "Do not be afraid.", zh: "不要害怕。", ref: "Luke 12:32" },
      { id: 15, en: "Hope does not disappoint.", zh: "盼望不至于羞耻。", ref: "Romans 5:5" },
      { id: 16, en: "The truth will set you free.", zh: "真理必叫你们得自由。", ref: "John 8:32" },
      { id: 17, en: "Let not your heart be troubled.", zh: "你们心里不要忧愁。", ref: "John 14:1" },
      { id: 18, en: "Love never fails.", zh: "爱永不止息。", ref: "1 Corinthians 13:8" },
      { id: 19, en: "Rejoice always.", zh: "要常常喜乐。", ref: "1 Thessalonians 5:16" },
      { id: 20, en: "Pray and do not give up.", zh: "祷告，不可灰心。", ref: "Luke 18:1" },
    ],
  },
  {
    titleZh: "雨夜 / 深夜 / 孤独感",
    titleEn: "Rainy Night / Midnight / Loneliness",
    quotes: [
      { id: 21, en: "The night is nearly over.", zh: "黑夜已深，白昼将近。", ref: "Romans 13:12" },
      { id: 22, en: "Weeping may stay for the night.", zh: "一宿虽然有哭泣。", ref: "Psalm 30:5" },
      { id: 23, en: "Joy comes in the morning.", zh: "早晨便必欢呼。", ref: "Psalm 30:5" },
      { id: 24, en: "He gives strength to the weary.", zh: "疲乏的，他赐能力。", ref: "Isaiah 40:29" },
      { id: 25, en: "Wait quietly.", zh: "安静等候。", ref: "Lamentations 3:26" },
      { id: 26, en: "The Lord watches over you.", zh: "耶和华看顾你。", ref: "Psalm 121:5" },
      { id: 27, en: "He will never leave you.", zh: "他总不撇下你。", ref: "Hebrews 13:5" },
      { id: 28, en: "The dawn is coming.", zh: "清晨终会来到。", ref: "Isaiah 21:12" },
      {
        id: 29,
        en: "In quietness and trust is your strength.",
        zh: "平静安稳就是你们的力量。",
        ref: "Isaiah 30:15",
      },
      { id: 30, en: "Light will shine again.", zh: "光终会再照耀。", ref: "Micah 7:8" },
    ],
  },
  {
    titleZh: "自然 / 海洋 / 森林 / 风",
    titleEn: "Nature / Ocean / Forest / Wind",
    quotes: [
      { id: 31, en: "Deep calls to deep.", zh: "深渊与深渊响应。", ref: "Psalm 42:7" },
      { id: 32, en: "The heavens declare glory.", zh: "诸天述说荣耀。", ref: "Psalm 19:1" },
      { id: 33, en: "He calms the storm.", zh: "他使风暴平静。", ref: "Psalm 107:29" },
      { id: 34, en: "The earth is filled with His love.", zh: "遍地满了他的慈爱。", ref: "Psalm 33:5" },
      { id: 35, en: "The rivers clap their hands.", zh: "江河拍掌。", ref: "Psalm 98:8" },
      { id: 36, en: "Let the sea roar.", zh: "愿海发声。", ref: "Psalm 98:7" },
      { id: 37, en: "He waters the mountains.", zh: "他滋润群山。", ref: "Psalm 104:13" },
      { id: 38, en: "Consider the lilies.", zh: "你想野地里的百合花。", ref: "Matthew 6:28" },
      { id: 39, en: "Every good gift is from above.", zh: "一切美善都从上头来。", ref: "James 1:17" },
      { id: 40, en: "The wind blows where it wishes.", zh: "风随着意思吹。", ref: "John 3:8" },
    ],
  },
  {
    titleZh: "爱 / 温柔 / 治愈",
    titleEn: "Love / Gentleness / Healing",
    quotes: [
      { id: 41, en: "Love one another.", zh: "彼此相爱。", ref: "John 13:34" },
      { id: 42, en: "Kind words heal.", zh: "良言使心欢乐。", ref: "Proverbs 15:30" },
      { id: 43, en: "Mercy triumphs over judgment.", zh: "怜悯胜过审判。", ref: "James 2:13" },
      { id: 44, en: "Blessed are the peacemakers.", zh: "使人和睦的人有福了。", ref: "Matthew 5:9" },
      { id: 45, en: "A gentle answer turns away wrath.", zh: "柔和回答使怒消退。", ref: "Proverbs 15:1" },
      { id: 46, en: "Let your heart take courage.", zh: "你们的心当刚强。", ref: "Psalm 31:24" },
      { id: 47, en: "The greatest is love.", zh: "其中最大的是爱。", ref: "1 Corinthians 13:13" },
      { id: 48, en: "Be kind to one another.", zh: "要以恩慈相待。", ref: "Ephesians 4:32" },
      { id: 49, en: "Compassion never fails.", zh: "怜悯永不断绝。", ref: "Lamentations 3:22" },
      { id: 50, en: "Grace upon grace.", zh: "恩上加恩。", ref: "John 1:16" },
    ],
  },
  {
    titleZh: "希望 / 人生 / 前行",
    titleEn: "Hope / Life / Moving Forward",
    quotes: [
      { id: 51, en: "Seek and you will find.", zh: "寻找，就寻见。", ref: "Matthew 7:7" },
      { id: 52, en: "Walk by faith.", zh: "凭信心而行。", ref: "2 Corinthians 5:7" },
      { id: 53, en: "A new day will come.", zh: "新的一天将来到。", ref: "Isaiah 43:19" },
      { id: 54, en: "Nothing is impossible.", zh: "在神凡事都能。", ref: "Matthew 19:26" },
      { id: 55, en: "The best is yet to come.", zh: "后来的荣耀更大。", ref: "Haggai 2:9" },
      { id: 56, en: "Be renewed.", zh: "心意更新而变化。", ref: "Romans 12:2" },
      { id: 57, en: "There is a season for everything.", zh: "凡事都有定期。", ref: "Ecclesiastes 3:1" },
      { id: 58, en: "The path shines brighter.", zh: "义人的路好像黎明。", ref: "Proverbs 4:18" },
      { id: 59, en: "Keep your heart.", zh: "你要保守你心。", ref: "Proverbs 4:23" },
      { id: 60, en: "Let your light shine.", zh: "让你的光照耀。", ref: "Matthew 5:16" },
    ],
  },
  {
    titleZh: "极简 Calm 风格（超适合 UI）",
    titleEn: "Minimal Calm Style",
    quotes: [
      { id: 61, en: "Peace.", zh: "平安。" },
      { id: 62, en: "Rest.", zh: "安息。" },
      { id: 63, en: "Light.", zh: "光。" },
      { id: 64, en: "Grace.", zh: "恩典。" },
      { id: 65, en: "Hope.", zh: "盼望。" },
      { id: 66, en: "Courage.", zh: "勇气。" },
      { id: 67, en: "Quiet waters.", zh: "安静的水边。" },
      { id: 68, en: "Stillness.", zh: "宁静。" },
      { id: 69, en: "Be here now.", zh: "活在当下。" },
      { id: 70, en: "Fear not.", zh: "不要害怕。" },
    ],
  },
  {
    titleZh: "深度哲学感",
    titleEn: "Reflective & Philosophical",
    quotes: [
      { id: 71, en: "Wisdom begins with reverence.", zh: "智慧始于敬畏。", ref: "Proverbs 9:10" },
      { id: 72, en: "The heart knows.", zh: "心知道。", ref: "Proverbs 14:10" },
      { id: 73, en: "Guard your soul.", zh: "保守你的灵魂。", ref: "Proverbs 4:23" },
      { id: 74, en: "The soul finds rest.", zh: "灵魂得安息。", ref: "Matthew 11:29" },
      { id: 75, en: "Time and chance happen to all.", zh: "时机临到众人。", ref: "Ecclesiastes 9:11" },
      { id: 76, en: "Everything has meaning.", zh: "万事皆有意义。", ref: "Ecclesiastes 3" },
      { id: 77, en: "Walk humbly.", zh: "谦卑同行。", ref: "Micah 6:8" },
      { id: 78, en: "Love is patient.", zh: "爱是恒久忍耐。", ref: "1 Corinthians 13:4" },
      { id: 79, en: "Be transformed.", zh: "被更新变化。", ref: "Romans 12:2" },
      { id: 80, en: "Choose peace.", zh: "选择平安。" },
    ],
  },
  {
    titleZh: "睡眠 / 冥想 / 深呼吸",
    titleEn: "Sleep / Meditation / Deep Breathing",
    quotes: [
      { id: 81, en: "Lie down in peace.", zh: "安然躺下睡觉。", ref: "Psalm 4:8" },
      { id: 82, en: "Rest in safety.", zh: "安然居住。", ref: "Psalm 4:8" },
      { id: 83, en: "He gives sleep to His beloved.", zh: "他使所爱的安然睡觉。", ref: "Psalm 127:2" },
      { id: 84, en: "Breathe and trust.", zh: "安静信靠。" },
      { id: 85, en: "Morning will come.", zh: "清晨必要来到。" },
      { id: 86, en: "Quiet your soul.", zh: "使灵安静。", ref: "Psalm 131:2" },
      { id: 87, en: "Be at peace.", zh: "平静安稳。" },
      { id: 88, en: "Rest beside still waters.", zh: "安歇在水边。", ref: "Psalm 23:2" },
      { id: 89, en: "Sleep without fear.", zh: "坦然睡觉，不惧怕。", ref: "Proverbs 3:24" },
      { id: 90, en: "Safe in the night.", zh: "夜间得安稳。" },
    ],
  },
  {
    titleZh: "最适合 Calm App 首页",
    titleEn: "Best for Calm Home",
    quotes: [
      { id: 91, en: "Peace begins here.", zh: "平安从这里开始。" },
      { id: 92, en: "Rest your soul.", zh: "让灵魂安息。" },
      { id: 93, en: "Let go of fear.", zh: "放下惧怕。" },
      { id: 94, en: "Quiet the noise.", zh: "让喧嚣安静下来。" },
      { id: 95, en: "The light remains.", zh: "光仍在。" },
      { id: 96, en: "You are not alone.", zh: "你并不孤单。" },
      { id: 97, en: "Rest beneath the rain.", zh: "在雨声里安歇。" },
      { id: 98, en: "Hope is still alive.", zh: "盼望仍然活着。" },
      { id: 99, en: "Grace is enough.", zh: "恩典够用。" },
      { id: 100, en: "Be still.", zh: "静下来。" },
    ],
  },
];;
