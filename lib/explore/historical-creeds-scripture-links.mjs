/**
 * Parse Westminster-style compact proof citations (罗一20，十12；徒十七24)
 * and emit readable labels + /read/ deep links.
 */
import { cnToArabicNumeral } from "./historical-creeds-text-cleanup.mjs";

/** [abbrev, bookId, bookNameZh] — longest abbrev first */
export const CREED_SCRIPTURE_BOOK_ABBREVS = [
  ["撒母耳记上", "1SA", "撒母耳记上"],
  ["撒母耳记下", "2SA", "撒母耳记下"],
  ["历代志上", "1CH", "历代志上"],
  ["历代志下", "2CH", "历代志下"],
  ["列王纪上", "1KI", "列王纪上"],
  ["列王纪下", "2KI", "列王纪下"],
  ["哥林多前书", "1CO", "哥林多前书"],
  ["哥林多后书", "2CO", "哥林多后书"],
  ["帖撒罗尼迦前书", "1TH", "帖撒罗尼迦前书"],
  ["帖撒罗尼迦后书", "2TH", "帖撒罗尼迦后书"],
  ["提摩太前书", "1TI", "提摩太前书"],
  ["提摩太后书", "2TI", "提摩太后书"],
  ["彼得前书", "1PE", "彼得前书"],
  ["彼得后书", "2PE", "彼得后书"],
  ["约翰一书", "1JN", "约翰一书"],
  ["约翰二书", "2JN", "约翰二书"],
  ["约翰三书", "3JN", "约翰三书"],
  ["约翰福音", "JHN", "约翰福音"],
  ["马太福音", "MAT", "马太福音"],
  ["马可福音", "MRK", "马可福音"],
  ["路加福音", "LUK", "路加福音"],
  ["使徒行传", "ACT", "使徒行传"],
  ["罗马书", "ROM", "罗马书"],
  ["腓立比书", "PHP", "腓立比书"],
  ["腓利门书", "PHM", "腓利门书"],
  ["加拉太书", "GAL", "加拉太书"],
  ["以弗所书", "EPH", "以弗所书"],
  ["歌罗西书", "COL", "歌罗西书"],
  ["希伯来书", "HEB", "希伯来书"],
  ["雅各书", "JAS", "雅各书"],
  ["犹大书", "JUD", "犹大书"],
  ["启示录", "REV", "启示录"],
  ["约壹", "1JN", "约翰一书"],
  ["约贰", "2JN", "约翰二书"],
  ["约叁", "3JN", "约翰三书"],
  ["約壹", "1JN", "约翰一书"],
  ["約贰", "2JN", "约翰二书"],
  ["約叁", "3JN", "约翰三书"],
  ["林前", "1CO", "哥林多前书"],
  ["林后", "2CO", "哥林多后书"],
  ["林後", "2CO", "哥林多后书"],
  ["帖前", "1TH", "帖撒罗尼迦前书"],
  ["帖后", "2TH", "帖撒罗尼迦后书"],
  ["帖後", "2TH", "帖撒罗尼迦后书"],
  ["彼前", "1PE", "彼得前书"],
  ["彼后", "2PE", "彼得后书"],
  ["彼後", "2PE", "彼得后书"],
  ["提前", "1TI", "提摩太前书"],
  ["提后", "2TI", "提摩太后书"],
  ["提後", "2TI", "提摩太后书"],
  ["撒上", "1SA", "撒母耳记上"],
  ["撒下", "2SA", "撒母耳记下"],
  ["王上", "1KI", "列王纪上"],
  ["王下", "2KI", "列王纪下"],
  ["代上", "1CH", "历代志上"],
  ["代后", "2CH", "历代志下"],
  ["代後", "2CH", "历代志下"],
  ["罗", "ROM", "罗马书"],
  ["羅", "ROM", "罗马书"],
  ["太", "MAT", "马太福音"],
  ["可", "MRK", "马可福音"],
  ["路", "LUK", "路加福音"],
  ["约", "JHN", "约翰福音"],
  ["約", "JHN", "约翰福音"],
  ["徒", "ACT", "使徒行传"],
  ["来", "HEB", "希伯来书"],
  ["來", "HEB", "希伯来书"],
  ["腓", "PHP", "腓立比书"],
  ["弗", "EPH", "以弗所书"],
  ["西", "COL", "歌罗西书"],
  ["加", "GAL", "加拉太书"],
  ["门", "PHM", "腓利门书"],
  ["多", "TIT", "提多书"],
  ["雅", "JAS", "雅各书"],
  ["犹", "JUD", "犹大书"],
  ["猶", "JUD", "犹大书"],
  ["启", "REV", "启示录"],
  ["啟", "REV", "启示录"],
  ["创", "GEN", "创世记"],
  ["創", "GEN", "创世记"],
  ["出", "EXO", "出埃及记"],
  ["利", "LEV", "利未记"],
  ["民", "NUM", "民数记"],
  ["申", "DEU", "申命记"],
  ["书", "JOS", "约书亚记"],
  ["書", "JOS", "约书亚记"],
  ["得", "RUT", "路得记"],
  ["拉", "EZR", "以斯拉记"],
  ["尼", "NEH", "尼希米记"],
  ["斯", "EST", "以斯帖记"],
  ["伯", "JOB", "约伯记"],
  ["诗", "PSA", "诗篇"],
  ["詩", "PSA", "诗篇"],
  ["箴", "PRO", "箴言"],
  ["传", "ECC", "传道书"],
  ["傳", "ECC", "传道书"],
  ["歌", "SNG", "雅歌"],
  ["赛", "ISA", "以赛亚书"],
  ["賽", "ISA", "以赛亚书"],
  ["耶", "JER", "耶利米书"],
  ["哀", "LAM", "耶利米哀歌"],
  ["结", "EZK", "以西结书"],
  ["結", "EZK", "以西结书"],
  ["但", "DAN", "但以理书"],
  ["何", "HOS", "何西阿书"],
  ["珥", "JOL", "约珥书"],
  ["摩", "AMO", "阿摩司书"],
  ["鸿", "NAM", "那鸿书"],
  ["鴻", "NAM", "那鸿书"],
  ["该", "HAG", "哈该书"],
  ["該", "HAG", "哈该书"],
  ["亚", "ZEC", "撒迦利亚书"],
  ["亞", "ZEC", "撒迦利亚书"],
  ["哈该书", "HAG", "哈该书"],
  ["哈", "HAG", "哈该书"],
  ["玛", "MAL", "玛拉基书"],
  ["瑪", "MAL", "玛拉基书"],
];

const CHAPTER_NUM_RE = /^([零一二三四五六七八九十百廿卅O〇]+)/;

function resolveBookPrefix(text) {
  for (const [abbrev, bookId, bookName] of CREED_SCRIPTURE_BOOK_ABBREVS) {
    if (text.startsWith(abbrev)) return { abbrev, bookId, bookName, len: abbrev.length };
  }
  return null;
}

function normalizeChapterToken(raw) {
  return String(raw).replace(/[O〇]/g, "0");
}

function parseVerseTokens(rest) {
  const cleaned = rest
    .replace(/[。．；;]+$/g, "")
    .replace(/[-—–]+[；;，,、]?$/g, "")
    .replace(/[、,]+$/g, "")
    .trim();
  if (!cleaned) return [{ verseStart: 1 }];

  const out = [];
  for (const piece of cleaned.split(/[、,]/)) {
    const p = piece.trim();
    if (!p) continue;
    const range = p.match(/^(\d+)-(\d+)$/);
    if (range) {
      out.push({ verseStart: Number(range[1]), verseEnd: Number(range[2]) });
      continue;
    }
    const single = p.match(/^(\d+)/);
    if (single) out.push({ verseStart: Number(single[1]) });
  }
  return out.length ? out : [{ verseStart: 1 }];
}

function formatRefLabel(bookName, chapter, verseStart, verseEnd) {
  if (verseEnd != null && verseEnd !== verseStart) {
    return `${bookName} ${chapter}:${verseStart}-${verseEnd}`;
  }
  return `${bookName} ${chapter}:${verseStart}`;
}

function readPath(bookId, chapter, verseStart) {
  return `/read/${bookId}/${chapter}?verse=${verseStart}`;
}

function parseChapterToken(raw) {
  const t = normalizeChapterToken(raw);
  if (/^\d+$/.test(t)) return Number(t);
  if (/0/.test(t)) {
    const digits = [];
    for (const ch of t) {
      if (ch === "0") digits.push("0");
      else {
        const n = cnToArabicNumeral(ch);
        if (n != null) digits.push(String(n));
      }
    }
    const n = Number(digits.join(""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Westminster compact chapters: 五九→59, 七三→73
  if (t.length === 2) {
    const tens = cnToArabicNumeral(t[0]);
    const ones = cnToArabicNumeral(t[1]);
    if (
      tens != null &&
      ones != null &&
      tens >= 1 &&
      tens <= 9 &&
      ones >= 0 &&
      ones <= 9 &&
      t[0] !== "十" &&
      t[1] !== "十"
    ) {
      return tens * 10 + ones;
    }
  }
  // Digit-concat chapters: 一一九→119, 一一〇→110 (〇 normalized to 0)
  const digitConcat = normalizeChapterToken(raw);
  if (
    digitConcat.length >= 2 &&
    /^[零0123456789一二三四五六七八九十百]+$/.test(digitConcat) &&
    !digitConcat.includes("十") &&
    !digitConcat.includes("百") &&
    !digitConcat.includes("廿") &&
    !digitConcat.includes("卅")
  ) {
    const parts = [...digitConcat].map((ch) => {
      if (ch === "0" || ch === "零") return 0;
      return cnToArabicNumeral(ch);
    });
    if (parts.every((n) => n != null && n >= 0 && n <= 9)) {
      const n = Number(parts.join(""));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return cnToArabicNumeral(t);
}

function parseChapterVerseToken(token, state) {
  const cleaned = token
    .replace(/[-—–]+[；;，,、]?$/g, "")
    .replace(/[、,]+$/g, "")
    .trim();
  if (!cleaned) return [];

  const chMatch = cleaned.match(CHAPTER_NUM_RE);
  if (!chMatch) return [];

  const chapter = parseChapterToken(chMatch[1]);
  if (chapter == null) return [];

  const versePart = cleaned.slice(chMatch[1].length);
  const verses = parseVerseTokens(versePart);
  return verses.map((v) => ({
    bookId: state.bookId,
    bookName: state.bookName,
    chapter,
    verseStart: v.verseStart,
    verseEnd: v.verseEnd,
    label: formatRefLabel(state.bookName, chapter, v.verseStart, v.verseEnd),
    href: readPath(state.bookId, chapter, v.verseStart),
  }));
}

function parseCitationToken(token, state) {
  const book = resolveBookPrefix(token);
  if (book) {
    state.bookId = book.bookId;
    state.bookName = book.bookName;
    return parseChapterVerseToken(token.slice(book.len), state);
  }
  return parseChapterVerseToken(token, state);
}

/** Parse one proof line body (without leading number). */
export function parseWcfProofCitationLine(line) {
  const state = { bookId: "", bookName: "" };
  const refs = [];
  const normalized = String(line)
    .replace(/[。．]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/[-—–]+(?=[；;，,、]|$)/g, "")
    .replace(/[；;]+[-—–，,、]+/g, "；");

  for (const segment of normalized.split(/[；;]/)) {
    if (!segment.trim()) continue;
    for (const part of segment.split(/[，,]/)) {
      const parsed = parseCitationToken(part.trim(), state);
      refs.push(...parsed);
    }
  }
  return refs;
}

export function formatWcfProofCitationLineAsLinks(line) {
  const refs = parseWcfProofCitationLine(line);
  if (!refs.length) return line.trim();
  return refs.map((r) => `[${r.label}](${r.href})`).join("；");
}

export function formatWcfProofItem(num, rawLine) {
  return `${num}. ${formatWcfProofCitationLineAsLinks(rawLine)}`;
}

export function parseProofBlockText(proofText) {
  const cleaned = String(proofText).replace(/-{5,}/g, "\n").trim();
  const items = [];
  let current = null;

  for (const line of cleaned.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const head = trimmed.match(/^(\d+)[\.．]\s*(.*)$/);
    if (head) {
      if (current) items.push(current);
      current = {
        num: head[1],
        raw: head[2].replace(/[。．]+\s*$/g, "").trim(),
      };
      continue;
    }
    if (current) {
      current.raw += trimmed.replace(/[。．]+\s*$/g, "");
    }
  }
  if (current) items.push(current);
  return items;
}

export function splitDoctrineAndInlineProofs(sectionText) {
  const m = String(sectionText).match(/^([\s\S]*?)(\s+\d+\.\s*[\u4e00-\u9fff][\s\S]*)$/);
  if (!m) return { doctrine: sectionText, inlineProof: "" };
  return { doctrine: m[1], inlineProof: m[2] };
}

/** Markdown read links: [label](/read/BOOK/ch?verse=v) */
export const CREED_READ_LINK_RE = /\[([^\]]+)\]\((\/read\/[A-Za-z0-9]{2,5}\/\d+(?:\?verse=\d+)?)\)/g;

export function splitCreedReadLinks(text) {
  const segments = [];
  let last = 0;
  for (const match of text.matchAll(CREED_READ_LINK_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      segments.push({ type: "text", text: text.slice(last, index) });
    }
    segments.push({ type: "link", text: match[1], href: match[2] });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  if (!segments.length) segments.push({ type: "text", text });
  return segments;
}

export function extractInlineProofTail(paragraph) {
  const m = String(paragraph).match(/^([\s\S]*?)(\s+\d+\.\s*[\u4e00-\u9fff][\s\S]+)$/);
  if (!m) return { body: paragraph, proofs: null };
  return { body: m[1].trim(), proofs: parseProofBlockText(m[2]) };
}

const ZH_BOOK_NAME_TO_ID = new Map(
  CREED_SCRIPTURE_BOOK_ABBREVS.map(([, bookId, bookName]) => [bookName, bookId]),
);

const ZH_FULL_BOOK_NAME_PATTERN = [...ZH_BOOK_NAME_TO_ID.keys()]
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

function linkRefLabel(label, href) {
  return `[${label}](${href})`;
}

function tryLinkCompactRefAt(text, index) {
  for (const [abbrev, bookId, bookName] of CREED_SCRIPTURE_BOOK_ABBREVS) {
    if (!text.startsWith(abbrev, index)) continue;
    const rest = text.slice(index + abbrev.length);
    const m = rest.match(/^([零一二三四五六七八九十百廿卅\d]+)[：:](\d+(?:-\d+)?)節?(?=[：:；;。，、\s"“"'’\]]|$)/);
    if (!m) continue;
    const chapter = parseChapterToken(m[1]);
    if (chapter == null || chapter < 1) continue;
    const verseParts = m[2].includes("-") ? m[2].split("-").map(Number) : [Number(m[2])];
    const verseStart = verseParts[0];
    const verseEnd = verseParts[1];
    if (!Number.isFinite(verseStart) || verseStart < 1) continue;
    const label = formatRefLabel(bookName, chapter, verseStart, verseEnd);
    const rawLen = abbrev.length + m[0].length + (rest.slice(m[0].length).startsWith("節") ? 1 : 0);
    return { linked: linkRefLabel(label, readPath(bookId, chapter, verseStart)), rawLen };
  }
  return null;
}

/** Link compact refs: 申6：4、林前8：6、代上29：10-12 */
export function linkifyCompactChineseRefs(text) {
  let out = "";
  let i = 0;
  const src = String(text);
  while (i < src.length) {
    const hit = tryLinkCompactRefAt(src, i);
    if (hit) {
      out += hit.linked;
      i += hit.rawLen;
    } else {
      out += src[i];
      i += 1;
    }
  }
  return out;
}

const WCF_CHAPTER_VERSE_RE =
  /^([零一二三四五六七八九十百廿卅O〇\d]{1,4})(\d{1,3}(?:-\d{1,3})?(?:[、,]\d{1,3}(?:-\d{1,3})?)*)/;

function measureWcfChapterVerseLen(rest) {
  const m = String(rest).match(WCF_CHAPTER_VERSE_RE);
  return m ? m[0].length : 0;
}

function tryLinkWcfCompactAt(text, index, state) {
  const slice = text.slice(index);
  let footLen = 0;
  const foot = slice.match(/^(\d{1,2})/);
  if (foot) {
    const afterFoot = slice.slice(foot[0].length);
    if (resolveBookPrefix(afterFoot)) footLen = foot[0].length;
  }

  const sub = slice.slice(footLen);
  const book = resolveBookPrefix(sub);
  let rawLen = 0;
  let refs = [];

  if (book) {
    const rest = sub.slice(book.len);
    const cvLen = measureWcfChapterVerseLen(rest);
    if (!cvLen) return null;
    rawLen = book.len + cvLen;
    refs = parseCitationToken(sub.slice(0, rawLen), state);
  } else if (state.bookId) {
    const cvLen = measureWcfChapterVerseLen(sub);
    if (!cvLen) return null;
    rawLen = cvLen;
    refs = parseChapterVerseToken(sub.slice(0, rawLen), state);
  } else {
    return null;
  }

  if (!refs.length) return null;
  return {
    linked: refs.map((r) => linkRefLabel(r.label, r.href)).join("；"),
    length: footLen + rawLen,
  };
}

/** Link Westminster compact refs without colon: 罗一19-20、诗十九1、赛五九21 */
export function linkifyWcfCompactRefs(text) {
  const src = String(text);
  const state = { bookId: "", bookName: "" };
  let out = "";
  let i = 0;

  while (i < src.length) {
    const mdLink = src.slice(i).match(/^\[[^\]]+\]\([^)]+\)/);
    if (mdLink) {
      out += mdLink[0];
      i += mdLink[0].length;
      continue;
    }

    const hit = tryLinkWcfCompactAt(src, i, state);
    if (hit) {
      out += hit.linked;
      i += hit.length;
      while (/^[；;，,、]/.test(src[i] ?? "")) {
        out += src[i];
        i += 1;
      }
      continue;
    }

    const ch = src[i];
    if (ch === "。" || ch === "．") {
      state.bookId = "";
      state.bookName = "";
    }
    out += ch;
    i += 1;
  }

  return out;
}

function protectMarkdownLinks(text, transform) {
  const chunks = [];
  const protectedText = String(text).replace(/\[[^\]]+\]\([^)]+\)/g, (match) => {
    chunks.push(match);
    return `\x00MD${chunks.length - 1}\x00`;
  });
  const transformed = transform(protectedText);
  return transformed.replace(/\x00MD(\d+)\x00/g, (_, indexRaw) => chunks[Number(indexRaw)] ?? _);
}

function linkFullNameColonRefs(text) {
  const re = new RegExp(
    `(${ZH_FULL_BOOK_NAME_PATTERN})\\s+(\\d+)[：:](\\d+(?:-\\d+)?)`,
    "g",
  );
  return text.replace(re, (full, bookName, ch, vs) => {
    const bookId = ZH_BOOK_NAME_TO_ID.get(bookName);
    if (!bookId) return full;
    const verse = vs.includes("-") ? vs.split("-")[0] : vs;
    return linkRefLabel(`${bookName} ${ch}:${vs}`, readPath(bookId, Number(ch), Number(verse)));
  });
}

function linkParentheticalRefs(text) {
  return text.replace(/（([^）]+)）/g, (full, inner) => {
    if (inner.includes("](/read/")) return full;
    const linked = inner
      .split(/[；;]/)
      .map((part) => {
        const trimmed = linkifyCompactChineseRefs(part.trim());
        const m = trimmed.match(/^([\u4e00-\u9fff·]{2,14})\s+(\d+)[：:](\d+(?:-\d+)?)$/);
        if (!m || trimmed.includes("](/read/")) return trimmed;
        const bookId = ZH_BOOK_NAME_TO_ID.get(m[1]);
        if (!bookId) return trimmed;
        const verse = m[3].includes("-") ? m[3].split("-")[0] : m[3];
        return linkRefLabel(`${m[1]} ${m[2]}:${m[3]}`, readPath(bookId, Number(m[2]), Number(verse)));
      })
      .join("；");
    return linked === inner ? full : `（${linked}）`;
  });
}

/** Link （以弗所书 2:8）、罗马书 3:19、申6：4 等中文经文出处。 */
export function linkifyNormalizedChineseRefs(text) {
  return protectMarkdownLinks(text, (draft) => {
    let t = linkFullNameColonRefs(draft);
    t = linkifyCompactChineseRefs(t);
    t = linkifyWcfCompactRefs(t);
    t = linkParentheticalRefs(t);
    return t;
  });
}
