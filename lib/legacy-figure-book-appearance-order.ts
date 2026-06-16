import { scriptureBooks } from "@/lib/bible/scripture-books";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

type FigureAppearanceProfile = {
  id: string;
  displayNameZh: string;
  aliasesZh: string[];
  scripturePersonalityZh: string;
  article: {
    title: string;
    summary: string;
    body: string;
  } | null;
};

/** 各卷叙事中出现顺序（源自 AskOLD primaryCharactersByBook，已校正拆分后的犹大）。 */
export const LEGACY_FIGURE_BOOK_APPEARANCE_ORDER: Partial<Record<string, readonly string[]>> = {
  GEN: ["亚当", "夏娃", "亚伯拉罕", "撒拉", "以撒", "利百加", "族长·雅各", "旧约·犹大", "创世·约瑟", "约瑟·法老"],
  EXO: ["摩西", "亚伦", "米利暗", "出埃及·法老"],
  LEV: ["摩西", "亚伦"],
  NUM: ["摩西", "亚伦", "米利暗", "约书亚", "迦勒", "巴兰"],
  DEU: ["摩西", "约书亚"],
  JOS: ["约书亚", "喇合", "迦勒"],
  JDG: ["底波拉", "基甸", "参孙"],
  RUT: ["路得", "拿俄米", "波阿斯"],
  "1SA": ["撒母耳", "扫罗", "大卫", "约拿单"],
  "2SA": ["大卫", "押沙龙", "拿单"],
  "1KI": ["所罗门", "以利亚", "亚哈", "耶洗别"],
  "2KI": ["以利沙", "希西家", "约西亚"],
  "1CH": ["大卫"],
  "2CH": ["所罗门", "罗波安", "亚撒", "约沙法", "希西家", "约西亚"],
  EZR: ["以斯拉", "所罗巴伯"],
  NEH: ["尼希米", "以斯拉"],
  EST: ["以斯帖", "末底改", "哈曼"],
  JOB: ["约伯"],
  PSA: ["大卫"],
  PRO: ["所罗门"],
  ECC: ["所罗门"],
  SNG: ["所罗门", "书拉密女"],
  ISA: ["以赛亚", "希西家"],
  JER: ["耶利米", "巴录", "西底家"],
  LAM: ["耶利米"],
  EZK: ["以西结"],
  DAN: ["但以理", "尼布甲尼撒", "伯沙撒"],
  HOS: ["何西阿", "歌篾"],
  JOL: ["约珥"],
  AMO: ["阿摩司"],
  OBA: ["俄巴底亚"],
  JON: ["约拿"],
  MIC: ["弥迦"],
  NAM: ["那鸿"],
  HAB: ["哈巴谷"],
  ZEP: ["西番雅"],
  HAG: ["哈该", "所罗巴伯", "约书亚大祭司"],
  ZEC: ["先知·撒迦利亚", "约书亚大祭司", "所罗巴伯"],
  MAL: ["玛拉基"],
  MAT: ["耶稣", "马利亚", "福音·约瑟", "施洗约翰", "彼得", "卖主的犹大"],
  MRK: ["耶稣", "彼得", "施洗约翰", "卖主的犹大"],
  LUK: ["耶稣", "路加·撒迦利亚", "伊利莎白", "马利亚", "福音·约瑟", "施洗约翰", "彼得", "卖主的犹大"],
  JHN: ["耶稣", "施洗约翰", "彼得", "约翰", "马大", "马利亚", "拉撒路", "卖主的犹大"],
  ACT: ["彼得", "司提反", "腓利", "保罗", "巴拿巴", "雅各书·雅各", "卖主的犹大"],
  ROM: ["保罗"],
  "1CO": ["保罗"],
  "2CO": ["保罗"],
  GAL: ["保罗"],
  EPH: ["保罗"],
  PHP: ["保罗"],
  COL: ["保罗"],
  "1TH": ["保罗"],
  "2TH": ["保罗"],
  "1TI": ["保罗", "提摩太"],
  "2TI": ["保罗", "提摩太"],
  TIT: ["保罗", "提多"],
  PHM: ["保罗", "腓利门", "阿尼西母"],
  HEB: [],
  JAS: ["雅各书·雅各"],
  "1PE": ["彼得"],
  "2PE": ["彼得"],
  "1JN": ["约翰"],
  "2JN": ["约翰"],
  "3JN": ["约翰"],
  JUD: ["犹大书·犹大"],
  REV: ["约翰", "耶稣"],
};

/** profile.id → 在该卷顺序表中的名字（顺序表里没有 id 时用）。 */
const LEGACY_FIGURE_ID_ORDER_ALIAS: Partial<Record<string, Partial<Record<string, string>>>> = {
  GEN: {
    "judah-ot": "旧约·犹大",
    "jacob-patriarch": "族长·雅各",
    "joseph-genesis": "创世·约瑟",
    "pharaoh-joseph": "约瑟·法老",
  },
  EXO: { "pharaoh-exodus": "出埃及·法老" },
  ZEC: { "zechariah-prophet": "先知·撒迦利亚" },
  LUK: { "zechariah-luke": "路加·撒迦利亚", "judas-iscariot": "卖主的犹大" },
  MAT: { "joseph-gospel": "福音·约瑟", "judas-iscariot": "卖主的犹大" },
  MRK: { "judas-iscariot": "卖主的犹大" },
  JHN: { "judas-iscariot": "卖主的犹大", "figure-约翰": "约翰", "约翰": "约翰" },
  ACT: { "james-apostle": "雅各书·雅各", "judas-iscariot": "卖主的犹大" },
  JUD: { "jude-author": "犹大书·犹大" },
  JAS: { "james-apostle": "雅各书·雅各" },
};

const UNKNOWN_ORDER_BASE = 50_000;
const CHAPTER_SCALE = 1_000;
const MAX_VERSE = 176;

/** 文章里匹配书卷名时用的别名（含常见简称）。 */
const BOOK_REFERENCE_LABELS: Partial<Record<string, readonly string[]>> = {
  GEN: ["创"],
  EXO: ["出"],
  LEV: ["利"],
  NUM: ["民"],
  DEU: ["申"],
  JOS: ["书"],
  JDG: ["士"],
  RUT: ["得"],
  "1SA": ["撒上"],
  "2SA": ["撒下"],
  "1KI": ["王上"],
  "2KI": ["王下"],
  "1CH": ["代上"],
  "2CH": ["代下"],
  EZR: ["拉"],
  NEH: ["尼"],
  EST: ["斯"],
  JOB: ["伯"],
  PSA: ["诗"],
  PRO: ["箴"],
  ECC: ["传"],
  SNG: ["歌"],
  ISA: ["赛"],
  JER: ["耶"],
  LAM: ["哀"],
  EZK: ["结"],
  DAN: ["但"],
  HOS: ["何"],
  JOL: ["珥"],
  AMO: ["摩"],
  OBA: ["俄"],
  JON: ["拿"],
  MIC: ["弥"],
  NAM: ["鸿"],
  HAB: ["哈"],
  ZEP: ["番"],
  HAG: ["该"],
  ZEC: ["亚"],
  MAL: ["玛"],
  MAT: ["太"],
  MRK: ["可"],
  LUK: ["路"],
  JHN: ["约"],
  ACT: ["徒"],
  ROM: ["罗"],
  "1CO": ["林前"],
  "2CO": ["林后"],
  GAL: ["加"],
  EPH: ["弗"],
  PHP: ["腓"],
  COL: ["西"],
  "1TH": ["帖前"],
  "2TH": ["帖后"],
  "1TI": ["提前"],
  "2TI": ["提后"],
  TIT: ["多"],
  PHM: ["门"],
  HEB: ["来"],
  JAS: ["雅"],
  "1PE": ["彼前"],
  "2PE": ["彼后"],
  "1JN": ["约一"],
  "2JN": ["约二"],
  "3JN": ["约三"],
  JUD: ["犹"],
  REV: ["启"],
};

/** 文章无法推断时，按经卷记载的首次出现章、节（profile.id → bookId）。 */
const LEGACY_FIGURE_DEBUT_IN_BOOK: Partial<
  Record<string, Partial<Record<string, ScriptureMention>>>
> = {
  jesus: {
    MRK: { chapter: 1, verse: 1 },
    JHN: { chapter: 1, verse: 1 },
    REV: { chapter: 1, verse: 1 },
  },
  "mary-mother-of-jesus": {
    JHN: { chapter: 2, verse: 1 },
  },
  "john-the-baptist": {
    JHN: { chapter: 1, verse: 6 },
    MRK: { chapter: 1, verse: 4 },
  },
  peter: {
    MRK: { chapter: 1, verse: 16 },
    LUK: { chapter: 5, verse: 1 },
    "1PE": { chapter: 1, verse: 1 },
    "2PE": { chapter: 1, verse: 1 },
  },
  "judas-iscariot": {
    MRK: { chapter: 3, verse: 19 },
    LUK: { chapter: 6, verse: 16 },
  },
  moses: {
    LEV: { chapter: 1, verse: 1 },
    DEU: { chapter: 1, verse: 1 },
  },
  aaron: {
    LEV: { chapter: 8, verse: 2 },
    NUM: { chapter: 1, verse: 17 },
  },
  joshua: {
    NUM: { chapter: 13, verse: 8 },
  },
  david: {
    "1CH": { chapter: 2, verse: 15 },
    PSA: { chapter: 3, verse: 1 },
  },
  rehoboam: {
    "2CH": { chapter: 10, verse: 1 },
  },
  solomon: {
    "2CH": { chapter: 1, verse: 1 },
    PRO: { chapter: 1, verse: 1 },
    ECC: { chapter: 1, verse: 1 },
    SNG: { chapter: 1, verse: 1 },
  },
  hezekiah: {
    "2CH": { chapter: 29, verse: 1 },
  },
  jeremiah: {
    LAM: { chapter: 1, verse: 1 },
  },
  nebuchadnezzar: {
    DAN: { chapter: 1, verse: 1 },
  },
  zerubbabel: {
    HAG: { chapter: 1, verse: 1 },
  },
  "joshua-the-high-priest": {
    ZEC: { chapter: 3, verse: 1 },
  },
  paul: {
    "2CO": { chapter: 1, verse: 1 },
    EPH: { chapter: 1, verse: 1 },
    COL: { chapter: 1, verse: 1 },
    "1TH": { chapter: 1, verse: 1 },
    "2TH": { chapter: 1, verse: 1 },
    "1TI": { chapter: 1, verse: 1 },
    "2TI": { chapter: 1, verse: 1 },
    TIT: { chapter: 1, verse: 1 },
    PHM: { chapter: 1, verse: 1 },
  },
  约翰: {
    "2JN": { chapter: 1, verse: 1 },
    "3JN": { chapter: 1, verse: 1 },
  },
};

type ScriptureMention = { chapter: number; verse: number };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bookReferenceLabelsForBook(bookId: string): string[] {
  const book = scriptureBooks.find((item) => item.bookId === bookId);
  if (!book) return [];

  const labels = new Set<string>([book.bookName]);
  for (const alias of BOOK_REFERENCE_LABELS[bookId] ?? []) {
    labels.add(alias);
  }
  for (const label of [...labels]) {
    labels.add(toZhTwText(label));
  }
  return [...labels];
}

function extractDebutSection(text: string): string | null {
  const match = text.match(/##\s*[二2][、.]?\s*人物首次出现\s*\n([\s\S]*?)(?=\n##\s|$)/u);
  return match?.[1]?.trim() ?? null;
}

function findScriptureMentionsInText(text: string, labels: readonly string[]): ScriptureMention[] {
  const mentions: ScriptureMention[] = [];

  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const patterns = [
      new RegExp(`${escaped}\\s*(\\d+)\\s*[:：]\\s*(\\d+)`, "gu"),
      new RegExp(`《${escaped}》\\s*第?\\s*(\\d+)\\s*章(?:\\s*(\\d+)\\s*节)?`, "gu"),
      new RegExp(`《${escaped}》\\s*(\\d+)\\s*[:：]\\s*(\\d+)`, "gu"),
      new RegExp(`${escaped}\\s*第?\\s*(\\d+)\\s*章`, "gu"),
      new RegExp(`《${escaped}》\\s*(\\d+)\\s*章`, "gu"),
    ];

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const chapter = Number.parseInt(match[1]!, 10);
        const verse = match[2] ? Number.parseInt(match[2], 10) : 0;
        if (!Number.isFinite(chapter) || chapter < 1) continue;
        mentions.push({
          chapter,
          verse: Number.isFinite(verse) && verse >= 1 ? Math.min(verse, MAX_VERSE) : 1,
        });
      }
    }
  }

  return mentions;
}

function pickEarliestScriptureMention(mentions: ScriptureMention[]): ScriptureMention | null {
  if (!mentions.length) return null;

  return mentions.reduce((best, mention) => {
    if (mention.chapter < best.chapter) return mention;
    if (mention.chapter > best.chapter) return best;
    return mention.verse < best.verse ? mention : best;
  });
}

/** 从文章推断人物在该卷首次出现的章、节（优先「人物首次出现」一节）。 */
export function extractScriptureMentionInBook(
  profile: FigureAppearanceProfile,
  bookId: string,
): ScriptureMention | null {
  const canonical = LEGACY_FIGURE_DEBUT_IN_BOOK[profile.id]?.[bookId];
  if (canonical) return canonical;

  const labels = bookReferenceLabelsForBook(bookId);
  if (!labels.length) return null;

  const text = [
    profile.article?.body,
    profile.article?.summary,
    profile.scripturePersonalityZh,
  ]
    .filter(Boolean)
    .join("\n");
  if (!text) return null;

  const debutSection = extractDebutSection(text);
  if (debutSection) {
    const debutMention = pickEarliestScriptureMention(
      findScriptureMentionsInText(debutSection, labels),
    );
    if (debutMention) return debutMention;
  }

  return pickEarliestScriptureMention(findScriptureMentionsInText(text, labels));
}


function scriptureMentionSortKey(mention: ScriptureMention): number {
  return mention.chapter * CHAPTER_SCALE + mention.verse;
}

function stripFigureDisplayPrefix(name: string): string {
  return name
    .trim()
    .replace(/^(旧约·|犹大书·|卖主的|出埃及·|约瑟·|创世·|福音·|先知·|路加·|族长·|雅各书·)/, "");
}

function profileNameCandidates(profile: FigureAppearanceProfile, bookId: string): string[] {
  const idAlias = LEGACY_FIGURE_ID_ORDER_ALIAS[bookId]?.[profile.id];
  const raw = [
    idAlias,
    profile.displayNameZh,
    stripFigureDisplayPrefix(profile.displayNameZh),
    ...profile.aliasesZh,
    profile.article?.title.split("：")[0]?.trim(),
  ].filter(Boolean) as string[];

  return [...new Set(raw.map((name) => name.trim()).filter(Boolean))];
}

function orderIndexForName(name: string, orderList: readonly string[]): number | null {
  const normalized = name.trim();
  if (!normalized) return null;

  const exact = orderList.indexOf(normalized);
  if (exact >= 0) return exact;

  const stripped = stripFigureDisplayPrefix(normalized);
  const strippedIndex = orderList.indexOf(stripped);
  if (strippedIndex >= 0) return strippedIndex;

  return null;
}

/** 正典顺序下，该人物首次有叙事出现的书卷（据文章章节引用推断）。 */
export function findLegacyFigureFirstAppearanceBookId(
  profile: FigureAppearanceProfile & { primaryBookId?: string },
): string | null {
  let best: { bookNumber: number; bookId: string; sortKey: number } | null = null;

  for (const book of scriptureBooks) {
    const mention = extractScriptureMentionInBook(profile, book.bookId);
    if (!mention) continue;

    const sortKey = scriptureMentionSortKey(mention);
    if (
      !best
      || book.bookNumber < best.bookNumber
      || (book.bookNumber === best.bookNumber && sortKey < best.sortKey)
    ) {
      best = { bookNumber: book.bookNumber, bookId: book.bookId, sortKey };
    }
  }

  if (best) return best.bookId;

  const primaryBookId = profile.primaryBookId?.trim().toUpperCase();
  if (primaryBookId) return primaryBookId;

  return null;
}

export function figureMatchesBookPrimaryCast(
  profile: FigureAppearanceProfile,
  bookId: string,
): boolean {
  const orderList = LEGACY_FIGURE_BOOK_APPEARANCE_ORDER[bookId] ?? [];
  if (!orderList.length) return false;

  return profileNameCandidates(profile, bookId).some(
    (name) => orderIndexForName(name, orderList) !== null,
  );
}

/**
 * 人物应出现在哪些书卷：
 * 1) 首次出现的书卷（必有）
 * 2) 在该卷叙事中仍属主人物的书卷（见 LEGACY_FIGURE_BOOK_APPEARANCE_ORDER）
 */
export function resolveLegacyFigureDisplayBookIds(
  profile: FigureAppearanceProfile & { primaryBookId?: string },
): string[] {
  const bookSet = new Set<string>();

  const firstBookId = findLegacyFigureFirstAppearanceBookId(profile);
  if (firstBookId) bookSet.add(firstBookId);

  for (const book of scriptureBooks) {
    if (figureMatchesBookPrimaryCast(profile, book.bookId)) {
      bookSet.add(book.bookId);
    }
  }

  if (!bookSet.size && profile.primaryBookId) {
    bookSet.add(profile.primaryBookId.trim().toUpperCase());
  }

  return scriptureBooks.map((book) => book.bookId).filter((bookId) => bookSet.has(bookId));
}

/** 本卷时间线排序：纯按章、节先后；主、次人物混排。 */
export function legacyFigureAppearanceSortKey(
  profile: FigureAppearanceProfile,
  bookId: string,
): number {
  const mention = extractScriptureMentionInBook(profile, bookId);
  if (mention) return scriptureMentionSortKey(mention);
  return UNKNOWN_ORDER_BASE;
}

export function sortLegacyFiguresByBookAppearance<T extends FigureAppearanceProfile>(
  profiles: T[],
  bookId: string,
): T[] {
  const keyed = profiles.map((profile) => ({
    profile,
    key: legacyFigureAppearanceSortKey(profile, bookId),
  }));

  keyed.sort((left, right) => {
    const rankDiff = left.key - right.key;
    if (rankDiff !== 0) return rankDiff;
    return left.profile.id.localeCompare(right.profile.id);
  });

  return keyed.map(({ profile }) => profile);
}
