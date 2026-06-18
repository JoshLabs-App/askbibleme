/**
 * Cleans historical-creed Chinese body text: interior wrap spaces + scripture citations.
 * Shared by scripts/build-historical-creed-bodies.mjs and the app display layer (.ts re-export).
 */

const CJK = "\\u4e00-\\u9fff\\u3400-\\u4dbf";

/** Longest abbrev / name first */
const ZH_BOOK_REF_PREFIXES = [
  ["腓立比书", "腓立比书"],
  ["哥林多前书", "哥林多前书"],
  ["哥林多后书", "哥林多后书"],
  ["帖撒罗尼迦前书", "帖撒罗尼迦前书"],
  ["帖撒罗尼迦后书", "帖撒罗尼迦后书"],
  ["约翰一书", "约翰一书"],
  ["约翰二书", "约翰二书"],
  ["约翰三书", "约翰三书"],
  ["撒母耳记上", "撒母耳记上"],
  ["撒母耳记下", "撒母耳记下"],
  ["罗马书", "罗马书"],
  ["羅馬書", "罗马书"],
  ["马太福音", "马太福音"],
  ["马可福音", "马可福音"],
  ["路加福音", "路加福音"],
  ["约翰福音", "约翰福音"],
  ["使徒行传", "使徒行传"],
  ["创世记", "创世记"],
  ["出埃及记", "出埃及记"],
  ["利未记", "利未记"],
  ["民数记", "民数记"],
  ["申命记", "申命记"],
  ["约书亚记", "约书亚记"],
  ["士师记", "士师记"],
  ["撒母耳记", "撒母耳记"],
  ["列王纪", "列王纪"],
  ["历代志", "历代志"],
  ["以斯拉记", "以斯拉记"],
  ["尼希米记", "尼希米记"],
  ["以斯帖记", "以斯帖记"],
  ["约伯记", "约伯记"],
  ["传道书", "传道书"],
  ["雅歌", "雅歌"],
  ["以赛亚书", "以赛亚书"],
  ["耶利米书", "耶利米书"],
  ["耶利米哀歌", "耶利米哀歌"],
  ["以西结书", "以西结书"],
  ["但以理书", "但以理书"],
  ["何西阿书", "何西阿书"],
  ["约珥书", "约珥书"],
  ["阿摩司书", "阿摩司书"],
  ["俄巴底亚书", "俄巴底亚书"],
  ["约拿书", "约拿书"],
  ["弥迦书", "弥迦书"],
  ["那鸿书", "那鸿书"],
  ["哈巴谷书", "哈巴谷书"],
  ["西番雅书", "西番雅书"],
  ["哈该书", "哈该书"],
  ["撒迦利亚书", "撒迦利亚书"],
  ["玛拉基书", "玛拉基书"],
  ["加拉太书", "加拉太书"],
  ["以弗所书", "以弗所书"],
  ["歌罗西书", "歌罗西书"],
  ["提摩太前书", "提摩太前书"],
  ["提摩太后书", "提摩太后书"],
  ["提多书", "提多书"],
  ["腓利门书", "腓利门书"],
  ["希伯来书", "希伯来书"],
  ["雅各书", "雅各书"],
  ["彼得前书", "彼得前书"],
  ["彼得后书", "彼得后书"],
  ["犹大书", "犹大书"],
  ["启示录", "启示录"],
  ["约壹", "约翰一书"],
  ["约贰", "约翰二书"],
  ["约叁", "约翰三书"],
  ["約壹", "约翰一书"],
  ["約贰", "约翰二书"],
  ["約叁", "约翰三书"],
  ["林前", "哥林多前书"],
  ["林后", "哥林多后书"],
  ["帖前", "帖撒罗尼迦前书"],
  ["帖后", "帖撒罗尼迦后书"],
  ["彼前", "彼得前书"],
  ["彼后", "彼得后书"],
  ["提前", "提摩太前书"],
  ["提后", "提摩太后书"],
  ["来", "希伯来书"],
  ["腓", "腓立比书"],
  ["罗", "罗马书"],
  ["羅", "罗马书"],
  ["太", "马太福音"],
  ["可", "马可福音"],
  ["路", "路加福音"],
  ["约", "约翰福音"],
  ["約", "约翰福音"],
  ["徒", "使徒行传"],
  ["创", "创世记"],
  ["出", "出埃及记"],
  ["利", "利未记"],
  ["民", "民数记"],
  ["申", "申命记"],
  ["诗", "诗篇"],
  ["箴", "箴言"],
  ["传", "传道书"],
  ["赛", "以赛亚书"],
  ["耶", "耶利米书"],
  ["结", "以西结书"],
  ["但", "但以理书"],
  ["何", "何西阿书"],
  ["珥", "约珥书"],
  ["摩", "阿摩司书"],
  ["鸿", "那鸿书"],
  ["该", "哈该书"],
  ["亚", "撒迦利亚书"],
  ["玛", "玛拉基书"],
  ["加", "加拉太书"],
  ["弗", "以弗所书"],
  ["西", "歌罗西书"],
  ["多", "提多书"],
  ["门", "腓利门书"],
  ["雅", "雅各书"],
  ["犹", "犹大书"],
  ["启", "启示录"],
];

const BOOK_PATTERN = ZH_BOOK_REF_PREFIXES.map(([a]) =>
  a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
).join("|");

const CN_NUM = {
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  百: 100,
  廿: 20,
  卅: 30,
};

export function cnToArabicNumeral(s) {
  if (s == null || s === "") return null;
  const t = String(s).trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (t.length === 1) return CN_NUM[t] ?? null;
  if (t.startsWith("十")) return 10 + (CN_NUM[t[1]] || 0);
  if (t.endsWith("十")) return (CN_NUM[t[0]] || 0) * 10;
  if (t.startsWith("廿")) return 20 + (CN_NUM[t[1]] || 0);
  if (t.startsWith("卅")) return 30 + (CN_NUM[t[1]] || 0);
  if (t.includes("十")) {
    const [a, , b] = [...t];
    return (CN_NUM[a] || 0) * 10 + (CN_NUM[b] || 0);
  }
  return CN_NUM[t] ?? null;
}

function formatVerseRef(bookName, chapter, verseStart, verseEnd) {
  const ch = cnToArabicNumeral(chapter) ?? chapter;
  if (verseStart == null || verseStart === "") {
    return `${bookName} ${ch}章`;
  }
  const vs = cnToArabicNumeral(verseStart) ?? verseStart;
  if (verseEnd != null && verseEnd !== "") {
    const ve = cnToArabicNumeral(verseEnd) ?? verseEnd;
    return `${bookName} ${ch}:${vs}-${ve}`;
  }
  return `${bookName} ${ch}:${vs}`;
}

function resolveBookPrefix(text, offset = 0) {
  const slice = text.slice(offset);
  for (const [abbrev, name] of ZH_BOOK_REF_PREFIXES) {
    if (slice.startsWith(abbrev)) return { abbrev, name, len: abbrev.length };
  }
  return null;
}

function parseCompactRef(segment) {
  const raw = segment.trim().replace(/\s+/g, "");
  if (!raw) return null;
  const book = resolveBookPrefix(raw);
  if (!book) return null;
  const rest = raw.slice(book.len);
  const m =
    rest.match(/^([零一二三四五六七八九十百廿卅]+)(\d{1,3})?(?:-(\d{1,3}))?$/) ||
    rest.match(/^([零一二三四五六七八九十百廿卅]+)$/);
  if (!m) return null;
  return formatVerseRef(book.name, m[1], m[2] || null, m[3] || null);
}

function normalizeParentheticalRefs(text) {
  return text.replace(/（([^）]+)）/g, (full, inner) => {
    const parts = inner.split(/[；;]/).map((p) => p.trim());
    const out = parts.map((part) => {
      const parsed = parseCompactRef(part);
      return parsed ? parsed : part;
    });
    if (out.join("；") === inner) return full;
    return `（${out.join("；")}）`;
  });
}

function normalizeProseScriptureRefs(text) {
  let t = text;
  const bookRe = new RegExp(`(${BOOK_PATTERN})`, "g");

  t = t.replace(
    new RegExp(`(${BOOK_PATTERN})([零一二三四五六七八九十百廿卅]+)章(\\d+)(?:-\\s*(\\d+))?节`, "g"),
    (_, book, ch, v1, v2) => {
      const name = resolveBookPrefix(book)?.name ?? book;
      return `${formatVerseRef(name, ch, v1, v2 || null)} `;
    },
  );

  t = t.replace(
    new RegExp(`(${BOOK_PATTERN})([零一二三四五六七八九十百廿卅]+)章(\\d+)(?:-\\s*(\\d+))?節`, "g"),
    (_, book, ch, v1, v2) => {
      const name = resolveBookPrefix(book)?.name ?? book;
      return `${formatVerseRef(name, ch, v1, v2 || null)} `;
    },
  );

  t = t.replace(/又在(\d{1,3})节/g, "又在 $1 节");
  t = t.replace(/又在(\d{1,3})節/g, "又在 $1 节");

  // 「三章19节说」类（书卷名已在前文出现）
  t = t.replace(/([零一二三四五六七八九十百廿卅]+)章(\d{1,3})节/g, (_, ch, v) => {
    const n = cnToArabicNumeral(ch);
    return n != null ? `${n}:${v}` : `${ch}章${v}节`;
  });
  t = t.replace(/([零一二三四五六七八九十百廿卅]+)章(\d{1,3})節/g, (_, ch, v) => {
    const n = cnToArabicNumeral(ch);
    return n != null ? `${n}:${v}` : `${ch}章${v}节`;
  });

  return t;
}

/** Remove WCF-style footnote digits without touching chapter:verse numbers. */
export function removeConfessionFootnoteDigits(text) {
  return text.replace(
    new RegExp(`([${CJK}])(\\d{1,2})(?=[；;。，、\\s]|$)`, "g"),
    (match, cjk, digits, offset, whole) => {
      const after = whole.slice(offset + match.length);
      if (/^[节節章]/.test(after)) return match;
      const before = whole.slice(Math.max(0, offset - 2), offset + cjk.length);
      if (/[章節节]$/.test(before)) return match;
      // 约壹四9、弗二8：节号跟在中文章号后，不是脚注
      if (/[零一二三四五六七八九十百廿卅]$/.test(cjk)) return match;
      return cjk;
    },
  );
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

/** Collapse line-wrap spaces inside Chinese runs (keeps「第 17 条」labels). */
export function collapseCjkInteriorSpaces(text) {
  const placeholders = [];
  let t = String(text).replace(/[\u00a0\u3000]/g, " ");

  t = t.replace(/第\s*(\d{1,2})\s*(条|條|章)/g, (_, n, unit) => {
    placeholders.push(`第 ${n} ${unit}`);
    return `\x00H${placeholders.length - 1}\x00`;
  });

  t = t.replace(new RegExp(`(?<=[${CJK}])\\s+(?=[${CJK}])`, "g"), "");
  t = t.replace(new RegExp(`(?<=[${CJK}])\\s+(?=[0-9])`, "g"), "");
  t = t.replace(new RegExp(`(?<=[0-9])\\s+(?=[${CJK}])`, "g"), "");
  t = t.replace(
    new RegExp(`(?<=[${CJK}])\\s+(?=[。，、；：？！）」』"’])`, "g"),
    "",
  );
  t = t.replace(/(\d)\s*-\s*(\d)(?=[节節])/g, "$1-$2");
  t = t.replace(/\s{2,}/g, " ");

  for (let i = 0; i < placeholders.length; i++) {
    t = t.replace(`\x00H${i}\x00`, placeholders[i]);
  }
  return t.trim();
}

export function stripBrokenCcelHtmlRemnants(text) {
  let t = String(text);
  t = t.replace(/<\/?a\b[^>]*>/gi, "");
  t = t.replace(/\?A\s+HREF="[^"]*">\s*\d*/gi, "");
  t = t.replace(/HREF="[^"]*">\s*\d*/gi, "");
  t = t.replace(/\?\/A>/gi, "");
  t = t.replace(/<\/?[a-z][^>]*>/gi, "");
  t = t.replace(/&(?:[a-z]+|#\d+);/gi, " ");
  return t;
}

export function normalizeHistoricalCreedChineseText(text) {
  if (!text) return "";
  let t = String(text);

  t = stripBrokenCcelHtmlRemnants(t);
  t = t
    .replace(/-{5,}[\s\S]*?(?=\n\n|$)/g, "")
    .replace(/\n\s*\d+．[^\n]+/g, "");

  const lines = t
    .split(/\n/)
    .map((line) => line.replace(/[ \t\u00a0\u3000]+/g, " ").trim())
    .filter(Boolean);

  t = lines.join("\n");

  return protectMarkdownLinks(t, (inner) => {
    const innerLines = inner.split("\n").map((line) => {
      let cleaned = removeConfessionFootnoteDigits(line);
      cleaned = collapseCjkInteriorSpaces(cleaned);
      cleaned = normalizeProseScriptureRefs(cleaned);
      cleaned = normalizeParentheticalRefs(cleaned);
      return cleaned;
    });
    return innerLines.join("\n");
  });
}

export function cleanupHistoricalCreedEnglishText(text) {
  if (!text) return "";
  return String(text)
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").replace(/(\d)\s*-\s*(\d)/g, "$1-$2").trim())
    .filter(Boolean)
    .join("\n");
}
