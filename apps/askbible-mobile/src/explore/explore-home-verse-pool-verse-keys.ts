import { scriptureBooks } from "@/lib/bible/scripture-books";
import {
  getYearDayCountLeadRef,
  getYearDayCountScriptures,
} from "./year-day-count-refs";
import { getYearsDaysEternityZh } from "./years-days-eternity-content";
import type { YearsDaysEternityBlock } from "./years-days-eternity-types";

type WordOfGodCategory = {
  refs: string[];
};

type ParsedWordOfGodRef = {
  bookId: string;
  chapter: number;
  verseList: number[];
};

type RefVersePart = { chapter: number; start: number; end: number };

const WORD_OF_GOD_BOOK_ABBR_TO_ID: Record<string, string> = {
  创: "GEN",
  申: "DEU",
  书: "JOS",
  撒下: "2SA",
  王上: "1KI",
  诗: "PSA",
  箴: "PRO",
  传: "ECC",
  赛: "ISA",
  耶: "JER",
  亚: "ZEC",
  太: "MAT",
  可: "MRK",
  路: "LUK",
  约: "JHN",
  徒: "ACT",
  罗: "ROM",
  林前: "1CO",
  林后: "2CO",
  弗: "EPH",
  西: "COL",
  帖前: "1TH",
  提后: "2TI",
  来: "HEB",
  雅: "JAS",
  彼前: "1PE",
  彼后: "2PE",
  犹: "JUD",
  启: "REV",
};

// 与 wordOfGod bundle 分类一致，作为首页经文池可用来源。
const WORD_OF_GOD_CATEGORIES: WordOfGodCategory[] = [
  { refs: ["提后 3:16-17", "彼后 1:20-21", "帖前 2:13", "来 1:1-2", "亚 7:12"] },
  { refs: ["约 17:17", "诗 119:160", "诗 119:142", "诗 119:151", "约 10:35"] },
  { refs: ["赛 40:8", "太 24:35", "彼前 1:24-25", "诗 119:89", "诗 119:152"] },
  { refs: ["来 4:12", "耶 23:29", "赛 55:10-11", "路 1:37"] },
  { refs: ["创 1:3", "诗 33:6", "诗 33:9", "来 11:3", "彼后 3:5"] },
  { refs: ["约 6:63", "太 4:4", "申 8:3", "彼前 1:23", "雅 1:18"] },
  { refs: ["罗 10:17", "雅 1:21", "约 20:31", "提后 3:15", "徒 11:14"] },
  { refs: ["约 17:17", "约 15:3", "弗 5:26", "诗 119:9", "彼前 1:22"] },
  { refs: ["诗 119:105", "诗 119:130", "箴 6:23", "诗 19:8", "彼后 1:19"] },
  { refs: ["诗 19:7", "诗 119:98-100", "提后 3:15", "箴 2:6", "西 3:16"] },
  { refs: ["提后 3:16", "诗 19:7", "诗 119:11", "诗 119:67", "诗 119:71"] },
  { refs: ["太 4:4", "耶 15:16", "彼前 2:2", "来 5:12-14", "林前 3:2"] },
  { refs: ["弗 6:17", "来 4:12", "太 4:4,7,10", "启 19:15", "林后 10:4-5"] },
  { refs: ["罗 15:4", "诗 119:49-50", "诗 119:81", "诗 119:114", "帖前 4:18"] },
  { refs: ["诗 119:103", "耶 15:16", "诗 19:8", "诗 119:111", "诗 119:162"] },
  { refs: ["诗 12:6", "诗 18:30", "箴 30:5", "诗 119:140", "撒下 22:31"] },
  { refs: ["诗 19:7", "诗 18:30", "申 32:4", "诗 119:96", "雅 1:25"] },
  { refs: ["申 4:2", "申 12:32", "箴 30:6", "启 22:18-19"] },
  { refs: ["诗 119:11", "申 6:6-7", "西 3:16", "申 30:14", "诗 37:31"] },
  { refs: ["书 1:8", "诗 1:2", "诗 119:97", "诗 119:148", "诗 119:15"] },
  { refs: ["雅 1:22", "路 11:28", "太 7:24", "约 14:21", "约 14:23"] },
  { refs: ["提后 4:2", "可 16:15", "罗 10:14-15", "徒 6:7", "徒 12:24"] },
  { refs: ["提后 2:9", "徒 19:20", "徒 13:49"] },
  { refs: ["约 12:48", "来 4:12-13", "罗 2:16", "启 20:12"] },
  { refs: ["约 5:39", "路 24:27", "路 24:44-45", "约 1:1", "约 1:14"] },
  { refs: ["书 21:45", "书 23:14", "王上 8:56", "太 5:18", "路 21:33"] },
  { refs: ["约 8:31-32", "雅 1:25", "诗 119:45"] },
  { refs: ["徒 20:32", "犹 1:20", "西 2:6-7"] },
  { refs: ["罗 10:17", "约 4:41", "徒 4:4", "徒 18:8"] },
  { refs: ["来 4:12", "徒 2:37", "林前 14:24-25"] },
  {
    refs: [
      "诗 119:9",
      "诗 119:11",
      "诗 119:18",
      "诗 119:24",
      "诗 119:28",
      "诗 119:50",
      "诗 119:67",
      "诗 119:72",
      "诗 119:89",
      "诗 119:97",
      "诗 119:103",
      "诗 119:105",
      "诗 119:111",
      "诗 119:130",
      "诗 119:140",
      "诗 119:160",
      "诗 119:162",
      "诗 119:165",
    ],
  },
];

function verseKey(bookId: string, chapter: number, verse: number): string {
  return `${bookId}.${chapter}.${verse}`;
}

function parseVerseList(spec: string): number[] {
  const values: number[] = [];
  const parts = spec.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        for (let v = start; v <= end; v += 1) values.push(v);
      }
      continue;
    }
    const single = Number(part);
    if (Number.isInteger(single) && single >= 1) values.push(single);
  }
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function parseWordOfGodRef(raw: string): ParsedWordOfGodRef | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(.+?)\s+(\d+):([0-9,\-]+)$/);
  if (!m) return null;
  const abbr = m[1].trim();
  const chapter = Number(m[2]);
  const verseLabel = m[3].trim();
  const bookId = WORD_OF_GOD_BOOK_ABBR_TO_ID[abbr];
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  const verseList = parseVerseList(verseLabel);
  if (!verseList.length) return null;
  return { bookId, chapter, verseList };
}

function parseZhRefParts(ref: string): { bookId: string; parts: RefVersePart[] } | null {
  const normalized = ref.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(.+?)\s+(\d+):(.+)$/);
  if (!m) return null;
  const bookName = m[1]?.trim();
  const baseChapter = Number(m[2]);
  const tail = m[3]?.trim() ?? "";
  if (!bookName || !Number.isInteger(baseChapter) || baseChapter < 1 || !tail) return null;
  const bookId = scriptureBooks.find((b) => b.bookName === bookName)?.bookId;
  if (!bookId) return null;

  const parts: RefVersePart[] = [];
  const segments = tail.split(",").map((x) => x.trim()).filter(Boolean);
  for (const seg of segments) {
    let chapter = baseChapter;
    let verseSpec = seg;
    if (seg.includes(":")) {
      const cm = seg.match(/^(\d+):(.+)$/);
      if (!cm) continue;
      chapter = Number(cm[1]);
      verseSpec = cm[2]?.trim() ?? "";
    }
    if (!Number.isInteger(chapter) || chapter < 1 || !verseSpec) continue;
    const rm = verseSpec.match(/^(\d+)-(\d+)$/);
    if (rm) {
      const start = Number(rm[1]);
      const end = Number(rm[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        parts.push({ chapter, start, end });
      }
      continue;
    }
    const single = Number(verseSpec);
    if (Number.isInteger(single) && single >= 1) {
      parts.push({ chapter, start: single, end: single });
    }
  }
  if (!parts.length) return null;
  return { bookId, parts };
}

function collectWordOfGodVerseKeys(target: Set<string>) {
  for (const category of WORD_OF_GOD_CATEGORIES) {
    for (const ref of category.refs) {
      const parsed = parseWordOfGodRef(ref);
      if (!parsed) continue;
      for (const v of parsed.verseList) {
        target.add(verseKey(parsed.bookId, parsed.chapter, v));
      }
    }
  }
}

function collectYearDayCountVerseKeys(target: Set<string>) {
  const refs = [getYearDayCountLeadRef(), ...getYearDayCountScriptures()];
  for (const ref of refs) {
    const end = ref.verseEnd ?? ref.verseStart;
    for (let v = ref.verseStart; v <= end; v += 1) {
      target.add(verseKey(ref.bookId, ref.chapter, v));
    }
  }
}

function collectYearsDaysEternityVerseKeys(target: Set<string>) {
  const scriptureRefs: string[] = [];
  const collectBlockRef = (blocks: YearsDaysEternityBlock[]) => {
    for (const block of blocks) {
      if (block.type === "scripture") scriptureRefs.push(block.ref);
    }
  };
  const yearsDaysEternityZh = getYearsDaysEternityZh();
  collectBlockRef(yearsDaysEternityZh.intro);
  for (const section of yearsDaysEternityZh.sections) collectBlockRef(section.blocks);
  scriptureRefs.push(yearsDaysEternityZh.finale.scripture.ref);

  for (const rawRef of scriptureRefs) {
    const parsed = parseZhRefParts(rawRef);
    if (!parsed) continue;
    for (const part of parsed.parts) {
      for (let v = part.start; v <= part.end; v += 1) {
        target.add(verseKey(parsed.bookId, part.chapter, v));
      }
    }
  }
}

export function collectExploreHomeVersePoolVerseKeys(): Set<string> {
  const out = new Set<string>();
  collectWordOfGodVerseKeys(out);
  collectYearDayCountVerseKeys(out);
  collectYearsDaysEternityVerseKeys(out);
  return out;
}

export const EXPLORE_HOME_VERSE_POOL_VERSE_KEYS = collectExploreHomeVersePoolVerseKeys();
