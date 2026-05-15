/**
 * OpenBible.info topic TSV 使用 OSIS 风格书卷缩写（如 Exod.、1Cor.、Ps.）。
 * 映射到本仓库 `scriptureBooks` / selah-bible-v1 使用的书卷 ID（大写）。
 */
const RAW_OSIS_TO_BOOK_ID: Record<string, string> = {
  Gen: "GEN",
  Ge: "GEN",
  Exod: "EXO",
  Exo: "EXO",
  Lev: "LEV",
  Num: "NUM",
  Deut: "DEU",
  Josh: "JOS",
  Judg: "JDG",
  Jdg: "JDG",
  Ruth: "RUT",
  "1Sam": "1SA",
  "2Sam": "2SA",
  "1Kgs": "1KI",
  "2Kgs": "2KI",
  "1Chr": "1CH",
  "2Chr": "2CH",
  Ezra: "EZR",
  Neh: "NEH",
  Esth: "EST",
  Est: "EST",
  Job: "JOB",
  Ps: "PSA",
  Pss: "PSA",
  Prov: "PRO",
  Prv: "PRO",
  Eccl: "ECC",
  Ecc: "ECC",
  Song: "SNG",
  Cant: "SNG",
  Isa: "ISA",
  Jer: "JER",
  Lam: "LAM",
  Ezek: "EZK",
  Eze: "EZK",
  Dan: "DAN",
  Hos: "HOS",
  Joel: "JOL",
  Amos: "AMO",
  Obad: "OBA",
  Jonah: "JON",
  Jon: "JON",
  Mic: "MIC",
  Nah: "NAM",
  Hab: "HAB",
  Zeph: "ZEP",
  Hag: "HAG",
  Zech: "ZEC",
  Mal: "MAL",
  Matt: "MAT",
  Mt: "MAT",
  Mark: "MRK",
  Mk: "MRK",
  Luke: "LUK",
  Lk: "LUK",
  John: "JHN",
  Jn: "JHN",
  Acts: "ACT",
  Rom: "ROM",
  "1Cor": "1CO",
  "2Cor": "2CO",
  Gal: "GAL",
  Eph: "EPH",
  Phil: "PHP",
  Col: "COL",
  "1Thess": "1TH",
  "2Thess": "2TH",
  "1Tim": "1TI",
  "2Tim": "2TI",
  Titus: "TIT",
  Tit: "TIT",
  Phlm: "PHM",
  Phm: "PHM",
  Heb: "HEB",
  Jas: "JAS",
  "1Pet": "1PE",
  "2Pet": "2PE",
  "1John": "1JN",
  "2John": "2JN",
  "3John": "3JN",
  Jude: "JUD",
  Rev: "REV",
};

/** 大小写不敏感查找 */
export const OPENBIBLE_OSIS_BOOK_MAP: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(RAW_OSIS_TO_BOOK_ID)) {
    out[k] = v;
    out[k.toLowerCase()] = v;
  }
  return out;
})();

export function lookupOpenbibleOsisBookToken(token: string): string | null {
  const t = token.trim().replace(/\.$/, "");
  if (!t) return null;
  const hit = OPENBIBLE_OSIS_BOOK_MAP[t] ?? OPENBIBLE_OSIS_BOOK_MAP[t.toLowerCase()];
  return hit ?? null;
}

/** 同一书卷、同一章内的 OSIS 片段（如 Exod.20.1-Exod.20.26 或 Phil.4.6）。跨书卷/跨章返回 null。 */
export function parseOpenbibleOsisToVerseSpan(osis: string): {
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
} | null {
  /** OpenBible TSV 常见 en dash，与解析正则中的 ASCII `-` 统一。 */
  const s = osis.trim().replace(/\u2013|\u2014/g, "-");
  const range = /^(\d?[A-Za-z]+)\.(\d+)\.(\d+)-(\d?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(s);
  if (range) {
    const b1 = lookupOpenbibleOsisBookToken(range[1]!);
    const b2 = lookupOpenbibleOsisBookToken(range[4]!);
    const c1 = Number(range[2]);
    const v1 = Number(range[3]);
    const c2 = Number(range[5]);
    const v2 = Number(range[6]!);
    if (!b1 || b1 !== b2 || !Number.isInteger(c1) || !Number.isInteger(c2) || c1 !== c2) return null;
    if (!Number.isInteger(v1) || !Number.isInteger(v2) || v1 < 1 || v2 < 1) return null;
    return { bookId: b1, chapter: c1, verseStart: Math.min(v1, v2), verseEnd: Math.max(v1, v2) };
  }
  const one = /^(\d?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(s);
  if (!one) return null;
  const b = lookupOpenbibleOsisBookToken(one[1]!);
  const c = Number(one[2]);
  const v = Number(one[3]);
  if (!b || !Number.isInteger(c) || !Number.isInteger(v) || c < 1 || v < 1) return null;
  return { bookId: b, chapter: c, verseStart: v, verseEnd: v };
}
