#!/usr/bin/env node
/**
 * D-47 真源数据同步：从仓库唯一真源 `data/` 提取并生成轻量化、标准化的
 * 6 个离线 JSON 文件到 `kernel/public/data/`：
 *   - panorama.json
 *   - medals.json
 *   - plans.json
 *   - explore.json
 *   - figures.json
 *   - sibling-apps.json
 *
 * 用法：
 *   node tools/sync-kernel-data.mjs          # 生成/覆盖 kernel/public/data/*.json
 *   node tools/sync-kernel-data.mjs --check  # 校验 6 个文件存在、合法、非空且与真源一致
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "kernel", "public", "data");

function readText(relPath) {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function loadCanonicalBooks() {
  const src = readText("lib/bible/scripture-books.ts");
  const books = [...src.matchAll(/\{\s*bookNumber:\s*(\d+),\s*bookId:\s*"([^"]+)",\s*bookName:\s*"([^"]+)",\s*chapters:\s*(\d+)/g)].map(
    (m) => ({
      bookNumber: Number(m[1]),
      bookId: m[2],
      bookName: m[3],
      chapters: Number(m[4]),
    }),
  );
  if (books.length !== 66) {
    throw new Error(`预期 66 卷圣经目录，实际解析到 ${books.length} 卷`);
  }
  return books;
}

const CANONICAL_BOOKS = loadCanonicalBooks();
const BOOK_NAME_BY_ID = new Map(CANONICAL_BOOKS.map((b) => [b.bookId, b.bookName]));
const BOOK_ORDER_BY_ID = new Map(CANONICAL_BOOKS.map((b) => [b.bookId, b.bookNumber]));

const CHINESE_BOOK_ALIASES = new Map([
  ...CANONICAL_BOOKS.map((b) => [b.bookName, b.bookId]),
  ["创", "GEN"], ["出", "EXO"], ["利", "LEV"], ["民", "NUM"], ["申", "DEU"],
  ["书", "JOS"], ["士", "JDG"], ["得", "RUT"], ["撒上", "1SA"], ["撒下", "2SA"],
  ["王上", "1KI"], ["王下", "2KI"], ["代上", "1CH"], ["代下", "2CH"], ["拉", "EZR"],
  ["尼", "NEH"], ["斯", "EST"], ["伯", "JOB"], ["诗", "PSA"], ["箴", "PRO"],
  ["传", "ECC"], ["歌", "SNG"], ["赛", "ISA"], ["耶", "JER"], ["哀", "LAM"],
  ["结", "EZK"], ["但", "DAN"], ["何", "HOS"], ["珥", "JOL"], ["摩", "AMO"],
  ["俄", "OBA"], ["拿", "JON"], ["弥", "MIC"], ["鸿", "NAM"], ["哈", "HAB"],
  ["番", "ZEP"], ["该", "HAG"], ["亚", "ZEC"], ["玛", "MAL"],
  ["太", "MAT"], ["可", "MRK"], ["路", "LUK"], ["约", "JHN"], ["徒", "ACT"],
  ["罗", "ROM"], ["林前", "1CO"], ["林后", "2CO"], ["加", "GAL"], ["弗", "EPH"],
  ["腓", "PHP"], ["西", "COL"], ["帖前", "1TH"], ["帖后", "2TH"], ["提前", "1TI"],
  ["提后", "2TI"], ["多", "TIT"], ["门", "PHM"], ["来", "HEB"], ["雅", "JAS"],
  ["彼前", "1PE"], ["彼后", "2PE"], ["约一", "1JN"], ["约壹", "1JN"], ["约二", "2JN"],
  ["约贰", "2JN"], ["约三", "3JN"], ["约叁", "3JN"], ["犹", "JUD"], ["启", "REV"],
  ["约翰壹书", "1JN"], ["约翰贰书", "2JN"], ["约翰叁书", "3JN"],
  ["马太", "MAT"], ["马可", "MRK"], ["路加", "LUK"], ["约翰", "JHN"],
]);

const SORTED_CHINESE_BOOK_TOKENS = [...CHINESE_BOOK_ALIASES.keys()].sort((a, b) => b.length - a.length);
const VERSE_REF_RE = new RegExp(
  `(${SORTED_CHINESE_BOOK_TOKENS.join("|")})(?:》)?\\s*(?:第)?\\s*(\\d+)(?:\\s*[:：]\\s*(\\d+(?:\\s*[-–—~]\\s*\\d+)?))?`,
);
const WHOLE_BOOK_RE = new RegExp(`(${SORTED_CHINESE_BOOK_TOKENS.join("|")})(?:》)?\\s*全书`);

function cleanText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function truncateText(text, maxLen) {
  const s = cleanText(text);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1).trimEnd() + "…";
}

function trimMarkdownToMaxLength(markdown, maxLen) {
  const normalized = String(markdown ?? "").replace(/\r\n/g, "\n").trim();
  if (normalized.length <= maxLen) return normalized;
  const paragraphs = normalized.split(/\n{2,}/);
  const kept = [];
  let len = 0;
  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) continue;
    const nextLen = len === 0 ? p.length : len + 2 + p.length;
    if (nextLen > maxLen && kept.length >= 2) break;
    kept.push(p);
    len = nextLen;
  }
  let out = kept.join("\n\n").trim();
  if (out.length > maxLen) {
    out = out.slice(0, maxLen - 1).trimEnd() + "…";
  } else if (out.length < normalized.length) {
    out += "\n\n…";
  }
  return out;
}

function buildPanorama() {
  const src = readJson("data/bible/panorama.json");
  const actIdByEn = {
    Creation: "creation",
    "The fall": "fall",
    Israel: "israel",
    "Jesus Christ": "jesus",
    "The church's mission": "church-mission",
    "New creation": "new-creation",
  };

  const acts = (src.acts || []).map((act, idx) => {
    const sections = Array.isArray(act.sections) ? act.sections : [];
    const id = actIdByEn[act.en] || sections[0]?.id || `act-${idx + 1}`;
    const summary =
      sections.length === 1
        ? cleanText(sections[0].summaryZh)
        : sections.map((s) => `${cleanText(s.zh)}：${cleanText(s.summaryZh)}`).join(" ");
    const seenBooks = new Set();
    const books = [];
    for (const sec of sections) {
      for (const span of sec.spans || []) {
        if (span.bookId && !seenBooks.has(span.bookId)) {
          seenBooks.add(span.bookId);
          books.push(span.bookId);
        }
      }
    }
    return {
      id,
      title: cleanText(act.zh),
      subtitle: cleanText(act.subtitleZh),
      summary,
      books,
    };
  });

  const introductions = src.introductions || {};
  const books = {};
  for (const canonical of CANONICAL_BOOKS) {
    const intro = introductions[canonical.bookId];
    if (!intro) continue;
    const refs = cleanText(intro.references);
    books[canonical.bookId] = {
      title: canonical.bookName,
      summary: cleanText(intro.zh),
      keyVerse: refs ? `${canonical.bookName} ${refs}` : canonical.bookName,
    };
  }

  return { acts, books };
}

function formatConditionWithTiers(template, tiers) {
  const raw = cleanText(template);
  if (!raw.includes("{n}")) return raw;
  const values = Array.isArray(tiers) && tiers.length > 0 ? tiers.join("/") : "1";
  return raw.replaceAll("{n}", values);
}

function buildMedals() {
  const src = readJson("data/medals.json");
  const medals = (src.medals || []).map((m) => {
    const tiers = Array.isArray(m.tiers) ? m.tiers : [1];
    const unitZh = cleanText(m.unit?.zh);
    const tierDisplay = tiers.join("/");
    const requirement = `${m.metric} >= ${tierDisplay}${unitZh ? ` (${unitZh})` : ""}`;
    return {
      id: m.key,
      name: cleanText(m.name?.zh),
      nameEn: cleanText(m.name?.en),
      category: cleanText(m.category),
      description: formatConditionWithTiers(m.condition?.zh, tiers),
      descriptionEn: formatConditionWithTiers(m.condition?.en, tiers),
      requirement,
    };
  });
  return { medals };
}

function formatReadingRangeZh(reading) {
  const bookName = BOOK_NAME_BY_ID.get(reading.bookId) || reading.bookId;
  if (reading.startChapter && reading.endChapter && reading.endChapter !== reading.startChapter) {
    return `${bookName} ${reading.startChapter}–${reading.endChapter}`;
  }
  if (reading.startChapter) {
    return `${bookName} ${reading.startChapter}`;
  }
  return cleanText(reading.label) || bookName;
}

function buildPlans() {
  const registry = readJson("data/bible-reading-plans/registry.json");
  const briefZh = readJson("data/bible-reading-plans/mobile-brief.zh-CN.json");
  const zhLocales = readJson("locales/zh-CN.json");
  const enLocales = readJson("locales/en.json");
  const zhCatalog = zhLocales?.pages?.read?.plansCatalog || {};
  const enCatalog = enLocales?.pages?.read?.plansCatalog || {};

  const primaryPlans = [
    {
      planId: "triple-loop",
      name: "轻松循环读经计划",
      dayCount: 365,
      listPriority: -20,
      category: "featured",
      sampleReadings: [
        "新约 · 马太福音 1",
        "智慧书 · 约伯记 1",
        "旧约 · 创世记 1",
      ],
    },
    {
      planId: "nt-deep-repeat",
      name: "新约深读 · 旧约通读",
      dayCount: 364,
      listPriority: -15,
      category: "featured",
      sampleReadings: [
        "第 1 阶 · 约翰一书 1–5（连读 7 天）",
        "旧约并行 · 创世记 1",
      ],
    },
  ];

  const classicPlans = (registry.plans || [])
    .filter((p) => !p.listHidden)
    .map((p) => {
      let sampleReadings = [];
      if (p.bundlePath && existsSync(path.join(ROOT, p.bundlePath))) {
        const built = readJson(p.bundlePath);
        const days = Array.isArray(built.days) ? built.days.slice(0, 3) : [];
        sampleReadings = days.map((d, idx) => {
          const dayNum = typeof d.dayIndex === "number" ? d.dayIndex + 1 : idx + 1;
          const items = (d.readings || []).map(formatReadingRangeZh).join("、");
          return `第 ${dayNum} 天 · ${items}`;
        });
      }
      return {
        planId: p.planId,
        name: p.name,
        descriptionRaw: cleanText((p.description || "").replace(/<[^>]+>/g, "")),
        dayCount: Number(p.dayCount) || 365,
        listPriority: typeof p.listPriority === "number" ? p.listPriority : 100,
        category: "classic",
        sampleReadings,
      };
    });

  const merged = [...primaryPlans, ...classicPlans].sort((a, b) => {
    const pa = a.listPriority ?? 100;
    const pb = b.listPriority ?? 100;
    return pa !== pb ? pa - pb : a.planId.localeCompare(b.planId);
  });

  const plans = merged.map((p) => {
    const zhEntry = zhCatalog[p.planId] || {};
    const enEntry = enCatalog[p.planId] || {};
    const briefEntry = briefZh?.plans?.[p.planId];
    const title = cleanText(zhEntry.title || p.name);
    const titleEn = cleanText(enEntry.title || p.name);
    const subtitle = cleanText(briefEntry?.badge || zhEntry.subtitle || briefZh?.classic?.badge || "");
    const description = cleanText(briefEntry?.detail || zhEntry.blurb || p.descriptionRaw || "");
    return {
      id: p.planId,
      title,
      titleEn,
      subtitle,
      days: p.dayCount,
      category: p.category,
      description,
      sampleReadings: p.sampleReadings,
    };
  });

  return { plans };
}

function estimateReadingMinutes(text) {
  const chars = cleanText(text).length;
  return Math.max(1, Math.round(chars / 400));
}

function extractSummaryFromMarkdown(md) {
  const lines = String(md ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("|"));
  const joined = cleanText(lines.slice(0, 3).join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*>`]/g, ""));
  return truncateText(joined, 120);
}

function formatModuleListMarkdown(title, subtitle, categories) {
  const lines = [`# ${title}`, "", subtitle, ""];
  for (const cat of categories.slice(0, 12)) {
    const refs = Array.isArray(cat.refs) ? cat.refs.slice(0, 8).join("、") : "";
    lines.push(`- **${cleanText(cat.title)}**：${refs}`);
  }
  return lines.join("\n");
}

function buildExplore() {
  const featured = readJson("data/explore-featured-articles/bundle.json");
  const community = readJson("data/legacy-community-articles.json");
  const modules = readJson("data/explore-modules/bundle.json");

  const articles = [];
  const seenSlugs = new Set();

  for (const a of featured.articles || []) {
    const zh = a["zh-CN"] || {};
    const slug = cleanText(a.slug);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const bodyMarkdown = trimMarkdownToMaxLength(zh.body || "", 2800);
    articles.push({
      slug,
      title: cleanText(zh.title),
      subtitle: cleanText(zh.exploreLabel || "精选导读"),
      category: "精选导读",
      readingMinutes: estimateReadingMinutes(bodyMarkdown),
      summary: extractSummaryFromMarkdown(bodyMarkdown),
      bodyMarkdown,
    });
  }

  for (const item of community.items || []) {
    const slug = cleanText(item.slug);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const bodyMarkdown = trimMarkdownToMaxLength(item.body || "", 2600);
    articles.push({
      slug,
      title: cleanText(item.title),
      subtitle: cleanText(item.columnLabel || "查经随笔"),
      category: cleanText(item.columnLabel || "查经随笔"),
      readingMinutes: estimateReadingMinutes(bodyMarkdown),
      summary: truncateText(item.summary || extractSummaryFromMarkdown(bodyMarkdown), 120),
      bodyMarkdown,
    });
  }

  // 从 explore-modules 提炼轻量经文专题索引
  if (Array.isArray(modules.prayer?.scenarios)) {
    const md = formatModuleListMarkdown(
      "按处境祷告的经文",
      "在日常、家庭、健康与前路之中，用诗篇与书信回应神。",
      modules.prayer.scenarios.map((s) => ({ title: s.title, refs: s.refs })),
    );
    articles.push({
      slug: "module-prayer-scenarios",
      title: "按处境祷告的经文",
      subtitle: "祷告索引",
      category: "经文专题",
      readingMinutes: 2,
      summary: "十种常见处境下的圣经祷告经文索引（诗篇、福音书与书信）。",
      bodyMarkdown: md,
    });
  }

  if (Array.isArray(modules.narrowGate?.categories)) {
    const md = formatModuleListMarkdown(
      "窄门与门徒生活",
      "救恩根基、圣洁生活、教会团契与永恒盼望的十二组经文。",
      modules.narrowGate.categories,
    );
    articles.push({
      slug: "module-narrow-gate",
      title: "窄门与门徒生活",
      subtitle: "门徒生活",
      category: "经文专题",
      readingMinutes: 2,
      summary: "围绕救恩、爱神爱人、圣洁、祷告与盼望的十二主题经文索引。",
      bodyMarkdown: md,
    });
  }

  if (Array.isArray(modules.praiseWorship?.categories)) {
    const md = formatModuleListMarkdown(
      "赞美与敬拜经文",
      "因神的圣洁、慈爱、主权与信实，向祂献上赞美。",
      modules.praiseWorship.categories,
    );
    articles.push({
      slug: "module-praise-worship",
      title: "赞美与敬拜经文",
      subtitle: "敬拜诗篇",
      category: "经文专题",
      readingMinutes: 2,
      summary: "以诗篇与启示录颂赞为主轴的八组敬拜经文索引。",
      bodyMarkdown: md,
    });
  }

  if (Array.isArray(modules.wordOfGod?.categories)) {
    const md = formatModuleListMarkdown(
      "认识神的话语",
      "圣经从神而来、是真理、赐生命并光照人心。",
      modules.wordOfGod.categories,
    );
    articles.push({
      slug: "module-word-of-god",
      title: "认识神的话语",
      subtitle: "神的话语",
      category: "经文专题",
      readingMinutes: 3,
      summary: "精选神的话语专题经文索引（含诗篇 119 篇重点节选）。",
      bodyMarkdown: md,
    });
  }

  if (modules.yearsDaysEternity?.zh) {
    const yde = modules.yearsDaysEternity.zh;
    const lines = [`# ${cleanText(yde.pageTitle || "人的年日与永恒")}`, ""];
    for (const sec of yde.sections || []) {
      const refs = (sec.blocks || []).map((b) => b.ref).filter(Boolean).slice(0, 6);
      lines.push(`- **${cleanText(sec.title)}**：${refs.join("、")}`);
    }
    const md = lines.join("\n");
    articles.push({
      slug: "module-years-days-eternity",
      title: cleanText(yde.pageTitle || "人的年日与永恒"),
      subtitle: "生命与永恒",
      category: "经文专题",
      readingMinutes: 2,
      summary: "从受造、有限年日到基督救赎与永生盼望的八段经文脉络。",
      bodyMarkdown: md,
    });
  }

  return { articles };
}

const CANONICAL_ERAS = [
  "族长时期",
  "出埃及与律法时代",
  "王国与史传时期",
  "智慧文学时期",
  "大先知时期",
  "小先知时期",
  "福音书时期",
  "使徒时代",
];

function normalizeFigureEra(rawPeriod, primaryBookId) {
  const s = cleanText(rawPeriod);
  if (s === "族长时代" || s === "族长时期") return "族长时期";
  if (s === "出埃及与律法时代" || s === "出埃及时期") return "出埃及与律法时代";
  if (s === "王国与史传时期" || s === "联合王国时期") return "王国与史传时期";
  if (s === "智慧文学时期") return "智慧文学时期";
  if (s === "大先知时期") return "大先知时期";
  if (s === "小先知时期") return "小先知时期";
  if (s === "福音书时期" || s === "福音书时代") return "福音书时期";
  if (s === "使徒时代" || s === "使徒时期") return "使徒时代";
  const order = BOOK_ORDER_BY_ID.get(primaryBookId) || 1;
  if (order === 1) return "族长时期";
  if (order <= 5) return "出埃及与律法时代";
  if (order <= 17) return "王国与史传时期";
  if (order <= 22) return "智慧文学时期";
  if (order <= 27) return "大先知时期";
  if (order <= 39) return "小先知时期";
  if (order <= 43) return "福音书时期";
  return "使徒时代";
}

function parseVerseLinesFromFigureBody(body, primaryBookId) {
  const text = String(body ?? "").replace(/\r\n/g, "\n");
  const candidates = [];

  const sec10 = text.match(
    /##\s*(?:十|10)[、.\s][^\n]*\n([\s\S]*?)(?=\n##\s*(?:十一|十二|[一二三四五六七八九十]+|11)|\s*$)/,
  );
  if (sec10) {
    for (const raw of sec10[1].split("\n")) {
      const line = raw.replace(/^[-*•\d.\s]+/, "").trim();
      if (line) candidates.push({ line, defaultNote: "关键经文" });
    }
  }

  for (const m of text.matchAll(/###\s*([^\n]+)\n(?:经文[：:]\s*([^\n]+))/g)) {
    const heading = cleanText(m[1]).replace(/^[(\d一二三四五六七八九十.)\s]+/, "").trim();
    candidates.push({ line: cleanText(m[2]), defaultNote: heading || "主要经历" });
  }

  if (candidates.length === 0) {
    const sec2 = text.match(/##\s*二、[^\n]*\n([\s\S]*?)(?=\n##\s*|$)/);
    if (sec2) {
      candidates.push({ line: cleanText(sec2[1]), defaultNote: "首次出现" });
    }
  }

  const verses = [];
  const seen = new Set();

  for (const { line, defaultNote } of candidates) {
    let book = null;
    let chapter = null;
    let verseSpan = "";
    let note = defaultNote;

    const m = line.match(VERSE_REF_RE);
    if (m) {
      book = CHINESE_BOOK_ALIASES.get(m[1]) || null;
      chapter = Number(m[2]);
      verseSpan = m[3] ? `:${cleanText(m[3]).replace(/\s+/g, "")}` : "";
      const trailing = line.slice((m.index || 0) + m[0].length).replace(/^[章节\s:：\-–—]+/, "").trim();
      if (trailing && trailing.length <= 28) {
        note = trailing;
      }
    } else {
      const whole = line.match(WHOLE_BOOK_RE);
      if (whole) {
        book = CHINESE_BOOK_ALIASES.get(whole[1]) || null;
        chapter = 1;
        note = "全卷叙事";
      }
    }

    if (!book || !Number.isInteger(chapter) || chapter <= 0) continue;
    const key = `${book}:${chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const bookZh = BOOK_NAME_BY_ID.get(book) || book;
    const ref = `${bookZh} ${chapter}${verseSpan}`;
    verses.push({ ref, book, chapter, note });
    if (verses.length >= 6) break;
  }

  if (verses.length === 0 && primaryBookId) {
    const bookZh = BOOK_NAME_BY_ID.get(primaryBookId) || primaryBookId;
    verses.push({ ref: `${bookZh} 1`, book: primaryBookId, chapter: 1, note: "相关书卷" });
  }

  return verses;
}

function buildFigures() {
  const timeline = readJson("data/legacy-figures-timeline.json");
  const mobile = readJson("data/legacy-figures-mobile.json");

  const profileById = new Map((mobile.profiles || []).map((p) => [p.id, p]));
  const orderedIds = [];
  const seenIds = new Set();

  for (const row of timeline.bookRows || []) {
    for (const f of row.figures || []) {
      if (f.id && !seenIds.has(f.id)) {
        seenIds.add(f.id);
        orderedIds.push(f.id);
      }
    }
  }
  for (const p of mobile.profiles || []) {
    if (p.id && !seenIds.has(p.id)) {
      seenIds.add(p.id);
      orderedIds.push(p.id);
    }
  }

  const figures = [];
  const usedEras = new Set();

  for (const id of orderedIds) {
    const p = profileById.get(id);
    if (!p) continue;
    const era = normalizeFigureEra(p.periodLabelZh, p.primaryBookId);
    usedEras.add(era);

    const summary = truncateText(p.article?.summary || p.scripturePersonalityZh || "", 120);
    const verses = parseVerseLinesFromFigureBody(p.article?.body || "", p.primaryBookId);

    figures.push({
      id: p.id,
      name: cleanText(p.displayNameZh),
      nameEn: cleanText(p.englishName || p.en?.displayName || ""),
      era,
      role: cleanText(p.characterRoleZh || "相关人物"),
      summary,
      verses,
    });
  }

  const eras = CANONICAL_ERAS.filter((e) => usedEras.has(e));
  return { eras, figures };
}

function buildSiblingApps() {
  const src = readJson("data/sibling-apps/apps.json");
  const apps = (src.apps || [])
    .filter((app) => app.id !== "askbible")
    .map((app) => ({
      id: cleanText(app.id),
      name: cleanText(app.name?.["zh-CN"] || app.name?.en || app.id),
      nameEn: cleanText(app.name?.en || app.name?.["zh-CN"] || app.id),
      tagline: cleanText(app.tagline?.["zh-CN"] || app.tagline?.en || ""),
      taglineEn: cleanText(app.tagline?.en || app.tagline?.["zh-CN"] || ""),
      url: cleanText(app.web || app.android || app.ios || ""),
      iosUrl: cleanText(app.ios || ""),
      androidUrl: cleanText(app.android || app.googlePlay || ""),
    }));
  return { apps };
}

function buildAllDatasets() {
  return [
    { filename: "panorama.json", data: buildPanorama(), countInfo: (d) => `${d.acts.length} 幕 / ${Object.keys(d.books).length} 卷` },
    { filename: "medals.json", data: buildMedals(), countInfo: (d) => `${d.medals.length} 枚勋章` },
    { filename: "plans.json", data: buildPlans(), countInfo: (d) => `${d.plans.length} 个读经计划` },
    { filename: "explore.json", data: buildExplore(), countInfo: (d) => `${d.articles.length} 篇文章/专题` },
    { filename: "figures.json", data: buildFigures(), countInfo: (d) => `${d.eras.length} 个时期 / ${d.figures.length} 位人物` },
    { filename: "sibling-apps.json", data: buildSiblingApps(), countInfo: (d) => `${d.apps.length} 个关联应用` },
  ];
}

function checkDatasets(datasets) {
  const errors = [];
  for (const item of datasets) {
    const filePath = path.join(OUTPUT_DIR, item.filename);
    const rel = path.relative(ROOT, filePath);
    if (!existsSync(filePath)) {
      errors.push(`缺失文件: ${rel}`);
      continue;
    }
    const raw = readFileSync(filePath, "utf8");
    if (raw.trim().length === 0) {
      errors.push(`文件内容为空: ${rel}`);
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      errors.push(`JSON 解析失败 ${rel}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (!parsed || typeof parsed !== "object") {
      errors.push(`JSON 根节点无效: ${rel}`);
      continue;
    }
    const expectedRaw = JSON.stringify(item.data, null, 2) + "\n";
    if (raw !== expectedRaw) {
      errors.push(`与真源不一致（请重新运行 node tools/sync-kernel-data.mjs）: ${rel}`);
      continue;
    }

    // 针对关键结构与产品边界做额外断言
    if (item.filename === "figures.json") {
      if (!Array.isArray(parsed.eras) || parsed.eras.length === 0 || !Array.isArray(parsed.figures) || parsed.figures.length === 0) {
        errors.push(`figures.json 数据条目为空`);
      }
      const hasMissingVerses = parsed.figures.some((f) => !Array.isArray(f.verses) || f.verses.length === 0);
      if (hasMissingVerses) errors.push(`figures.json 存在缺少经文索引的人物`);
    }
    if (item.filename === "sibling-apps.json") {
      if (parsed.apps.some((a) => a.id === "askbible")) {
        errors.push(`sibling-apps.json 未过滤 askbible 自身（违反 D-42）`);
      }
    }
    console.log(`  ✓ ${rel} (${item.countInfo(parsed)} · ${Buffer.byteLength(raw, "utf8")} B)`);
  }

  if (errors.length > 0) {
    console.error("\n❌ 真源数据同步校验失败：\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }
  console.log("\n✅ kernel/public/data/ 6 个文件全部校验通过且与真源一致");
}

function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");
  if (args.size > (checkOnly ? 1 : 0)) {
    console.error("未知参数。用法: node tools/sync-kernel-data.mjs [--check]");
    process.exit(1);
  }

  const datasets = buildAllDatasets();
  if (checkOnly) {
    console.log("🔍 正在校验 kernel/public/data/ 与 data/ 真源一致性...");
    checkDatasets(datasets);
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const item of datasets) {
    const filePath = path.join(OUTPUT_DIR, item.filename);
    const content = JSON.stringify(item.data, null, 2) + "\n";
    writeFileSync(filePath, content, "utf8");
    const bytes = Buffer.byteLength(content, "utf8");
    console.log(`✅ 写入 ${path.relative(ROOT, filePath)} (${item.countInfo(item.data)} · ${bytes} B)`);
  }
}

main();
