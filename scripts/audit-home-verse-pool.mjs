#!/usr/bin/env node
/**
 * Audit theme-repeat-ge5 allowlist for controversial/misleading verses
 * and context-truncation issues.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsvPath = path.join(repoRoot, "data/scripture/theme-repeat-ge5-allowlist.tsv");

/** Known problematic verse keys (curated). Categories overlap. */
const KNOWN_CONTROVERSIAL = {
  imprecatory_violence: [
    "PSA.137.9",
    "PSA.58.10",
    "PSA.109.9",
    "PSA.109.10",
    "PSA.109.14",
    "PSA.109.15",
    "PSA.139.19",
    "PSA.139.22",
    "PSA.69.22",
    "PSA.69.23",
    "PSA.69.24",
    "PSA.69.28",
    "PSA.59.13",
    "PSA.55.15",
    "PSA.35.8",
    "PSA.109.6",
    "PSA.109.8",
    "PSA.109.13",
    "LAM.3.64",
    "LAM.3.66",
    "HOS.13.16",
    "NAH.3.10",
    "2KI.2.23",
    "2KI.2.24",
    "1SA.15.3",
    "1SA.15.18",
    "DEU.7.2",
    "DEU.20.16",
    "DEU.20.17",
    "DEU.21.18",
    "DEU.21.21",
    "DEU.22.21",
    "DEU.25.11",
    "DEU.25.12",
    "LEV.20.13",
    "LEV.20.10",
    "LEV.24.16",
    "EXO.21.20",
    "EXO.21.21",
    "EXO.22.24",
    "NUM.31.17",
    "NUM.31.18",
    "JOS.6.21",
    "JOS.10.28",
    "JDG.19.29",
    "JDG.21.10",
    "JDG.21.11",
    "EZK.9.6",
    "EZK.23.20",
    "ISA.13.16",
    "ISA.13.18",
    "REV.2.23",
  ],
  slavery_subjugation: [
    "EPH.6.5",
    "COL.3.22",
    "TIT.2.9",
    "1PE.2.18",
    "LEV.25.44",
    "LEV.25.45",
    "LEV.25.46",
    "EXO.21.7",
    "EXO.21.20",
    "1TI.6.1",
    "1CO.7.21",
    "1CO.11.3",
    "1CO.11.9",
    "1CO.14.34",
    "1TI.2.11",
    "1TI.2.12",
    "EPH.5.22",
    "COL.3.18",
    "TIT.2.5",
    "1PE.3.1",
    "1PE.3.5",
    "1PE.3.6",
  ],
  hyperbole_literal_misread: [
    "MAT.5.29",
    "MAT.5.30",
    "MAT.18.8",
    "MAT.18.9",
    "MRK.9.43",
    "MRK.9.45",
    "MRK.9.47",
    "LUK.14.26",
    "MAT.10.34",
    "MAT.10.35",
    "LUK.12.49",
    "MAT.5.39",
    "MAT.5.44",
  ],
  famous_misquoted_needs_context: [
    "JER.29.11",
    "PHP.4.13",
    "PRO.3.5",
    "PRO.3.6",
    "MAT.7.1",
    "MAT.18.20",
    "PHM.1.6",
    "ISA.40.31",
    "ROM.8.28",
    "1CO.10.13",
    "GAL.6.7",
    "MAL.3.10",
    "JHN.14.13",
    "JHN.14.14",
    "MAT.21.22",
    "JAS.4.3",
    "PSA.37.4",
    "PRO.22.6",
    "ECC.3.1",
    "MAT.6.33",
    "2CH.7.14",
    "PHM.1.6",
    "ISA.54.17",
    "ROM.12.19",
  ],
  harsh_judgment_without_context: [
    "HEB.10.27",
    "MAT.25.41",
    "REV.21.8",
    "REV.22.15",
    "JHN.3.18",
    "2TH.1.8",
    "2TH.1.9",
    "GAL.1.8",
    "GAL.1.9",
    "DEU.28.15",
    "LEV.26.14",
    "ACT.5.5",
    "ACT.5.10",
    "ACT.12.23",
    "1CO.11.30",
    "1CO.5.5",
    "HEB.12.6",
    "PSA.145.20",
    "ISA.66.24",
    "MAT.10.28",
    "LUK.12.5",
    "MAT.15.4",
    "EXO.22.24",
    "HOS.4.6",
    "ISA.66.3",
    "JHN.8.44",
    "2PE.2.14",
    "2PE.2.1",
  ],
  sexual_graphic: [
    "EZK.23.20",
    "PRO.7.22",
    "PRO.5.3",
    "PRO.5.4",
    "SNG.1.2",
    "SNG.1.13",
    "SNG.7.1",
    "SNG.7.2",
    "GEN.19.8",
    "GEN.38.9",
    "JDG.19.22",
    "2SA.11.4",
    "LEV.18.22",
    "LEV.20.13",
    "ROM.1.26",
    "ROM.1.27",
    "1CO.6.9",
    "1CO.6.10",
  ],
  irony_sarcasm_parable_fragment: [
    "LUK.16.9",
    "MAT.25.24",
    "MAT.25.26",
    "LUK.16.11",
    "ECC.7.16",
    "ECC.7.17",
    "1CO.15.32",
    "JDG.9.14",
    "JDG.9.15",
  ],
};

const CONTINUATION_START =
  /^(所以|因此|然而|但是|但|并且|而且|又|也|就|若|当|凡|于是|这样|如此|因为|既然|至于|何况|况且|何况|何况|何况|何况|那|这|他|她|他们|它|我们|你们|弟兄们|我儿|神啊|耶和华啊|主啊|耶稣|不但|何况|此外|原来|正如|好像|如同|如同|像|既|既在|既已|我们既有|你们既然|他们既|并且|再者|并且被|除此以外|此外|又拿着|又要|还要|还要|还要|还要|还要|还要|还要)/;

const IMPERATIVE_FRAGMENT = /^(不可|不要|应当|必须|务要|要|当|须|莫|勿|且|只管|只要|惟有|唯独|只要|但凡|凡是|凡|各|各要|各当)/;

function parseTsv(content) {
  const rows = [];
  for (const line of content.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const [verseKey, repeatCount, reference, text] = parts;
    rows.push({
      verseKey: verseKey.trim().toUpperCase(),
      repeatCount: Number(repeatCount),
      reference: reference.trim(),
      text: text.trim(),
    });
  }
  return rows;
}

function detectTruncation(row, allKeys) {
  const issues = [];
  const { text, verseKey, reference } = row;
  const [, book, chapter, verse] = verseKey.match(/^([A-Z0-9]{3})\.(\d+)\.(\d+)$/) ?? [];

  if (text.endsWith("，") || text.endsWith(",") || text.endsWith("；") || text.endsWith(";")) {
    issues.push("句末逗号/分号，明显未完");
  }
  if (text.endsWith("：") || text.endsWith(":")) {
    issues.push("句末冒号，后文被截断");
  }
  if (CONTINUATION_START.test(text)) {
    issues.push("以承接/转折词开头，缺上文");
  }
  if (/^[a-z]/.test(text)) {
    issues.push("英文小写开头（若混排）");
  }
  if (/^(那|这|他|她|他们|它|其|其|其)/.test(text) && !/^(那|这)/.test(text.slice(0, 2))) {
    // already covered
  }
  if (/说：「?$/.test(text) || /说：$/.test(text)) {
    issues.push("引语未展开");
  }
  if (text.includes("……") || text.endsWith("…")) {
    issues.push("含省略号或明显截断");
  }

  // Check if next verse exists in pool and text seems to continue
  if (book && chapter && verse) {
    const nextKey = `${book}.${chapter}.${Number(verse) + 1}`;
    const prevKey = `${book}.${chapter}.${Number(verse) - 1}`;
    const hasNext = allKeys.has(nextKey);
    const hasPrev = allKeys.has(prevKey);

    if (hasNext && (text.endsWith("，") || text.endsWith(";") || CONTINUATION_START.test(text) === false)) {
      // If ends with comma, next verse likely needed
      if (text.endsWith("，")) {
        issues.push(`同章 ${reference} 下一节 ${nextKey} 也在池中，可能应合并`);
      }
    }
    if (hasPrev && CONTINUATION_START.test(text)) {
      issues.push(`承接上一节 ${prevKey}，单独展示易断章`);
    }
  }

  // List-like verse that's clearly part of a series
  if (/、$/.test(text.replace(/[」』"']$/, ""))) {
    issues.push("以顿号列举未完");
  }

  // Very short fragments
  if (text.length <= 8 && !/[。！？」』]$/.test(text)) {
    issues.push("极短片段，可能不完整");
  }

  return [...new Set(issues)];
}

function detectTextFlags(text) {
  const flags = [];
  const patterns = [
    { re: /摔在磐石|摔.*婴孩|婴孩.*摔/, tag: "暴力意象（摔婴孩类）" },
    { re: /拿.*摔|摔.*石/, tag: "暴力意象（摔石类）" },
    { re: /便为有福|有福了/, tag: "「有福」需看上下文（或反讽）" },
    { re: /咒诅|被咒诅|应当被咒诅/, tag: "咒诅语句" },
    { re: /用刀杀|必治死|用石头打死|治死他/, tag: "死刑/杀戮命令" },
    { re: /灭绝|灭尽|除灭|毁灭|灭掉/, tag: "灭绝/毁灭" },
    { re: /报仇|复仇|报血仇/, tag: "报仇" },
    { re: /砍下来|砍.*手|砍.*脚/, tag: "自残式比喻（易被字面理解）" },
    { re: /奴隶|奴仆|婢女|使女|妾/, tag: "奴隶/从属语境" },
    { re: /顺服.*丈夫|妻子.*顺服|妇女.*沉默|不可作教/, tag: "性别/权柄争议" },
    { re: / homosexual|同性|男色|与男人苟合/, tag: " sexuality 伦理争议" },
    { re: /淫乱|奸淫|苟合|淫行|淫乱/, tag: "性道德" },
    { re: /地狱|永火|硫磺|烧.*火湖/, tag: "审判/地狱" },
    { re: /魔鬼|撒但|邪灵/, tag: "属灵争战/魔鬼" },
    { re: /假先知|假师傅|异端/, tag: "假教师/异端" },
    { re: /行邪术|占卜|交鬼/, tag: "邪术" },
    { re: /拜偶像/, tag: "拜偶像" },
    { re: /无知识而灭亡/, tag: " harsh judgment" },
    { re: /虫是不死的|火是不灭的/, tag: "恐怖末日意象" },
    { re: /宰杀|被牵到宰杀|屠宰/, tag: "宰杀比喻" },
    { re: /分尸|肢体/, tag: "肢体/分尸" },
    { re: /遗腹|怀孕/, tag: "战争中的孕妇（敏感）" },
  ];
  for (const { re, tag } of patterns) {
    if (re.test(text)) flags.push(tag);
  }
  return [...new Set(flags)];
}

function categorizeKnown(key) {
  const out = [];
  for (const [cat, keys] of Object.entries(KNOWN_CONTROVERSIAL)) {
    if (keys.includes(key)) out.push(cat);
  }
  return out;
}

function main() {
  const content = fs.readFileSync(tsvPath, "utf8");
  const rows = parseTsv(content);
  const allKeys = new Set(rows.map((r) => r.verseKey));

  const controversial = [];
  const truncated = [];

  for (const row of rows) {
    const knownCats = categorizeKnown(row.verseKey);
    const textFlags = detectTextFlags(row.text);
    const truncIssues = detectTruncation(row, allKeys);

    if (knownCats.length || textFlags.length) {
      controversial.push({
        ...row,
        knownCats,
        textFlags,
        severity: knownCats.length
          ? knownCats.includes("imprecatory_violence") ||
            knownCats.includes("sexual_graphic") ||
            knownCats.includes("slavery_subjugation")
            ? "high"
            : "medium"
          : textFlags.some((f) => f.includes("暴力") || f.includes("摔"))
            ? "high"
            : "medium",
      });
    }

    if (truncIssues.length) {
      truncated.push({ ...row, truncIssues });
    }
  }

  controversial.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    return (sev[a.severity] ?? 9) - (sev[b.severity] ?? 9) || b.repeatCount - a.repeatCount;
  });
  truncated.sort((a, b) => b.truncIssues.length - a.truncIssues.length || b.repeatCount - a.repeatCount);

  console.log(JSON.stringify({ total: rows.length, controversial, truncated }, null, 0));
}

main();
