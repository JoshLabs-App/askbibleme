import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { scriptureBooks, type ScriptureBook } from "@/lib/bible/scripture-books";

export type ParsedScriptureReference = {
  book: ScriptureBook;
  chapter: number;
  verse: number | null;
};

const ZH_SHORT_ALIASES: Array<[string, string]> = (
  [
    ["创", "GEN"], ["出", "EXO"], ["利", "LEV"], ["民", "NUM"], ["申", "DEU"],
    ["书", "JOS"], ["士", "JDG"], ["得", "RUT"], ["撒上", "1SA"], ["撒下", "2SA"],
    ["王上", "1KI"], ["王下", "2KI"], ["代上", "1CH"], ["代下", "2CH"], ["拉", "EZR"],
    ["尼", "NEH"], ["斯", "EST"], ["伯", "JOB"], ["诗", "PSA"], ["诗篇", "PSA"],
    ["箴", "PRO"], ["传", "ECC"], ["歌", "SNG"], ["赛", "ISA"], ["耶", "JER"],
    ["哀", "LAM"], ["结", "EZK"], ["但", "DAN"], ["何", "HOS"], ["珥", "JOL"],
    ["摩", "AMO"], ["俄", "OBA"], ["拿", "JON"], ["弥", "MIC"], ["鸿", "NAM"],
    ["哈", "HAB"], ["番", "ZEP"], ["该", "HAG"], ["亚", "ZEC"], ["玛", "MAL"],
    ["太", "MAT"], ["可", "MRK"], ["路", "LUK"], ["约", "JHN"], ["徒", "ACT"],
    ["罗", "ROM"], ["林前", "1CO"], ["林后", "2CO"], ["加", "GAL"], ["弗", "EPH"],
    ["腓", "PHP"], ["西", "COL"], ["帖前", "1TH"], ["帖后", "2TH"], ["提前", "1TI"],
    ["提后", "2TI"], ["多", "TIT"], ["门", "PHM"], ["来", "HEB"], ["雅", "JAS"],
    ["彼前", "1PE"], ["彼后", "2PE"], ["约一", "1JN"], ["约二", "2JN"], ["约三", "3JN"],
    ["犹", "JUD"], ["启", "REV"],
    ["創", "GEN"], ["詩", "PSA"], ["詩篇", "PSA"], ["傳", "ECC"], ["約", "JHN"],
    ["羅", "ROM"], ["林後", "2CO"], ["來", "HEB"], ["啟", "REV"],
    ["創世記", "GEN"], ["出埃及記", "EXO"], ["利未記", "LEV"], ["民數記", "NUM"], ["申命記", "DEU"],
    ["馬太福音", "MAT"], ["馬可福音", "MRK"], ["路加福音", "LUK"], ["約翰福音", "JHN"], ["使徒行傳", "ACT"],
    ["羅馬書", "ROM"], ["哥林多前書", "1CO"], ["哥林多後書", "2CO"], ["以弗所書", "EPH"], ["腓立比書", "PHP"],
    ["希伯來書", "HEB"], ["彼得前書", "1PE"], ["彼得後書", "2PE"], ["約翰一書", "1JN"], ["啟示錄", "REV"],
  ] as Array<[string, string]>
).sort((a, b) => b[0].length - a[0].length);

const EN_ALIASES: Array<[string, string]> = [
  ["gen", "GEN"], ["ex", "EXO"], ["exo", "EXO"], ["lev", "LEV"], ["num", "NUM"], ["deut", "DEU"], ["deu", "DEU"],
  ["josh", "JOS"], ["judg", "JDG"], ["ruth", "RUT"], ["1sam", "1SA"], ["2sam", "2SA"],
  ["1kgs", "1KI"], ["2kgs", "2KI"], ["1chr", "1CH"], ["2chr", "2CH"], ["ezra", "EZR"],
  ["neh", "NEH"], ["esth", "EST"], ["job", "JOB"], ["ps", "PSA"], ["psa", "PSA"], ["psalm", "PSA"],
  ["prov", "PRO"], ["pro", "PRO"], ["eccl", "ECC"], ["ecc", "ECC"], ["song", "SNG"],
  ["isa", "ISA"], ["jer", "JER"], ["lam", "LAM"], ["ezek", "EZK"], ["dan", "DAN"],
  ["hos", "HOS"], ["joel", "JOL"], ["amos", "AMO"], ["obad", "OBA"], ["jonah", "JON"],
  ["mic", "MIC"], ["nah", "NAM"], ["hab", "HAB"], ["zeph", "ZEP"], ["hag", "HAG"], ["zech", "ZEC"], ["mal", "MAL"],
  ["matt", "MAT"], ["mat", "MAT"], ["mt", "MAT"], ["mk", "MRK"], ["mrk", "MRK"], ["lk", "LUK"], ["luk", "LUK"],
  ["john", "JHN"], ["jn", "JHN"], ["jhn", "JHN"], ["acts", "ACT"], ["act", "ACT"],
  ["rom", "ROM"], ["1cor", "1CO"], ["2cor", "2CO"], ["gal", "GAL"], ["eph", "EPH"],
  ["phil", "PHP"], ["php", "PHP"], ["col", "COL"], ["1thess", "1TH"], ["2thess", "2TH"],
  ["1tim", "1TI"], ["2tim", "2TI"], ["titus", "TIT"], ["phlm", "PHM"], ["heb", "HEB"],
  ["jas", "JAS"], ["1pet", "1PE"], ["2pet", "2PE"], ["1jn", "1JN"], ["2jn", "2JN"], ["3jn", "3JN"],
  ["jude", "JUD"], ["rev", "REV"],
];

const PATTERN =
  /^\s*([1-3]?\s*[A-Za-z\u4e00-\u9fff]+?)\s*(?:第)?\s*([0-9]{1,3})\s*(?:章)?(?:\s*[:：.篇节節\s]\s*([0-9]{1,3}))?\s*(?:节|節)?\s*$/;

function matchBook(token: string): ScriptureBook | null {
  const clean = token.replace(/\s+/g, "").toLowerCase();
  const exact = scriptureBooks.find((b) => {
    const enName = getScriptureBookDisplayName(b.bookId, "en").replace(/\s+/g, "").toLowerCase();
    return b.bookName === token || enName === clean || b.bookId.toLowerCase() === clean;
  });
  if (exact) return exact;

  const zhHit = ZH_SHORT_ALIASES.find(([alias]) => alias === token);
  if (zhHit) {
    const b = scriptureBooks.find((x) => x.bookId === zhHit[1]);
    if (b) return b;
  }

  const enHit = EN_ALIASES.find(([alias]) => alias === clean);
  if (enHit) {
    const b = scriptureBooks.find((x) => x.bookId === enHit[1]);
    if (b) return b;
  }

  if (clean.length >= 2) {
    const pref = scriptureBooks.find((b) => {
      const enName = getScriptureBookDisplayName(b.bookId, "en").replace(/\s+/g, "").toLowerCase();
      return b.bookName.startsWith(token) || enName.startsWith(clean);
    });
    if (pref) return pref;
  }
  return null;
}

/**
 * 智能经文出处解析器（与 iOS / Android ScriptureReferenceParser 同构）：
 * 支持「约 3:16」「约翰福音 3章16节」「诗 23」「创 1:1」「John 3:16」「Ps 23」等输入。
 */
export function parseScriptureReference(raw: string): ParsedScriptureReference | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(PATTERN);
  if (!m) return null;
  const rawBook = (m[1] ?? "").trim();
  const ch = Number(m[2]);
  if (!Number.isInteger(ch) || ch < 1) return null;
  const verse = m[3] ? Number(m[3]) : null;
  if (verse !== null && (!Number.isInteger(verse) || verse < 1)) return null;
  const book = matchBook(rawBook);
  if (!book) return null;
  return {
    book,
    chapter: Math.min(ch, book.chapters),
    verse,
  };
}
