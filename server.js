import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { testamentOptions } from "./src/books.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ADMIN_DIR = path.join(__dirname, "admin_data");
const RULES_DIR = path.join(ADMIN_DIR, "rules");
const JOBS_DIR = path.join(ADMIN_DIR, "jobs");
const CONTENT_BUILDS_DIR = path.join(__dirname, "content_builds");
const CONTENT_PUBLISHED_DIR = path.join(__dirname, "content_published");

const LANGUAGES_FILE = path.join(ADMIN_DIR, "languages.json");
const SCRIPTURE_VERSIONS_FILE = path.join(ADMIN_DIR, "scripture_versions.json");
const CONTENT_VERSIONS_FILE = path.join(ADMIN_DIR, "content_versions.json");
const PUBLISHED_FILE = path.join(ADMIN_DIR, "published.json");

/* =========================================================
   基础工具
   ========================================================= */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error("JSON 读取失败:", filePath, error);
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function safeText(value) {
  return String(value ?? "").trim();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toSafeBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

ensureDir(ADMIN_DIR);
ensureDir(RULES_DIR);
ensureDir(JOBS_DIR);
ensureDir(CONTENT_BUILDS_DIR);
ensureDir(CONTENT_PUBLISHED_DIR);

/* =========================================================
   配置读取
   ========================================================= */
function loadLanguages() {
  return readJson(LANGUAGES_FILE, { languages: [] });
}

function loadScriptureVersions() {
  return readJson(SCRIPTURE_VERSIONS_FILE, { scriptureVersions: [] });
}

function saveScriptureVersions(data) {
  writeJson(SCRIPTURE_VERSIONS_FILE, data);
}

function loadContentVersions() {
  return readJson(CONTENT_VERSIONS_FILE, { contentVersions: [] });
}

function loadPublished() {
  return readJson(PUBLISHED_FILE, {});
}

function savePublished(published) {
  writeJson(PUBLISHED_FILE, published);
}

function loadRuleConfig(versionId) {
  const filePath = path.join(RULES_DIR, `${versionId}.json`);
  return readJson(filePath, null);
}

function getEnabledLanguages() {
  return (loadLanguages().languages || []).filter((x) => x.enabled);
}

function getEnabledContentVersions() {
  return (loadContentVersions().contentVersions || [])
    .filter((x) => x.enabled)
    .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
}

/* =========================================================
   书卷
   ========================================================= */
function flattenBooks() {
  return testamentOptions.flatMap((testament) =>
    testament.books.map((book) => ({
      testamentName: testament.name,
      bookId: book.usfx,
      bookCn: book.cn,
      bookEn: book.en || book.cn,
      chapters: book.chapters,
    }))
  );
}

function getBookById(bookId) {
  return flattenBooks().find((b) => b.bookId === bookId) || null;
}

function getBooksByTestament(testamentName) {
  return flattenBooks().filter((b) => b.testamentName === testamentName);
}

/* =========================================================
   圣经版本管理
   ========================================================= */
function normalizeScriptureVersion(input) {
  return {
    id: safeText(input.id),
    label: safeText(input.label),
    lang: safeText(input.lang),
    enabled: toSafeBool(input.enabled, true),
    uiEnabled: toSafeBool(input.uiEnabled, true),
    contentEnabled: toSafeBool(input.contentEnabled, true),
    scriptureEnabled: toSafeBool(input.scriptureEnabled, true),
    contentMode: safeText(input.contentMode) || "native",
    sourceType: safeText(input.sourceType) || "usfx",
    sourceFile: safeText(input.sourceFile),
    description: safeText(input.description),
    sortOrder: toSafeNumber(input.sortOrder, 999),
    updatedAt: nowIso(),
  };
}

function validateScriptureVersion(version) {
  if (!isNonEmptyString(version.id)) {
    throw new Error("圣经版本缺少 id");
  }
  if (!isNonEmptyString(version.label)) {
    throw new Error("圣经版本缺少 label");
  }
  if (!isNonEmptyString(version.lang)) {
    throw new Error("圣经版本缺少 lang");
  }
  if (!isNonEmptyString(version.sourceType)) {
    throw new Error("圣经版本缺少 sourceType");
  }
  if (!isNonEmptyString(version.sourceFile)) {
    throw new Error("圣经版本缺少 sourceFile");
  }
}

function getAllScriptureVersions() {
  return (loadScriptureVersions().scriptureVersions || []).sort(
    (a, b) => Number(a.sortOrder || 999) - Number(b.sortOrder || 999)
  );
}

function getEnabledScriptureVersions() {
  return getAllScriptureVersions().filter((x) => x.enabled);
}

function getScriptureVersionConfig(versionId) {
  return getAllScriptureVersions().find((v) => v.id === versionId) || null;
}

function getPrimaryScriptureVersionByLang(lang) {
  return (
    getEnabledScriptureVersions().find(
      (x) => x.lang === lang && x.scriptureEnabled !== false
    ) || null
  );
}

function upsertScriptureVersion(versionInput) {
  const normalized = normalizeScriptureVersion(versionInput);
  validateScriptureVersion(normalized);

  const current = loadScriptureVersions();
  const items = current.scriptureVersions || [];
  const idx = items.findIndex((x) => x.id === normalized.id);

  if (idx >= 0) {
    items[idx] = {
      ...items[idx],
      ...normalized,
    };
  } else {
    items.push({
      ...normalized,
      createdAt: nowIso(),
    });
  }

  saveScriptureVersions({ scriptureVersions: items });
  return normalized;
}

function deleteScriptureVersion(versionId) {
  const current = loadScriptureVersions();
  const items = current.scriptureVersions || [];
  const next = items.filter((x) => x.id !== versionId);

  if (next.length === items.length) {
    throw new Error("未找到要删除的圣经版本");
  }

  saveScriptureVersions({ scriptureVersions: next });
  return { deleted: true, id: versionId };
}

/* =========================================================
   USFX XML 缓存
   ========================================================= */
const xmlCache = new Map();

function loadXmlFileByPath(relativeOrAbsolutePath) {
  const filePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(__dirname, relativeOrAbsolutePath);

  if (xmlCache.has(filePath)) return xmlCache.get(filePath);

  const xml = fs.readFileSync(filePath, "utf8");
  xmlCache.set(filePath, xml);
  return xml;
}

/* =========================================================
   XML 解析
   ========================================================= */
function stripXml(text) {
  return String(text || "")
    .replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, " ")
    .replace(/<x\b[^>]*>[\s\S]*?<\/x>/g, " ")
    .replace(/<fig\b[^>]*>[\s\S]*?<\/fig>/g, " ")
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/g, " ")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractChapter(xml, bookCode, chapter) {
  const bookRe = new RegExp(
    `<book\\b[^>]*id="${bookCode}"[^>]*>([\\s\\S]*?)<\\/book>`,
    "i"
  );
  const bookMatch = xml.match(bookRe);
  if (!bookMatch) return [];

  const bookBody = bookMatch[1];
  const chapterRe = new RegExp(
    `<c\\b[^>]*id="${chapter}"[^>]*\\/>[\\s\\S]*?(?=<c\\b[^>]*id="\\d+"[^>]*\\/>|$)`,
    "i"
  );
  const chapterMatch = bookBody.match(chapterRe);
  if (!chapterMatch) return [];

  const chunk = chapterMatch[0];
  const verseRe1 = /<v\b[^>]*id="(\d+)"[^>]*\/>([\s\S]*?)<ve\/>/g;
  const verseRe2 =
    /<v\b[^>]*id="(\d+)"[^>]*\/>([\s\S]*?)(?=<v\b[^>]*id="\d+"[^>]*\/>|$)/g;

  const verses = [];
  let m;

  while ((m = verseRe1.exec(chunk)) !== null) {
    const verseNo = Number(m[1]);
    const verseText = stripXml(m[2]);
    if (verseText) verses.push({ verse: verseNo, text: verseText });
  }

  if (!verses.length) {
    while ((m = verseRe2.exec(chunk)) !== null) {
      const verseNo = Number(m[1]);
      const verseText = stripXml(m[2]);
      if (verseText) verses.push({ verse: verseNo, text: verseText });
    }
  }

  return verses;
}

/* =========================================================
   经文读取
   ========================================================= */
function getScriptureRowsForVersion({ scriptureVersionId, bookId, chapter }) {
  const scriptureConfig = getScriptureVersionConfig(scriptureVersionId);
  if (!scriptureConfig || scriptureConfig.enabled === false) {
    throw new Error(`未找到经文版本: ${scriptureVersionId}`);
  }

  const book = getBookById(bookId);
  if (!book) {
    throw new Error(`未识别书卷: ${bookId}`);
  }

  const chapterNum = Number(chapter);
  if (
    !Number.isInteger(chapterNum) ||
    chapterNum < 1 ||
    chapterNum > Number(book.chapters || 0)
  ) {
    throw new Error("章节范围不正确");
  }

  if (scriptureConfig.sourceType !== "usfx") {
    throw new Error(`暂不支持的经文源类型: ${scriptureConfig.sourceType}`);
  }

  const xml = loadXmlFileByPath(scriptureConfig.sourceFile);
  return extractChapter(xml, book.bookId, chapterNum);
}

function getMultiVersionScriptureRows({
  scriptureVersionIds,
  bookId,
  chapter,
}) {
  const ids = Array.isArray(scriptureVersionIds)
    ? scriptureVersionIds.filter(Boolean)
    : [];

  if (!ids.length) {
    throw new Error("缺少 scriptureVersionIds");
  }

  const allVersesMap = new Map();

  ids.forEach((versionId) => {
    const rows = getScriptureRowsForVersion({
      scriptureVersionId: versionId,
      bookId,
      chapter,
    });

    rows.forEach((row) => {
      const existing = allVersesMap.get(row.verse) || {
        verse: row.verse,
        texts: {},
      };
      existing.texts[versionId] = row.text;
      allVersesMap.set(row.verse, existing);
    });
  });

  return Array.from(allVersesMap.values()).sort((a, b) => a.verse - b.verse);
}

/* =========================================================
   内容路径
   ========================================================= */
function getBuildContentFilePath({
  buildId,
  versionId,
  lang,
  bookId,
  chapter,
}) {
  return path.join(
    CONTENT_BUILDS_DIR,
    buildId,
    versionId,
    lang,
    bookId,
    `${chapter}.json`
  );
}

function getPublishedContentFilePath({ versionId, lang, bookId, chapter }) {
  return path.join(
    CONTENT_PUBLISHED_DIR,
    versionId,
    lang,
    bookId,
    `${chapter}.json`
  );
}

function readPublishedContent({ versionId, lang, bookId, chapter }) {
  const filePath = getPublishedContentFilePath({
    versionId,
    lang,
    bookId,
    chapter,
  });
  return readJson(filePath, null);
}

/* =========================================================
   内容保存 / 发布
   ========================================================= */
function normalizeStudyContentForSave(input) {
  return {
    version: safeText(input.version),
    versionLabel: safeText(input.versionLabel),
    contentLang: safeText(input.contentLang),
    bookId: safeText(input.bookId),
    bookLabel: safeText(input.bookLabel),
    chapter: Number(input.chapter || 0),
    theme: safeText(input.theme),
    repeatedWords: Array.isArray(input.repeatedWords)
      ? input.repeatedWords
      : [],
    segments: Array.isArray(input.segments) ? input.segments : [],
    chapterLeaderHint: Array.isArray(input.chapterLeaderHint)
      ? input.chapterLeaderHint
      : [],
    closing: safeText(input.closing),
    title: safeText(input.title),
    generatedAt: safeText(input.generatedAt) || nowIso(),
    savedAt: nowIso(),
  };
}

function saveStudyContentToBuild(studyContent, buildId) {
  const normalized = normalizeStudyContentForSave(studyContent);

  if (!isNonEmptyString(normalized.version)) {
    throw new Error("保存失败：缺少 version");
  }
  if (!isNonEmptyString(normalized.contentLang)) {
    throw new Error("保存失败：缺少 contentLang");
  }
  if (!isNonEmptyString(normalized.bookId)) {
    throw new Error("保存失败：缺少 bookId");
  }
  if (!Number.isInteger(normalized.chapter) || normalized.chapter < 1) {
    throw new Error("保存失败：chapter 不正确");
  }

  const filePath = getBuildContentFilePath({
    buildId,
    versionId: normalized.version,
    lang: normalized.contentLang,
    bookId: normalized.bookId,
    chapter: normalized.chapter,
  });

  writeJson(filePath, normalized);
  return { filePath, savedContent: normalized };
}

function mergePublishOneChapter(studyContent) {
  const normalized = normalizeStudyContentForSave(studyContent);

  const filePath = getPublishedContentFilePath({
    versionId: normalized.version,
    lang: normalized.contentLang,
    bookId: normalized.bookId,
    chapter: normalized.chapter,
  });

  writeJson(filePath, normalized);
  return filePath;
}

function mergePublishFromBuild({ buildId, versionId, lang, targets }) {
  let publishedCount = 0;

  for (const target of targets) {
    if (target.versionId !== versionId || target.lang !== lang) continue;

    const sourcePath = getBuildContentFilePath({
      buildId,
      versionId,
      lang,
      bookId: target.bookId,
      chapter: target.chapter,
    });

    if (!fs.existsSync(sourcePath)) continue;

    const content = readJson(sourcePath, null);
    if (!content) continue;

    mergePublishOneChapter(content);
    publishedCount += 1;
  }

  const published = loadPublished();
  if (!published[versionId]) published[versionId] = {};
  if (!published[versionId][lang]) published[versionId][lang] = {};

  published[versionId][lang].publishMode = "merge";
  published[versionId][lang].lastMergedBuildId = buildId;
  published[versionId][lang].publishedAt = nowIso();
  published[versionId][lang].publishedCount =
    (published[versionId][lang].publishedCount || 0) + publishedCount;

  savePublished(published);

  return {
    published,
    publishedCount,
  };
}

function saveStudyContentAndPublish(studyContent) {
  const normalized = normalizeStudyContentForSave(studyContent);
  const buildId = `manual_${normalized.version}_${normalized.contentLang}`;

  const result = saveStudyContentToBuild(normalized, buildId);
  const mergeResult = mergePublishOneChapter(normalized);

  const published = loadPublished();
  if (!published[normalized.version]) published[normalized.version] = {};
  if (!published[normalized.version][normalized.contentLang]) {
    published[normalized.version][normalized.contentLang] = {};
  }

  published[normalized.version][normalized.contentLang].publishMode = "merge";
  published[normalized.version][normalized.contentLang].lastMergedBuildId =
    buildId;
  published[normalized.version][normalized.contentLang].publishedAt = nowIso();
  published[normalized.version][normalized.contentLang].publishedCount =
    (published[normalized.version][normalized.contentLang].publishedCount ||
      0) + 1;

  savePublished(published);

  return {
    buildId,
    filePath: result.filePath,
    publishedFilePath: mergeResult,
    published,
    savedContent: result.savedContent,
  };
}

/* =========================================================
   Prompt
   ========================================================= */
function buildLanguageInstruction(lang) {
  if (lang === "zh") {
    return "请使用自然、清晰、简洁的简体中文输出。";
  }
  if (lang === "en") {
    return "Output entirely in natural, clear, readable English.";
  }
  if (lang === "es") {
    return "Escribe completamente en español natural, claro y fácil de leer.";
  }
  return "Output in a clear and natural language matching the requested language.";
}

function buildRuleTextFromConfig(ruleConfig, lang) {
  const baseRules = ruleConfig?.baseRules || {};
  const languageProfile = ruleConfig?.languageProfiles?.[lang] || {};
  const styleTags = ruleConfig?.styleTags || [];
  const scene = ruleConfig?.scene || "小组查经";
  const template = ruleConfig?.template || "讨论版";

  const systemPromptOverride = safeText(ruleConfig?.systemPromptOverride);
  if (systemPromptOverride) return systemPromptOverride;

  return `
你是一个圣经查经内容生成助手。

你的任务：
根据给定经文，为用户生成适合“${scene}”场景使用的查经内容。

固定要求：
1. 按经文自然分段，不要平均机械切段。
2. 每一段只给 ${baseRules.minQuestionsPerSegment || 2} 到 ${
    baseRules.maxQuestionsPerSegment || 4
  } 个问题。
3. 问题要顺着经文推进，像从开始到结束一段一段查考。
4. 问题必须紧贴该段经文，不要泛泛而谈。
5. 风格模板：${template}。
6. 风格标签：${styleTags.join("、") || "简洁、生活化"}。
7. ${
    baseRules.leaderHint === false
      ? "不要输出整章带领提示。"
      : "可以输出整章带领提示。"
  }
8. ${
    baseRules.avoidRepeat === false
      ? "允许适度重复句式。"
      : "尽量避免不同段落重复使用同样句式。"
  }
9. 全章总问题数尽量控制在 ${baseRules.chapterQuestionMin || 15} 到 ${
    baseRules.chapterQuestionMax || 20
  } 个左右。
10. ${
    baseRules.allowLightApplication === false
      ? "不要强调应用延伸，只聚焦文本观察与理解。"
      : "可以有轻度应用，但不能脱离经文文本。"
  }
11. ${
    baseRules.allowGospelEmphasis
      ? "可以适度强调福音线索、人的光景、神的拯救与恩典。"
      : "不要强行拉向福音主题，先尊重文本本身。"
  }
12. ${
    baseRules.allowChildrenTone ? "语言要更简单、具体、短句化，适合儿童。" : ""
  }
13. ${
    baseRules.allowYouthTone
      ? "可以更多关注成长、身份、选择、同伴压力与真实生活。"
      : ""
  }
14. ${
    baseRules.allowCoupleTone
      ? "可以更多关注关系、沟通、信任、同心与家庭中的属灵同行。"
      : ""
  }
15. ${
    baseRules.allowWorkplaceTone
      ? "可以更多关注品格、决策、忠心、诚信、压力与职场处境。"
      : ""
  }
16. 输出必须是合法 JSON。
17. 不要输出 markdown 代码块，不要在 JSON 外说话。

语言要求：
${buildLanguageInstruction(lang)}

语言补充要求：
${languageProfile.customPrompt || "无"}
`.trim();
}

function buildUserTextForGeneration({
  bookId,
  chapter,
  scriptureRows,
  lang,
  primaryScriptureVersionId,
}) {
  const book = getBookById(bookId);
  const bookLabel =
    lang === "en" ? book?.bookEn || bookId : book?.bookCn || bookId;

  const scriptureText = scriptureRows
    .map((row) => {
      const verseText = row.texts?.[primaryScriptureVersionId] || "";
      return `${row.verse}. ${verseText}`;
    })
    .join("\n");

  return `
Please generate Bible study content for:

Book: ${bookLabel}
Chapter: ${chapter}
Language: ${lang}

Scripture:
${scriptureText}

Return strict JSON in this format:
{
  "title": "Title",
  "theme": "Theme",
  "repeatedWords": [
    { "word": "word1", "count": 3 }
  ],
  "segments": [
    {
      "title": "Segment title",
      "rangeStart": 1,
      "rangeEnd": 5,
      "questions": [
        "Question 1",
        "Question 2"
      ]
    }
  ],
  "chapterLeaderHint": [],
  "closing": ""
}
`.trim();
}

async function generateStudyWithRuleConfig({
  versionId,
  lang,
  bookId,
  chapter,
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("缺少 OPENAI_API_KEY");
  }

  const ruleConfig = loadRuleConfig(versionId);
  if (!ruleConfig) {
    throw new Error(`未找到规则配置: ${versionId}`);
  }

  const languages = loadLanguages().languages || [];
  const langConfig = languages.find((x) => x.id === lang && x.enabled);
  if (!langConfig) {
    throw new Error(`未启用的语言: ${lang}`);
  }

  const primaryScriptureVersion = getPrimaryScriptureVersionByLang(lang);
  if (!primaryScriptureVersion) {
    throw new Error(`未找到该语言的圣经版本: ${lang}`);
  }

  const scriptureRows = getMultiVersionScriptureRows({
    scriptureVersionIds: [primaryScriptureVersion.id],
    bookId,
    chapter,
  });

  const systemText = buildRuleTextFromConfig(ruleConfig, lang);
  const userText = buildUserTextForGeneration({
    bookId,
    chapter,
    scriptureRows,
    lang,
    primaryScriptureVersionId: primaryScriptureVersion.id,
  });

  const response = await client.responses.create({
    model: "gpt-5.4",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemText }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userText }],
      },
    ],
  });

  const rawText = response.output_text;
  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    console.error("模型原始输出：", rawText);
    throw new Error("模型返回的不是合法 JSON");
  }

  const book = getBookById(bookId);

  return {
    version: versionId,
    versionLabel:
      getEnabledContentVersions().find((x) => x.id === versionId)?.label ||
      versionId,
    contentLang: lang,
    bookId,
    bookLabel: lang === "en" ? book?.bookEn || bookId : book?.bookCn || bookId,
    chapter: Number(chapter),
    theme: parsed.theme || "",
    repeatedWords: parsed.repeatedWords || [],
    segments: parsed.segments || [],
    chapterLeaderHint: parsed.chapterLeaderHint || [],
    closing: parsed.closing || "",
    title: parsed.title || "",
    generatedAt: nowIso(),
  };
}

/* =========================================================
   批量任务
   ========================================================= */
function getAllEnabledVersionIds() {
  return getEnabledContentVersions().map((x) => x.id);
}

function getAllEnabledLanguageIds() {
  return getEnabledLanguages().map((x) => x.id);
}

function resolveVersionIds(versionMode, version) {
  if (versionMode === "all_enabled") {
    return getAllEnabledVersionIds();
  }
  return isNonEmptyString(version) ? [version] : [];
}

function resolveLanguageIds(langMode, lang) {
  if (langMode === "all_enabled") {
    return getAllEnabledLanguageIds();
  }
  return isNonEmptyString(lang) ? [lang] : [];
}

function createBookRangeTargets(bookId, startChapter, endChapter) {
  const book = getBookById(bookId);
  if (!book) throw new Error("未找到 bookId");

  const start = Number(startChapter || 1);
  const end = Number(endChapter || book.chapters);

  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new Error("章节范围必须是整数");
  }
  if (start < 1 || end < 1 || start > end || end > Number(book.chapters)) {
    throw new Error("章节范围不正确");
  }

  return Array.from({ length: end - start + 1 }, (_, i) => ({
    bookId,
    chapter: start + i,
  }));
}

function buildChapterTargetsForScope(scope, payload) {
  if (scope === "chapter") {
    const bookId = safeText(payload.bookId);
    const chapter = Number(payload.chapter || 0);
    if (!bookId || !chapter) {
      throw new Error("chapter 任务缺少 bookId 或 chapter");
    }
    return [{ bookId, chapter }];
  }

  if (scope === "book") {
    const bookId = safeText(payload.bookId);
    const hasRange =
      payload.startChapter !== undefined || payload.endChapter !== undefined;

    if (hasRange) {
      return createBookRangeTargets(
        bookId,
        payload.startChapter,
        payload.endChapter
      );
    }

    const book = getBookById(bookId);
    if (!book) throw new Error("未找到 bookId");
    return Array.from({ length: Number(book.chapters) }, (_, i) => ({
      bookId,
      chapter: i + 1,
    }));
  }

  if (scope === "old_testament") {
    return getBooksByTestament("旧约").flatMap((book) =>
      Array.from({ length: Number(book.chapters) }, (_, i) => ({
        bookId: book.bookId,
        chapter: i + 1,
      }))
    );
  }

  if (scope === "new_testament") {
    return getBooksByTestament("新约").flatMap((book) =>
      Array.from({ length: Number(book.chapters) }, (_, i) => ({
        bookId: book.bookId,
        chapter: i + 1,
      }))
    );
  }

  if (scope === "bible") {
    return flattenBooks().flatMap((book) =>
      Array.from({ length: Number(book.chapters) }, (_, i) => ({
        bookId: book.bookId,
        chapter: i + 1,
      }))
    );
  }

  throw new Error(`不支持的 scope: ${scope}`);
}

function resolveTargetsFromPayload(payload) {
  const scope = safeText(payload.scope || "chapter");
  const versionIds = resolveVersionIds(payload.versionMode, payload.version);
  const langIds = resolveLanguageIds(payload.langMode, payload.lang);

  if (!versionIds.length) {
    throw new Error("没有可用的内容版本");
  }
  if (!langIds.length) {
    throw new Error("没有可用的语言");
  }

  const chapters = buildChapterTargetsForScope(scope, payload);
  const targets = [];

  for (const versionId of versionIds) {
    for (const lang of langIds) {
      for (const item of chapters) {
        targets.push({
          versionId,
          lang,
          bookId: item.bookId,
          chapter: item.chapter,
        });
      }
    }
  }

  return targets;
}

function createBuildIdForJob(payload) {
  const scope = safeText(payload.scope || "chapter");
  const versionPart =
    payload.versionMode === "all_enabled"
      ? "allv"
      : safeText(payload.version || "noversion");
  const langPart =
    payload.langMode === "all_enabled"
      ? "alll"
      : safeText(payload.lang || "nolang");
  return `build_${Date.now()}_${scope}_${versionPart}_${langPart}`;
}

function getJobFilePath(jobId) {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

function readJob(jobId) {
  return readJson(getJobFilePath(jobId), null);
}

function writeJob(job) {
  writeJson(getJobFilePath(job.id), job);
}

function listAllJobsNewestFirst() {
  ensureDir(JOBS_DIR);
  return fs
    .readdirSync(JOBS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(JOBS_DIR, f), null))
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function createBulkJob(payload) {
  const targets = resolveTargetsFromPayload(payload);
  const jobId = `job_${Date.now()}`;
  const buildId = createBuildIdForJob(payload);

  const job = {
    id: jobId,
    type: "bulk_generate",
    scope: safeText(payload.scope || "chapter"),
    versionMode: safeText(payload.versionMode || "single"),
    version: safeText(payload.version || ""),
    langMode: safeText(payload.langMode || "single"),
    lang: safeText(payload.lang || ""),
    bookId: safeText(payload.bookId || ""),
    chapter: payload.chapter ? Number(payload.chapter) : null,
    startChapter:
      payload.startChapter !== undefined ? Number(payload.startChapter) : null,
    endChapter:
      payload.endChapter !== undefined ? Number(payload.endChapter) : null,
    autoPublish: payload.autoPublish === true,
    buildId,
    status: "queued",
    done: 0,
    total: targets.length,
    targets,
    errors: [],
    startedAt: "",
    finishedAt: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    progressText: "排队中",
    completionSummary: "",
    retryOfJobId: safeText(payload.retryOfJobId || ""),
  };

  writeJob(job);
  return job;
}

function createRetryFailedJob(sourceJobId) {
  const sourceJob = readJob(sourceJobId);
  if (!sourceJob) {
    throw new Error("原任务不存在");
  }

  const failedTargets = (sourceJob.errors || [])
    .map((err) => err.target)
    .filter(Boolean);

  if (!failedTargets.length) {
    throw new Error("这个任务没有失败章节可重跑");
  }

  const jobId = `job_${Date.now()}`;
  const buildId = `build_${Date.now()}_retry_${sourceJobId}`;

  const job = {
    id: jobId,
    type: "retry_failed",
    scope: sourceJob.scope || "book",
    versionMode: sourceJob.versionMode || "single",
    version: sourceJob.version || "",
    langMode: sourceJob.langMode || "single",
    lang: sourceJob.lang || "",
    bookId: sourceJob.bookId || "",
    chapter: sourceJob.chapter || null,
    startChapter: sourceJob.startChapter || null,
    endChapter: sourceJob.endChapter || null,
    autoPublish: true,
    buildId,
    status: "queued",
    done: 0,
    total: failedTargets.length,
    targets: failedTargets,
    errors: [],
    startedAt: "",
    finishedAt: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    progressText: `重跑失败章节，来源任务 ${sourceJobId}`,
    completionSummary: "",
    retryOfJobId: sourceJobId,
  };

  writeJob(job);
  return job;
}

function buildCompletionSummary(job) {
  const successCount = Math.max(
    0,
    Number(job.done || 0) - Number(job.errors?.length || 0)
  );
  const errorCount = Number(job.errors?.length || 0);
  const autoPublished = job.autoPublish ? "已自动合并发布" : "未自动发布";
  return `完成：成功 ${successCount}，失败 ${errorCount}，${autoPublished}`;
}

async function processBulkJob(job) {
  job.status = "running";
  job.startedAt = job.startedAt || nowIso();
  job.updatedAt = nowIso();
  job.progressText = "开始执行";
  writeJob(job);

  for (let i = job.done; i < job.targets.length; i += 1) {
    const latestJob = readJob(job.id);
    if (!latestJob) return;

    if (latestJob.status === "cancelled") {
      latestJob.updatedAt = nowIso();
      latestJob.progressText = "任务已取消";
      latestJob.completionSummary = "已取消";
      writeJob(latestJob);
      return;
    }

    const target = latestJob.targets[i];

    try {
      latestJob.progressText = `正在生成 ${target.versionId} / ${target.lang} / ${target.bookId} / ${target.chapter}`;
      latestJob.updatedAt = nowIso();
      writeJob(latestJob);

      const result = await generateStudyWithRuleConfig({
        versionId: target.versionId,
        lang: target.lang,
        bookId: target.bookId,
        chapter: target.chapter,
      });

      saveStudyContentToBuild(result, latestJob.buildId);

      latestJob.done = i + 1;
      latestJob.updatedAt = nowIso();
      latestJob.progressText = `已完成 ${latestJob.done} / ${latestJob.total}`;
      writeJob(latestJob);

      await sleep(150);
    } catch (error) {
      latestJob.done = i + 1;
      latestJob.errors.push({
        index: i,
        target,
        message: error.message || "未知错误",
        at: nowIso(),
      });
      latestJob.updatedAt = nowIso();
      latestJob.progressText = `有错误，已完成 ${latestJob.done} / ${latestJob.total}`;
      writeJob(latestJob);
    }
  }

  const finalJob = readJob(job.id);
  if (!finalJob) return;

  finalJob.status = "completed";
  finalJob.finishedAt = nowIso();
  finalJob.updatedAt = nowIso();
  finalJob.progressText = `任务完成：${finalJob.done} / ${finalJob.total}`;

  if (finalJob.autoPublish) {
    const touchedPairs = new Set(
      finalJob.targets.map((x) => `${x.versionId}__${x.lang}`)
    );

    for (const pair of touchedPairs) {
      const [versionId, lang] = pair.split("__");
      mergePublishFromBuild({
        buildId: finalJob.buildId,
        versionId,
        lang,
        targets: finalJob.targets,
      });
    }

    finalJob.progressText += "，并已自动合并发布";
  }

  finalJob.completionSummary = buildCompletionSummary(finalJob);
  writeJob(finalJob);
}

/* =========================================================
   已发布内容管理
   ========================================================= */
function listPublishedBookChapters(versionId, lang, bookId) {
  const book = getBookById(bookId);
  if (!book) {
    throw new Error("未找到书卷");
  }

  const bookDir = path.join(CONTENT_PUBLISHED_DIR, versionId, lang, bookId);
  const existing = [];

  if (fs.existsSync(bookDir)) {
    for (const fileName of fs.readdirSync(bookDir)) {
      if (!fileName.endsWith(".json")) continue;
      const chapter = Number(fileName.replace(".json", ""));
      if (Number.isInteger(chapter)) existing.push(chapter);
    }
  }

  existing.sort((a, b) => a - b);

  const allChapters = Array.from(
    { length: Number(book.chapters) },
    (_, i) => i + 1
  );
  const missing = allChapters.filter((n) => !existing.includes(n));

  return {
    bookId,
    bookCn: book.bookCn,
    bookEn: book.bookEn,
    totalChapters: Number(book.chapters),
    publishedChapters: existing,
    missingChapters: missing,
    publishedCount: existing.length,
  };
}

function listPublishedOverview(versionId, lang) {
  const books = flattenBooks();
  const items = books.map((book) =>
    listPublishedBookChapters(versionId, lang, book.bookId)
  );

  const summary = {
    version: versionId,
    lang,
    totalBooks: items.length,
    booksWithAnyPublished: items.filter((x) => x.publishedCount > 0).length,
    totalPublishedChapters: items.reduce((sum, x) => sum + x.publishedCount, 0),
    totalMissingChapters: items.reduce(
      (sum, x) => sum + x.missingChapters.length,
      0
    ),
  };

  return {
    summary,
    books: items,
  };
}

function deletePublishedChapter(versionId, lang, bookId, chapter) {
  const filePath = getPublishedContentFilePath({
    versionId,
    lang,
    bookId,
    chapter,
  });

  if (!fs.existsSync(filePath)) {
    throw new Error("该章已发布内容不存在");
  }

  fs.unlinkSync(filePath);
  return { deleted: true, filePath };
}

function republishOneChapterFromBuild({
  buildId,
  versionId,
  lang,
  bookId,
  chapter,
}) {
  const sourcePath = getBuildContentFilePath({
    buildId,
    versionId,
    lang,
    bookId,
    chapter,
  });

  if (!fs.existsSync(sourcePath)) {
    throw new Error("build 中未找到该章内容");
  }

  const content = readJson(sourcePath, null);
  if (!content) {
    throw new Error("build 章节内容读取失败");
  }

  const publishedPath = mergePublishOneChapter(content);

  const published = loadPublished();
  if (!published[versionId]) published[versionId] = {};
  if (!published[versionId][lang]) published[versionId][lang] = {};

  published[versionId][lang].publishMode = "merge";
  published[versionId][lang].lastMergedBuildId = buildId;
  published[versionId][lang].publishedAt = nowIso();
  published[versionId][lang].publishedCount =
    (published[versionId][lang].publishedCount || 0) + 1;
  savePublished(published);

  return {
    publishedPath,
    content,
  };
}

function findLatestBuildForChapter({ versionId, lang, bookId, chapter }) {
  const jobs = listAllJobsNewestFirst();

  for (const job of jobs) {
    if (job.status !== "completed") continue;
    if (!isNonEmptyString(job.buildId)) continue;

    const candidatePath = getBuildContentFilePath({
      buildId: job.buildId,
      versionId,
      lang,
      bookId,
      chapter,
    });

    if (fs.existsSync(candidatePath)) {
      return {
        jobId: job.id,
        buildId: job.buildId,
        path: candidatePath,
      };
    }
  }

  return null;
}

function autoRepublishChapter({ versionId, lang, bookId, chapter }) {
  const found = findLatestBuildForChapter({ versionId, lang, bookId, chapter });

  if (!found) {
    throw new Error("未找到可用于自动补发的来源记录");
  }

  const result = republishOneChapterFromBuild({
    buildId: found.buildId,
    versionId,
    lang,
    bookId,
    chapter,
  });

  return {
    sourceJobId: found.jobId,
    sourceBuildId: found.buildId,
    ...result,
  };
}

/* =========================================================
   任务执行器
   ========================================================= */
let jobRunnerStarted = false;
let isJobRunnerBusy = false;

async function runJobRunnerLoop() {
  if (isJobRunnerBusy) return;
  isJobRunnerBusy = true;

  try {
    while (true) {
      const jobs = fs
        .readdirSync(JOBS_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJson(path.join(JOBS_DIR, f), null))
        .filter(Boolean)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

      const queuedJob = jobs.find((j) => j.status === "queued");
      if (!queuedJob) break;

      await processBulkJob(queuedJob);
    }
  } catch (error) {
    console.error("任务执行器异常:", error);
  } finally {
    isJobRunnerBusy = false;
  }
}

function startJobRunner() {
  if (jobRunnerStarted) return;
  jobRunnerStarted = true;

  setInterval(() => {
    runJobRunnerLoop().catch((error) => {
      console.error("runJobRunnerLoop error:", error);
    });
  }, 2000);
}

/* =========================================================
   前台接口
   ========================================================= */
app.get("/api/front/bootstrap", (_req, res) => {
  try {
    const uiLanguages = (loadLanguages().languages || []).filter(
      (x) => x.uiEnabled
    );

    const scriptureVersions = getEnabledScriptureVersions()
      .filter((x) => x.uiEnabled !== false && x.scriptureEnabled !== false)
      .map((x) => ({
        id: x.id,
        label: x.label,
        lang: x.lang,
        description: x.description || "",
        sortOrder: Number(x.sortOrder || 999),
      }));

    const contentVersions = getEnabledContentVersions().map((x) => ({
      id: x.id,
      label: x.label,
    }));

    const defaultPrimary =
      scriptureVersions.find((x) => x.lang === "zh")?.id ||
      scriptureVersions[0]?.id ||
      "";

    res.json({
      uiLanguages,
      scriptureVersions,
      contentVersions,
      defaultState: {
        uiLang: "zh",
        primaryScriptureVersionId: defaultPrimary,
        secondaryScriptureVersionIds: [],
        contentVersionId: "default",
        contentLang: "zh",
      },
      testamentOptions: flattenBooks(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "bootstrap 失败" });
  }
});

app.get("/api/scripture", (req, res) => {
  try {
    const { bookId, chapter, versions } = req.query;

    if (!bookId || !chapter || !versions) {
      return res.status(400).json({
        error: "缺少 bookId / chapter / versions",
      });
    }

    const scriptureVersionIds = String(versions)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const rows = getMultiVersionScriptureRows({
      scriptureVersionIds,
      bookId: String(bookId),
      chapter: Number(chapter),
    });

    res.json({ rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "经文读取失败",
    });
  }
});

app.get("/api/study-content", (req, res) => {
  try {
    const { version, lang, bookId, chapter } = req.query;

    if (!version || !lang || !bookId || !chapter) {
      return res.status(400).json({
        error: "缺少 version / lang / bookId / chapter",
      });
    }

    const data = readPublishedContent({
      versionId: String(version),
      lang: String(lang),
      bookId: String(bookId),
      chapter: Number(chapter),
    });

    if (!data) {
      return res.status(404).json({
        error: "未找到已发布内容",
      });
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "读取内容失败",
    });
  }
});

/* =========================================================
   后台初始化
   ========================================================= */
app.get("/api/admin/bootstrap", (_req, res) => {
  try {
    res.json({
      languages: loadLanguages().languages || [],
      scriptureVersions: getAllScriptureVersions(),
      contentVersions: loadContentVersions().contentVersions || [],
      published: loadPublished(),
      books: flattenBooks(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "后台初始化失败" });
  }
});

/* =========================================================
   圣经版本管理接口
   ========================================================= */
app.get("/api/admin/scripture-versions", (_req, res) => {
  try {
    res.json({
      scriptureVersions: getAllScriptureVersions(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "读取圣经版本失败" });
  }
});

app.post("/api/admin/scripture-version/save", (req, res) => {
  try {
    const { scriptureVersion } = req.body || {};
    if (!scriptureVersion || typeof scriptureVersion !== "object") {
      return res.status(400).json({ error: "缺少 scriptureVersion" });
    }

    const saved = upsertScriptureVersion(scriptureVersion);
    res.json({ ok: true, scriptureVersion: saved });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "保存圣经版本失败" });
  }
});

app.delete("/api/admin/scripture-version", (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "缺少 id" });
    }

    const result = deleteScriptureVersion(String(id));
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "删除圣经版本失败" });
  }
});

/* =========================================================
   规则
   ========================================================= */
app.get("/api/admin/rule", (req, res) => {
  try {
    const { version } = req.query;
    if (!version) {
      return res.status(400).json({ error: "缺少 version" });
    }

    const ruleConfig = loadRuleConfig(String(version));
    if (!ruleConfig) {
      return res.status(404).json({ error: "未找到规则" });
    }

    res.json(ruleConfig);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "读取规则失败" });
  }
});

app.post("/api/admin/rule/save", (req, res) => {
  try {
    const { version, ruleConfig } = req.body || {};
    if (!version || !ruleConfig) {
      return res.status(400).json({ error: "缺少 version 或 ruleConfig" });
    }

    const filePath = path.join(RULES_DIR, `${version}.json`);
    writeJson(filePath, ruleConfig);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "保存规则失败" });
  }
});

/* =========================================================
   单章测试
   ========================================================= */
app.post("/api/admin/test-generate", async (req, res) => {
  try {
    const { version, lang, bookId, chapter } = req.body || {};

    if (!version || !lang || !bookId || !chapter) {
      return res.status(400).json({
        error: "缺少 version / lang / bookId / chapter",
      });
    }

    const result = await generateStudyWithRuleConfig({
      versionId: String(version),
      lang: String(lang),
      bookId: String(bookId),
      chapter: Number(chapter),
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "测试生成失败",
    });
  }
});

/* =========================================================
   保存测试结果
   ========================================================= */
app.post("/api/admin/save-test-result", (req, res) => {
  try {
    const { studyContent } = req.body || {};

    if (!studyContent || typeof studyContent !== "object") {
      return res.status(400).json({
        error: "缺少 studyContent",
      });
    }

    const result = saveStudyContentAndPublish(studyContent);

    res.json({
      ok: true,
      message: "测试结果已保存并合并发布",
      buildId: result.buildId,
      savedContent: result.savedContent,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "保存测试结果失败",
    });
  }
});

/* =========================================================
   批量任务接口
   ========================================================= */
app.post("/api/admin/job/create", (req, res) => {
  try {
    const payload = req.body || {};
    const job = createBulkJob(payload);
    runJobRunnerLoop().catch((error) => {
      console.error("手动触发任务执行器失败:", error);
    });

    res.json({
      ok: true,
      job,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "创建任务失败" });
  }
});

app.post("/api/admin/job/:id/retry-failed", (req, res) => {
  try {
    const retryJob = createRetryFailedJob(req.params.id);
    runJobRunnerLoop().catch((error) => {
      console.error("手动触发任务执行器失败:", error);
    });

    res.json({
      ok: true,
      job: retryJob,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "重跑失败章节失败" });
  }
});

app.get("/api/admin/jobs", (_req, res) => {
  try {
    const jobs = listAllJobsNewestFirst();
    res.json({ jobs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "读取任务失败" });
  }
});

app.get("/api/admin/job/:id", (req, res) => {
  try {
    const job = readJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "任务不存在" });
    }
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "读取任务详情失败" });
  }
});

app.post("/api/admin/job/:id/cancel", (req, res) => {
  try {
    const job = readJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "任务不存在" });
    }

    if (job.status === "completed") {
      return res.status(400).json({ error: "已完成任务不能取消" });
    }

    job.status = "cancelled";
    job.updatedAt = nowIso();
    job.progressText = "任务已取消";
    job.completionSummary = "已取消";
    writeJob(job);

    res.json({ ok: true, job });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "取消任务失败" });
  }
});

/* =========================================================
   手动合并发布
   ========================================================= */
app.post("/api/admin/publish", (req, res) => {
  try {
    const { buildId, version, lang, targets } = req.body || {};
    if (!buildId || !version || !lang || !Array.isArray(targets)) {
      return res.status(400).json({
        error: "缺少 buildId / version / lang / targets",
      });
    }

    const result = mergePublishFromBuild({
      buildId,
      versionId: version,
      lang,
      targets,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "合并发布失败" });
  }
});

/* =========================================================
   已发布内容管理接口
   ========================================================= */
app.get("/api/admin/published/overview", (req, res) => {
  try {
    const { version, lang } = req.query;
    if (!version || !lang) {
      return res.status(400).json({ error: "缺少 version 或 lang" });
    }

    const result = listPublishedOverview(String(version), String(lang));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "读取发布概览失败" });
  }
});

app.get("/api/admin/published/chapter", (req, res) => {
  try {
    const { version, lang, bookId, chapter } = req.query;
    if (!version || !lang || !bookId || !chapter) {
      return res
        .status(400)
        .json({ error: "缺少 version / lang / bookId / chapter" });
    }

    const data = readPublishedContent({
      versionId: String(version),
      lang: String(lang),
      bookId: String(bookId),
      chapter: Number(chapter),
    });

    if (!data) {
      return res.status(404).json({ error: "未找到已发布章节" });
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "读取已发布章节失败" });
  }
});

app.delete("/api/admin/published/chapter", (req, res) => {
  try {
    const { version, lang, bookId, chapter } = req.query;
    if (!version || !lang || !bookId || !chapter) {
      return res
        .status(400)
        .json({ error: "缺少 version / lang / bookId / chapter" });
    }

    const result = deletePublishedChapter(
      String(version),
      String(lang),
      String(bookId),
      Number(chapter)
    );

    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "删除已发布章节失败" });
  }
});

app.post("/api/admin/published/auto-republish-chapter", (req, res) => {
  try {
    const { version, lang, bookId, chapter } = req.body || {};
    if (!version || !lang || !bookId || !chapter) {
      return res.status(400).json({
        error: "缺少 version / lang / bookId / chapter",
      });
    }

    const result = autoRepublishChapter({
      versionId: String(version),
      lang: String(lang),
      bookId: String(bookId),
      chapter: Number(chapter),
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "自动补发失败" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
  startJobRunner();
});
