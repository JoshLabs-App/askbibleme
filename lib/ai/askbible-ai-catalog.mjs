// AskBible.me · 共享 AI 目录与语义规范真源（纯 ESM，零运行时依赖）
// 供 askbible-web、workers/askbible-edge 与本地 Stdio MCP 共用。

export const PRODUCT_NAME = "AskBible.me";
export const PRODUCT_ORIGIN = "https://askbible.me";
export const APP_SCHEME = "askbible";
export const MCP_PROTOCOL_VERSION = "2025-03-26";
export const MCP_SERVER_VERSION = "1.0.0";

/** 正典 66 卷书规范表（中英文全称、常见简称与章数） */
export const CANON_BOOKS = [
  { id: "GEN", zh: "创世记", en: "Genesis", testament: "OT", chapters: 50, aliases: ["创", "创世纪", "gen", "gn"] },
  { id: "EXO", zh: "出埃及记", en: "Exodus", testament: "OT", chapters: 40, aliases: ["出", "exo", "ex"] },
  { id: "LEV", zh: "利未记", en: "Leviticus", testament: "OT", chapters: 27, aliases: ["利", "lev", "lv"] },
  { id: "NUM", zh: "民数记", en: "Numbers", testament: "OT", chapters: 36, aliases: ["民", "num", "nm"] },
  { id: "DEU", zh: "申命记", en: "Deuteronomy", testament: "OT", chapters: 34, aliases: ["申", "deu", "dt"] },
  { id: "JOS", zh: "约书亚记", en: "Joshua", testament: "OT", chapters: 24, aliases: ["书", "jos", "josh"] },
  { id: "JDG", zh: "士师记", en: "Judges", testament: "OT", chapters: 21, aliases: ["士", "jdg", "judg"] },
  { id: "RUT", zh: "路得记", en: "Ruth", testament: "OT", chapters: 4, aliases: ["得", "rut", "ruth"] },
  { id: "1SA", zh: "撒母耳记上", en: "1 Samuel", testament: "OT", chapters: 31, aliases: ["撒上", "1sa", "1sam", "first samuel"] },
  { id: "2SA", zh: "撒母耳记下", en: "2 Samuel", testament: "OT", chapters: 24, aliases: ["撒下", "2sa", "2sam", "second samuel"] },
  { id: "1KI", zh: "列王纪上", en: "1 Kings", testament: "OT", chapters: 22, aliases: ["王上", "1ki", "1kgs", "1kings"] },
  { id: "2KI", zh: "列王纪下", en: "2 Kings", testament: "OT", chapters: 25, aliases: ["王下", "2ki", "2kgs", "2kings"] },
  { id: "1CH", zh: "历代志上", en: "1 Chronicles", testament: "OT", chapters: 29, aliases: ["代上", "1ch", "1chr"] },
  { id: "2CH", zh: "历代志下", en: "2 Chronicles", testament: "OT", chapters: 36, aliases: ["代下", "2ch", "2chr"] },
  { id: "EZR", zh: "以斯拉记", en: "Ezra", testament: "OT", chapters: 10, aliases: ["拉", "ezr", "ezra"] },
  { id: "NEH", zh: "尼希米记", en: "Nehemiah", testament: "OT", chapters: 13, aliases: ["尼", "neh"] },
  { id: "EST", zh: "以斯帖记", en: "Esther", testament: "OT", chapters: 10, aliases: ["斯", "est"] },
  { id: "JOB", zh: "约伯记", en: "Job", testament: "OT", chapters: 42, aliases: ["伯", "job"] },
  { id: "PSA", zh: "诗篇", en: "Psalms", testament: "OT", chapters: 150, aliases: ["诗", "psalm", "psa", "ps"] },
  { id: "PRO", zh: "箴言", en: "Proverbs", testament: "OT", chapters: 31, aliases: ["箴", "pro", "prov"] },
  { id: "ECC", zh: "传道书", en: "Ecclesiastes", testament: "OT", chapters: 12, aliases: ["传", "ecc", "eccl"] },
  { id: "SNG", zh: "雅歌", en: "Song of Solomon", testament: "OT", chapters: 8, aliases: ["歌", "sng", "song", "sos"] },
  { id: "ISA", zh: "以赛亚书", en: "Isaiah", testament: "OT", chapters: 66, aliases: ["赛", "isa"] },
  { id: "JER", zh: "耶利米书", en: "Jeremiah", testament: "OT", chapters: 52, aliases: ["耶", "jer"] },
  { id: "LAM", zh: "耶利米哀歌", en: "Lamentations", testament: "OT", chapters: 5, aliases: ["哀", "lam"] },
  { id: "EZK", zh: "以西结书", en: "Ezekiel", testament: "OT", chapters: 48, aliases: ["结", "ezk", "eze", "ezek"] },
  { id: "DAN", zh: "但以理书", en: "Daniel", testament: "OT", chapters: 12, aliases: ["但", "dan"] },
  { id: "HOS", zh: "何西阿书", en: "Hosea", testament: "OT", chapters: 14, aliases: ["何", "hos"] },
  { id: "JOL", zh: "约珥书", en: "Joel", testament: "OT", chapters: 3, aliases: ["珥", "jol", "joel"] },
  { id: "AMO", zh: "阿摩司书", en: "Amos", testament: "OT", chapters: 9, aliases: ["摩", "amo", "amos"] },
  { id: "OBA", zh: "俄巴底亚书", en: "Obadiah", testament: "OT", chapters: 1, aliases: ["俄", "oba", "obad"] },
  { id: "JON", zh: "约拿书", en: "Jonah", testament: "OT", chapters: 4, aliases: ["拿", "jon", "jonah"] },
  { id: "MIC", zh: "弥迦书", en: "Micah", testament: "OT", chapters: 7, aliases: ["弥", "mic"] },
  { id: "NAM", zh: "那鸿书", en: "Nahum", testament: "OT", chapters: 3, aliases: ["鸿", "nam", "nah"] },
  { id: "HAB", zh: "哈巴谷书", en: "Habakkuk", testament: "OT", chapters: 3, aliases: ["哈", "hab"] },
  { id: "ZEP", zh: "西番雅书", en: "Zephaniah", testament: "OT", chapters: 3, aliases: ["番", "zep"] },
  { id: "HAG", zh: "哈该书", en: "Haggai", testament: "OT", chapters: 2, aliases: ["该", "hag"] },
  { id: "ZEC", zh: "撒迦利亚书", en: "Zechariah", testament: "OT", chapters: 14, aliases: ["亚", "zec", "zech"] },
  { id: "MAL", zh: "玛拉基书", en: "Malachi", testament: "OT", chapters: 4, aliases: ["玛", "mal"] },
  { id: "MAT", zh: "马太福音", en: "Matthew", testament: "NT", chapters: 28, aliases: ["太", "mat", "matt", "mt"] },
  { id: "MRK", zh: "马可福音", en: "Mark", testament: "NT", chapters: 16, aliases: ["可", "mrk", "mark", "mk"] },
  { id: "LUK", zh: "路加福音", en: "Luke", testament: "NT", chapters: 24, aliases: ["路", "luk", "luke", "lk"] },
  { id: "JHN", zh: "约翰福音", en: "John", testament: "NT", chapters: 21, aliases: ["约", "jhn", "john", "jn"] },
  { id: "ACT", zh: "使徒行传", en: "Acts", testament: "NT", chapters: 28, aliases: ["徒", "act", "acts"] },
  { id: "ROM", zh: "罗马书", en: "Romans", testament: "NT", chapters: 16, aliases: ["罗", "rom"] },
  { id: "1CO", zh: "哥林多前书", en: "1 Corinthians", testament: "NT", chapters: 16, aliases: ["林前", "1co", "1cor"] },
  { id: "2CO", zh: "哥林多后书", en: "2 Corinthians", testament: "NT", chapters: 13, aliases: ["林后", "2co", "2cor"] },
  { id: "GAL", zh: "加拉太书", en: "Galatians", testament: "NT", chapters: 6, aliases: ["加", "gal"] },
  { id: "EPH", zh: "以弗所书", en: "Ephesians", testament: "NT", chapters: 6, aliases: ["弗", "eph"] },
  { id: "PHP", zh: "腓立比书", en: "Philippians", testament: "NT", chapters: 4, aliases: ["腓", "php", "phil"] },
  { id: "COL", zh: "歌罗西书", en: "Colossians", testament: "NT", chapters: 4, aliases: ["西", "col"] },
  { id: "1TH", zh: "帖撒罗尼迦前书", en: "1 Thessalonians", testament: "NT", chapters: 5, aliases: ["帖前", "1th", "1thess"] },
  { id: "2TH", zh: "帖撒罗尼迦后书", en: "2 Thessalonians", testament: "NT", chapters: 3, aliases: ["帖后", "2th", "2thess"] },
  { id: "1TI", zh: "提摩太前书", en: "1 Timothy", testament: "NT", chapters: 6, aliases: ["提前", "1ti", "1tim"] },
  { id: "2TI", zh: "提摩太后书", en: "2 Timothy", testament: "NT", chapters: 4, aliases: ["提后", "2ti", "2tim"] },
  { id: "TIT", zh: "提多书", en: "Titus", testament: "NT", chapters: 3, aliases: ["多", "tit", "titus"] },
  { id: "PHM", zh: "腓利门书", en: "Philemon", testament: "NT", chapters: 1, aliases: ["门", "phm", "phlm"] },
  { id: "HEB", zh: "希伯来书", en: "Hebrews", testament: "NT", chapters: 13, aliases: ["来", "heb"] },
  { id: "JAS", zh: "雅各书", en: "James", testament: "NT", chapters: 5, aliases: ["雅", "jas", "james"] },
  { id: "1PE", zh: "彼得前书", en: "1 Peter", testament: "NT", chapters: 5, aliases: ["彼前", "1pe", "1pet"] },
  { id: "2PE", zh: "彼得后书", en: "2 Peter", testament: "NT", chapters: 3, aliases: ["彼后", "2pe", "2pet"] },
  { id: "1JN", zh: "约翰一书", en: "1 John", testament: "NT", chapters: 5, aliases: ["约一", "约壹", "1jn", "1john"] },
  { id: "2JN", zh: "约翰二书", en: "2 John", testament: "NT", chapters: 1, aliases: ["约二", "约贰", "2jn", "2john"] },
  { id: "3JN", zh: "约翰三书", en: "3 John", testament: "NT", chapters: 1, aliases: ["约三", "约叁", "3jn", "3john"] },
  { id: "JUD", zh: "犹大书", en: "Jude", testament: "NT", chapters: 1, aliases: ["犹", "jud", "jude"] },
  { id: "REV", zh: "启示录", en: "Revelation", testament: "NT", chapters: 22, aliases: ["启", "rev"] },
];

export const CANON_BOOK_MAP = new Map(CANON_BOOKS.map((b) => [b.id, b]));

const BOOK_ALIAS_INDEX = new Map();
for (const book of CANON_BOOKS) {
  BOOK_ALIAS_INDEX.set(book.id.toLowerCase(), book);
  BOOK_ALIAS_INDEX.set(book.zh.toLowerCase(), book);
  BOOK_ALIAS_INDEX.set(book.en.toLowerCase(), book);
  BOOK_ALIAS_INDEX.set(book.en.toLowerCase().replace(/\s+/g, ""), book);
  for (const alias of book.aliases) {
    BOOK_ALIAS_INDEX.set(alias.toLowerCase(), book);
    BOOK_ALIAS_INDEX.set(alias.toLowerCase().replace(/\s+/g, ""), book);
  }
}

/** 公开静态译本清单（与 public/scripture/<id>/ 对齐） */
export const PUBLIC_TRANSLATIONS = [
  { id: "cuv-simp", labelZh: "和合本（简体）", labelEn: "Chinese Union Version (Simplified)", language: "zh-Hans", aliases: ["cuv", "和合本", "和合本简体", "zh"] },
  { id: "cuv-trad", labelZh: "和合本（繁體）", labelEn: "Chinese Union Version (Traditional)", language: "zh-Hant", aliases: ["cuv-t", "和合本繁体", "和合本繁體"] },
  { id: "cbs-zh", labelZh: "中文当代译本（简体）", labelEn: "Chinese Contemporary Bible (Simplified)", language: "zh-Hans", aliases: ["cbs", "当代译本"] },
  { id: "swcb-zh", labelZh: "世界中文圣经", labelEn: "World Chinese Bible", language: "zh-Hans", aliases: ["swcb"] },
  { id: "otb-zh-hans", labelZh: "Open Bible 简体中文", labelEn: "Open Translation Bible (Simplified)", language: "zh-Hans", aliases: ["otb-zh"] },
  { id: "otb-zh-hant", labelZh: "Open Bible 繁體中文", labelEn: "Open Translation Bible (Traditional)", language: "zh-Hant", aliases: [] },
  { id: "web-en", labelZh: "WEB 世界英文圣经", labelEn: "World English Bible (WEB)", language: "en", aliases: ["web", "en"] },
  { id: "kjv", labelZh: "KJV 英文钦定本", labelEn: "King James Version (KJV)", language: "en", aliases: ["kjv-en"] },
  { id: "asv", labelZh: "ASV 英文标准本", labelEn: "American Standard Version (ASV)", language: "en", aliases: ["asv-en"] },
  { id: "bbe-en", labelZh: "BBE 简易英文", labelEn: "Bible in Basic English (BBE)", language: "en", aliases: ["bbe"] },
  { id: "ust-en", labelZh: "UST 简明英文", labelEn: "unfoldingWord Simplified Text (UST)", language: "en", aliases: ["ust"] },
  { id: "otb-en-gb", labelZh: "Open Bible 英文版", labelEn: "Open Translation Bible (English)", language: "en", aliases: ["otb-en"] },
  { id: "dby-en", labelZh: "Darby 英译本", labelEn: "Darby Translation", language: "en", aliases: ["dby", "darby"] },
  { id: "gnv-en", labelZh: "Geneva 1599 英译本", labelEn: "Geneva Bible 1599", language: "en", aliases: ["gnv", "geneva"] },
  { id: "ylt-en", labelZh: "YLT 杨氏直译本", labelEn: "Young's Literal Translation (YLT)", language: "en", aliases: ["ylt"] },
  { id: "rv1909-es", labelZh: "西班牙语 Reina-Valera 1909", labelEn: "Reina-Valera 1909 (Spanish)", language: "es", aliases: ["rv1909", "es"] },
  { id: "rvg-es", labelZh: "西班牙语 RVG", labelEn: "Reina Valera Gomez (Spanish)", language: "es", aliases: ["rvg"] },
  { id: "blm-es", labelZh: "西班牙语 自由世界圣经", labelEn: "Spanish Free Bible for the World", language: "es", aliases: ["blm"] },
];

export const DEFAULT_TRANSLATION_ID = "cuv-simp";

const TRANSLATION_ALIAS_INDEX = new Map();
for (const tr of PUBLIC_TRANSLATIONS) {
  TRANSLATION_ALIAS_INDEX.set(tr.id.toLowerCase(), tr);
  for (const alias of tr.aliases) {
    TRANSLATION_ALIAS_INDEX.set(alias.toLowerCase(), tr);
  }
}

/** 公开读经计划目录（与 public/data/bible-reading-plans/ 对齐） */
export const PUBLIC_READING_PLANS = [
  { id: "esvthroughthebible", nameZh: "一年通读圣经", nameEn: "Through The Bible", days: 365, theme: "全年通读" },
  { id: "backtothebiblechronological", nameZh: "编年顺序一年通读", nameEn: "Back to the Bible Chronological", days: 365, theme: "历史编年" },
  { id: "esvgospelsandepistles", nameZh: "福音书与书信", nameEn: "Gospels and Epistles", days: 365, theme: "新约灵修" },
  { id: "esvpsalmsandwisdomliterature", nameZh: "诗篇与智慧书", nameEn: "Psalms and Wisdom Literature", days: 365, theme: "安静与智慧" },
  { id: "esvpentateuchandhistoryofisrael", nameZh: "摩西五经与历史书", nameEn: "Pentateuch and History of Israel", days: 365, theme: "旧约叙事" },
  { id: "esvchroniclesandprophets", nameZh: "历代志与先知书", nameEn: "Chronicles and Prophets", days: 365, theme: "先知书" },
  { id: "esvliterarystudybible", nameZh: "文学脉络读经计划", nameEn: "Literary Study Bible Plan", days: 365, theme: "结构细读" },
  { id: "esveverydayinword", nameZh: "每日在话语中", nameEn: "Every Day In the Word", days: 365, theme: "多段日读" },
  { id: "mcheyne", nameZh: "麦琴读经表", nameEn: "M'Cheyne Reading Plan", days: 365, theme: "经典四段" },
  { id: "oneyearchronological", nameZh: "一年历史编年表", nameEn: "One Year Chronological", days: 365, theme: "历史编年" },
];

/** 情绪/处境 → 安静入口引导表（贴合 AskBible “让人重新进入圣经的安静入口” 定位） */
export const QUIET_ENTRIES = [
  {
    id: "anxiety",
    keywords: ["焦虑", "担心", "紧张", "不安", "压力", "恐慌", "anxious", "anxiety", "worry", "stress"],
    labelZh: "焦虑与挂虑时",
    labelEn: "When Anxious or Overwhelmed",
    noteZh: "不必立刻解决所有事，先在安静里把重担放下，听牧者的声音。",
    passages: [
      { bookId: "PSA", chapter: 23, verseRange: "1-6", titleZh: "诗篇 23 篇 · 耶和华是我的牧者" },
      { bookId: "PHP", chapter: 4, verseRange: "6-7", titleZh: "腓立比书 4:6-7 · 出人意外的平安" },
      { bookId: "MAT", chapter: 6, verseRange: "25-34", titleZh: "马太福音 6:25-34 · 不要为明天忧虑" },
    ],
    recommendedPlanId: "esvpsalmsandwisdomliterature",
    audioMood: "quiet",
  },
  {
    id: "insomnia",
    keywords: ["失眠", "睡不着", "夜晚", "睡前", "熬夜", "夜深", "insomnia", "sleep", "night", "bedtime"],
    labelZh: "夜深与睡前",
    labelEn: "Late Night & Before Sleep",
    noteZh: "放慢呼吸，打开「安静」伴读音乐，让一小段诗篇陪你入睡。",
    passages: [
      { bookId: "PSA", chapter: 4, verseRange: "8", titleZh: "诗篇 4:8 · 我必安然躺下睡觉" },
      { bookId: "PSA", chapter: 121, verseRange: "1-8", titleZh: "诗篇 121 篇 · 保护你的必不打盹" },
      { bookId: "PSA", chapter: 91, verseRange: "1-6", titleZh: "诗篇 91:1-6 · 住在至高者隐密处" },
    ],
    recommendedPlanId: "esvpsalmsandwisdomliterature",
    audioMood: "quiet",
  },
  {
    id: "weary",
    keywords: ["疲惫", "累", "耗尽", "倦怠", "无力", "tired", "weary", "exhausted", "burnout", "rest"],
    labelZh: "疲惫与耗尽时",
    labelEn: "When Weary & Exhausted",
    noteZh: "今天不需要读很多章，回到经文里歇息片刻就够了。",
    passages: [
      { bookId: "MAT", chapter: 11, verseRange: "28-30", titleZh: "马太福音 11:28-30 · 我就使你们得安息" },
      { bookId: "ISA", chapter: 40, verseRange: "28-31", titleZh: "以赛亚书 40:28-31 · 等候耶和华的必重新得力" },
      { bookId: "PSA", chapter: 62, verseRange: "1-8", titleZh: "诗篇 62:1-8 · 我的心默默无声，专等候神" },
    ],
    recommendedPlanId: "esvgospelsandepistles",
    audioMood: "quiet",
  },
  {
    id: "grief",
    keywords: ["难过", "伤心", "哀伤", "失落", "孤独", "流泪", "sad", "grief", "lonely", "sorrow", "hurt"],
    labelZh: "哀伤与低谷时",
    labelEn: "In Grief or Low Valleys",
    noteZh: "经文允许诚实的眼泪，不必强装坚强。",
    passages: [
      { bookId: "PSA", chapter: 34, verseRange: "18", titleZh: "诗篇 34:18 · 耶和华靠近伤心的人" },
      { bookId: "PSA", chapter: 42, verseRange: "1-11", titleZh: "诗篇 42 篇 · 我的心哪，你为何忧闷" },
      { bookId: "JHN", chapter: 14, verseRange: "1-3", titleZh: "约翰福音 14:1-3 · 你们心里不要忧愁" },
    ],
    recommendedPlanId: "esvpsalmsandwisdomliterature",
    audioMood: "quiet",
  },
  {
    id: "morning",
    keywords: ["早晨", "晨间", "早上", "开始一天", "晨祷", "morning", "start", "daily", "wake"],
    labelZh: "清晨开始一天",
    labelEn: "Quiet Morning Start",
    noteZh: "在看消息与待办之前，先用三分钟回到经文。",
    passages: [
      { bookId: "PSA", chapter: 143, verseRange: "8", titleZh: "诗篇 143:8 · 求你使我清晨得听你慈爱之言" },
      { bookId: "LAM", chapter: 3, verseRange: "22-24", titleZh: "耶利米哀歌 3:22-24 · 每早晨这都是新的" },
      { bookId: "JHN", chapter: 15, verseRange: "1-8", titleZh: "约翰福音 15:1-8 · 常在我里面" },
    ],
    recommendedPlanId: "esvthroughthebible",
    audioMood: "quiet",
  },
  {
    id: "gratitude",
    keywords: ["感恩", "感谢", "喜乐", "赞美", "平安", "gratitude", "thankful", "joy", "praise", "peace"],
    labelZh: "感恩与安静喜乐",
    labelEn: "Gratitude & Quiet Joy",
    noteZh: "停下来数算恩典，让心在感恩中沉静下来。",
    passages: [
      { bookId: "PSA", chapter: 103, verseRange: "1-5", titleZh: "诗篇 103:1-5 · 不可忘记他的一切恩惠" },
      { bookId: "PSA", chapter: 100, verseRange: "1-5", titleZh: "诗篇 100 篇 · 当称谢进入他的门" },
      { bookId: "1TH", chapter: 5, verseRange: "16-18", titleZh: "帖撒罗尼迦前书 5:16-18 · 常常喜乐，凡事谢恩" },
    ],
    recommendedPlanId: "esvpsalmsandwisdomliterature",
    audioMood: "quiet",
  },
];

/** 高频精选名篇（用于 sitemap 与 llms.txt 重点收录） */
export const FEATURED_CHAPTERS = [
  { bookId: "GEN", chapter: 1 },
  { bookId: "PSA", chapter: 1 },
  { bookId: "PSA", chapter: 23 },
  { bookId: "PSA", chapter: 46 },
  { bookId: "PSA", chapter: 91 },
  { bookId: "PSA", chapter: 121 },
  { bookId: "PRO", chapter: 3 },
  { bookId: "ECC", chapter: 3 },
  { bookId: "ISA", chapter: 40 },
  { bookId: "ISA", chapter: 53 },
  { bookId: "MAT", chapter: 5 },
  { bookId: "MAT", chapter: 6 },
  { bookId: "MAT", chapter: 11 },
  { bookId: "JHN", chapter: 1 },
  { bookId: "JHN", chapter: 3 },
  { bookId: "JHN", chapter: 10 },
  { bookId: "JHN", chapter: 14 },
  { bookId: "JHN", chapter: 15 },
  { bookId: "ROM", chapter: 8 },
  { bookId: "1CO", chapter: 13 },
  { bookId: "PHP", chapter: 4 },
  { bookId: "HEB", chapter: 11 },
  { bookId: "REV", chapter: 21 },
];

export function resolveBook(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const direct = CANON_BOOK_MAP.get(raw.toUpperCase());
  if (direct) return direct;
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[\s._-]+/g, "");
  return BOOK_ALIAS_INDEX.get(lower) || BOOK_ALIAS_INDEX.get(compact) || null;
}

export function resolveTranslation(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return TRANSLATION_ALIAS_INDEX.get(DEFAULT_TRANSLATION_ID);
  return TRANSLATION_ALIAS_INDEX.get(raw) || null;
}

export function parseVerseRange(rawRange) {
  const text = String(rawRange || "").trim();
  if (!text) return null;
  const single = text.match(/^(\d{1,3})$/);
  if (single) {
    const n = Number(single[1]);
    return n >= 1 ? { start: n, end: n } : null;
  }
  const range = text.match(/^(\d{1,3})\s*[-–—~:]\s*(\d{1,3})$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start >= 1 && end >= start) return { start, end };
  }
  return null;
}

/**
 * 构建跨端语义深链（Web HTTPS + 原生 askbible://）
 * 允许外部 AI 一键把用户带入对应章节、译本与「安静」伴读状态。
 */
export function buildEntryLink({
  bookId,
  chapter,
  verse,
  translation,
  audio,
  autoplay = false,
  origin = PRODUCT_ORIGIN,
}) {
  const book = resolveBook(bookId);
  if (!book) return null;
  const ch = Number(chapter);
  if (!Number.isInteger(ch) || ch < 1 || ch > book.chapters) return null;

  const params = new URLSearchParams();
  const tr = translation ? resolveTranslation(translation) : null;
  if (tr) params.set("t", tr.id);

  const parsedRange = verse !== undefined && verse !== null ? parseVerseRange(String(verse)) : null;
  if (parsedRange) {
    params.set("v", parsedRange.start === parsedRange.end ? String(parsedRange.start) : `${parsedRange.start}-${parsedRange.end}`);
  }

  if (audio === "quiet" || audio === "off") {
    params.set("audio", audio);
  }
  if (autoplay && audio === "quiet") {
    params.set("autoplay", "1");
  }

  const query = params.toString();
  const hash = parsedRange ? `#v${parsedRange.start}` : "";
  const path = `/read/${book.id}/${ch}${query ? `?${query}` : ""}${hash}`;
  const cleanOrigin = String(origin || PRODUCT_ORIGIN).replace(/\/+$/, "");

  return {
    bookId: book.id,
    bookZh: book.zh,
    bookEn: book.en,
    chapter: ch,
    verse: parsedRange ? (parsedRange.start === parsedRange.end ? String(parsedRange.start) : `${parsedRange.start}-${parsedRange.end}`) : null,
    translationId: tr?.id || DEFAULT_TRANSLATION_ID,
    audioMood: audio === "quiet" || audio === "off" ? audio : null,
    webUrl: `${cleanOrigin}${path}`,
    appUrl: `${APP_SCHEME}://read/${book.id}/${ch}${query ? `?${query}` : ""}${hash}`,
    markdownUrl: `${cleanOrigin}/read/${book.id}/${ch}.md${tr ? `?t=${tr.id}` : ""}`,
  };
}

export function matchQuietEntry(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return QUIET_ENTRIES[0];
  let best = null;
  let bestScore = 0;
  for (const entry of QUIET_ENTRIES) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += kw.length >= 2 ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best || QUIET_ENTRIES[0];
}
