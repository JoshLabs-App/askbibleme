import type { AppLocale } from "../i18n/config";
import {
  HEIDELBERG_INTRO_LORD_DAY,
  HEIDELBERG_LORDS_DAY_COUNT,
  HEIDELBERG_PARTS,
} from "./heidelberg-catechism-outline.mjs";

export const CREED_BODY_SECTION_MIN_INDEXED = 11;

/** Full text always visible — no per-article accordion (Chicago statements). */
export const CREEDS_FLAT_FULL_BODY: ReadonlySet<string> = new Set([
  "chicago-inerrancy",
  "chicago-hermeneutics",
]);

export function shouldRenderCreedBodyFlat(creedId: string): boolean {
  return CREEDS_FLAT_FULL_BODY.has(creedId);
}

export type CreedBodySectionUnit =
  | "article"
  | "chapter"
  | "lords-day"
  | "catechism-topic"
  | "question";

export type CreedBodySection = {
  id: string;
  label: string;
  paragraphs: string[];
  /** Westminster catechisms: part → topic hierarchy. */
  subsections?: CreedBodySection[];
  rangeStart: number;
  rangeEnd: number;
};

export function creedBodySectionHasSubsections(
  section: CreedBodySection,
): section is CreedBodySection & { subsections: CreedBodySection[] } {
  return Array.isArray(section.subsections) && section.subsections.length > 0;
}

export type SectionedCreedBody = {
  intro: string[];
  sections: CreedBodySection[];
};

const DOCTRINE_SECTION_HEAD =
  /^第[一二三四五六七八九十百千]+項教[义義]/;

function firstLine(paragraph: string): string {
  return paragraph.trim().split("\n")[0]?.trim() ?? "";
}

function isDoctrineSectionHead(paragraph: string): boolean {
  return DOCTRINE_SECTION_HEAD.test(firstLine(paragraph));
}

/** Leading index: 第 N 条 / 第 N 章 / 主日 N / 问 N / Article N */
export function extractCreedParagraphIndex(paragraph: string): number | null {
  const line = firstLine(paragraph);
  const patterns = [
    /^主日\s*(\d+)/,
    /^主日([一二三四五六七八九十百]+)/,
    /^第\s*(\d+)\s*条/,
    /^第\s*(\d+)\s*條/,
    /^第(\d+)条/,
    /^第(\d+)條/,
    /^(?:问|問)\s*([0-9０-９]+)/,
    /^Q\.?\s*(\d+)/i,
    /^Article\s+(\d+)/i,
    /^第\s*(\d+)\s*章/,
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.[1]) {
      const value = /^[\d０-９]+$/.test(match[1])
        ? parseInt(match[1].replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30)), 10)
        : cnNumeralToInt(match[1]);
      if (Number.isFinite(value) && value != null) return value;
    }
  }
  return null;
}

function cnNumeralToInt(raw: string): number | null {
  const map: Record<string, number> = {
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
  };
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  if (raw.length === 1) return map[raw] ?? null;
  if (raw.startsWith("十")) return 10 + (map[raw[1]] ?? 0);
  if (raw.endsWith("十")) return (map[raw[0]] ?? 0) * 10;
  if (raw.includes("十")) {
    const [a, , b] = [...raw];
    return (map[a] ?? 0) * 10 + (map[b] ?? 0);
  }
  return null;
}

function isLordsDayHeaderParagraph(paragraph: string): boolean {
  const line = firstLine(paragraph);
  if (!LORDS_DAY_LINE.test(line)) return false;
  const trimmed = paragraph.trim();
  return trimmed === line || !/^(?:问|問)|^Q\./m.test(trimmed);
}

const LORDS_DAY_LINE = /^主日\s*[\d一二三四五六七八九十]+|^Lord'?s Day\s*\d+/i;

const CATECHISM_TOPIC_LINE =
  /^(?:引言|序言|Preface|Introduction)$|^[一二三四五六七八九十]+、[^问問]{2,30}$|^(?:Introduction|[IVX]+\.)\s+\S/i;

const WESTMINSTER_PART_LINE = /^第[一二三四五六七八九十]+部分|^PART\s+[IVXLC]+/i;

function isWestminsterPartHeaderParagraph(paragraph: string): boolean {
  const line = firstLine(paragraph);
  return WESTMINSTER_PART_LINE.test(line);
}

function isCatechismTopicHeaderParagraph(paragraph: string): boolean {
  const line = firstLine(paragraph);
  if (!CATECHISM_TOPIC_LINE.test(line)) return false;
  if (/^第[一二三四五六七八九十]+部分/.test(line) || /^PART\s+[IVXLC]+/i.test(line)) {
    return false;
  }
  const trimmed = paragraph.trim();
  return trimmed === line || !/^(?:问|問)|^Q\./m.test(trimmed);
}

function extractLordsDayNumber(paragraph: string): number | null {
  const line = firstLine(paragraph);
  const zh = line.match(/^主日\s*(\d+)/);
  if (zh) return parseInt(zh[1], 10);
  const en = line.match(/^Lord'?s Day\s*(\d+)/i);
  if (en) return parseInt(en[1], 10);
  return null;
}

function detectSectionUnit(paragraphs: string[]): CreedBodySectionUnit {
  let topicHeaders = 0;
  let hasLordsDay = false;
  let hasChapter = false;
  let hasQuestion = false;

  for (const paragraph of paragraphs) {
    const line = firstLine(paragraph);
    if (LORDS_DAY_LINE.test(line)) hasLordsDay = true;
    if (isCatechismTopicHeaderParagraph(paragraph)) topicHeaders++;
    if (/^第\s*\d+\s*章/.test(line) || /^第\d+章/.test(line)) hasChapter = true;
    if (/^(?:问|問)\s*[0-9０-９]+/.test(line) || /^Q\.?\s*\d+/i.test(line)) hasQuestion = true;
  }

  if (hasLordsDay) return "lords-day";
  if (topicHeaders >= 8) return "catechism-topic";
  if (hasChapter) return "chapter";
  if (hasQuestion) return "question";
  return "article";
}

function indexedItemSectionLabel(paragraphs: string[]): string {
  const raw = paragraphs[0]?.trim() ?? "";
  if (!raw) return "";
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  let head = lines[0] ?? "";
  if (
    lines.length > 1 &&
    (/^第\s*\d+\s*[条條]$/.test(head) ||
      /^Article\s+\d+$/i.test(head) ||
      /^第\s*\d+\s*章$/.test(head))
  ) {
    const sub = lines[1];
    const subLooksLikeTitle = sub.length <= 40 && !/[。；]/.test(sub);
    if (subLooksLikeTitle) {
      head = `${head.replace(/[：:]$/, "")}：${sub}`;
    }
  }
  if (head.length <= 96) return head;
  return `${head.slice(0, 93)}…`;
}

function buildIndexedItemSections(paragraphs: string[]): {
  intro: string[];
  items: CreedBodySection[];
} {
  const intro: string[] = [];
  const items: CreedBodySection[] = [];
  let currentDoctrine: string | null = null;
  let current: CreedBodySection | null = null;
  let seq = 0;

  const closeCurrent = () => {
    if (current && current.paragraphs.length > 0) {
      items.push(current);
    }
    current = null;
  };

  for (const paragraph of paragraphs) {
    if (isDoctrineSectionHead(paragraph)) {
      closeCurrent();
      currentDoctrine = firstLine(paragraph);
      continue;
    }

    const index = extractCreedParagraphIndex(paragraph);
    if (index != null) {
      closeCurrent();
      seq += 1;
      const labelBase = indexedItemSectionLabel([paragraph]);
      const label =
        currentDoctrine && !labelBase.includes(currentDoctrine)
          ? `${currentDoctrine} · ${labelBase}`
          : labelBase;
      current = {
        id: `item-${seq}`,
        label,
        paragraphs: [paragraph],
        rangeStart: index,
        rangeEnd: index,
      };
      continue;
    }

    if (current) {
      current.paragraphs.push(paragraph);
    } else {
      intro.push(paragraph);
    }
  }

  closeCurrent();
  return { intro, items };
}

function sectionLabel(
  start: number,
  end: number,
  unit: CreedBodySectionUnit,
  locale: AppLocale,
): string {
  if (locale === "en") {
    if (unit === "lords-day") {
      return start === end ? `Lord's Day ${start}` : `Lord's Days ${start}–${end}`;
    }
    if (unit === "chapter") {
      return start === end ? `Chapter ${start}` : `Chapters ${start}–${end}`;
    }
    if (unit === "question") {
      return start === end ? `Question ${start}` : `Questions ${start}–${end}`;
    }
    return start === end ? `Article ${start}` : `Articles ${start}–${end}`;
  }
  if (unit === "lords-day") {
    if (start === end) {
      return locale === "zh-TW" ? `主日 ${start}` : `主日 ${start}`;
    }
    return locale === "zh-TW" ? `主日 ${start}–${end}` : `主日 ${start}–${end}`;
  }
  if (unit === "chapter") {
    if (start === end) {
      return locale === "zh-TW" ? `第 ${start} 章` : `第 ${start} 章`;
    }
    return locale === "zh-TW" ? `第 ${start}–${end} 章` : `第 ${start}–${end} 章`;
  }
  if (unit === "question") {
    if (start === end) {
      return locale === "zh-TW" ? `問 ${start}` : `问 ${start}`;
    }
    return locale === "zh-TW" ? `問 ${start}–${end}` : `问 ${start}–${end}`;
  }
  if (start === end) {
    return locale === "zh-TW" ? `第 ${start} 條` : `第 ${start} 条`;
  }
  return locale === "zh-TW" ? `第 ${start}–${end} 條` : `第 ${start}–${end} 条`;
}

function resolveHeidelbergPartTitle(
  part: (typeof HEIDELBERG_PARTS)[number],
  locale: AppLocale,
): string {
  if (locale === "en") return part.titleEn;
  if (locale === "zh-TW") return part.titleZhTw;
  return part.titleZh;
}

function parseLordsDayBlocks(paragraphs: string[]): {
  intro: string[];
  dayBlocks: Array<{ day: number; paragraphs: string[] }>;
} {
  const intro: string[] = [];
  const dayBlocks: Array<{ day: number; paragraphs: string[] }> = [];
  let current: { day: number; paragraphs: string[] } | null = null;

  for (const paragraph of paragraphs) {
    if (isLordsDayHeaderParagraph(paragraph)) {
      const day = extractLordsDayNumber(paragraph);
      if (day != null) {
        if (current) dayBlocks.push(current);
        current = { day, paragraphs: [] };
        continue;
      }
    }
    if (current) current.paragraphs.push(paragraph);
    else intro.push(paragraph);
  }
  if (current) dayBlocks.push(current);

  return { intro, dayBlocks };
}

function buildHeidelbergPartGroupedSections(
  paragraphs: string[],
  locale: AppLocale,
): SectionedCreedBody | null {
  const { intro: leadingIntro, dayBlocks } = parseLordsDayBlocks(paragraphs);
  if (dayBlocks.length !== HEIDELBERG_LORDS_DAY_COUNT) return null;

  const introLordDay = dayBlocks.find((block) => block.day === HEIDELBERG_INTRO_LORD_DAY);
  const intro = [...leadingIntro, ...(introLordDay?.paragraphs ?? [])];

  const sections: CreedBodySection[] = HEIDELBERG_PARTS.map((partDef) => {
    const subsections: CreedBodySection[] = dayBlocks
      .filter((block) => block.day >= partDef.startDay && block.day <= partDef.endDay)
      .map((block) => ({
        id: `ld-${block.day}`,
        label:
          locale === "en"
            ? `Lord's Day ${block.day}`
            : locale === "zh-TW"
              ? `主日 ${block.day}`
              : `主日 ${block.day}`,
        paragraphs: block.paragraphs,
        rangeStart: block.day,
        rangeEnd: block.day,
      }));

    return {
      id: `part-${partDef.part}`,
      label: resolveHeidelbergPartTitle(partDef, locale),
      paragraphs: [],
      subsections,
      rangeStart: partDef.startDay,
      rangeEnd: partDef.endDay,
    };
  });

  return { intro, sections };
}

function buildLordsDayGroupedSections(
  paragraphs: string[],
  locale: AppLocale,
): SectionedCreedBody | null {
  const { intro, dayBlocks } = parseLordsDayBlocks(paragraphs);
  if (dayBlocks.length < CREED_BODY_SECTION_MIN_INDEXED) return null;

  const sections: CreedBodySection[] = dayBlocks.map((block) => ({
    id: String(block.day),
    label: indexedItemSectionLabel(block.paragraphs) || sectionLabel(block.day, block.day, "lords-day", locale),
    paragraphs: block.paragraphs,
    rangeStart: block.day,
    rangeEnd: block.day,
  }));

  return { intro, sections };
}

function questionRangeInParagraphs(paragraphs: string[]): { start: number; end: number } {
  let start = Number.POSITIVE_INFINITY;
  let end = 0;
  for (const paragraph of paragraphs) {
    const index = extractCreedParagraphIndex(paragraph);
    if (index != null) {
      start = Math.min(start, index);
      end = Math.max(end, index);
    }
  }
  if (!Number.isFinite(start)) return { start: 0, end: 0 };
  return { start, end };
}

function buildCatechismTopicGroupedSections(
  paragraphs: string[],
  _locale: AppLocale,
): SectionedCreedBody | null {
  const intro: string[] = [];
  const parts: Array<{
    title: string;
    topics: Array<{ title: string; paragraphs: string[] }>;
  }> = [];
  let currentPart: {
    title: string;
    topics: Array<{ title: string; paragraphs: string[] }>;
  } | null = null;
  let currentTopic: { title: string; paragraphs: string[] } | null = null;

  for (const paragraph of paragraphs) {
    if (isWestminsterPartHeaderParagraph(paragraph)) {
      if (currentTopic && currentPart) {
        currentPart.topics.push(currentTopic);
        currentTopic = null;
      }
      if (currentPart) parts.push(currentPart);
      currentPart = { title: firstLine(paragraph), topics: [] };
      continue;
    }
    if (isCatechismTopicHeaderParagraph(paragraph)) {
      if (currentTopic && currentPart) currentPart.topics.push(currentTopic);
      if (!currentPart) {
        currentPart = { title: "", topics: [] };
      }
      currentTopic = { title: firstLine(paragraph), paragraphs: [] };
      continue;
    }
    if (currentTopic) currentTopic.paragraphs.push(paragraph);
    else intro.push(paragraph);
  }
  if (currentTopic && currentPart) currentPart.topics.push(currentTopic);
  if (currentPart) parts.push(currentPart);

  const topicCount = parts.reduce((sum, part) => sum + part.topics.length, 0);
  if (parts.length < 2 || topicCount < CREED_BODY_SECTION_MIN_INDEXED) return null;

  const sections: CreedBodySection[] = parts.map((part, partIndex) => {
    const subsections: CreedBodySection[] = part.topics.map((topic, topicIndex) => {
      const { start, end } = questionRangeInParagraphs(topic.paragraphs);
      return {
        id: `part-${partIndex + 1}-topic-${topicIndex + 1}`,
        label: topic.title,
        paragraphs: topic.paragraphs,
        rangeStart: start,
        rangeEnd: end,
      };
    });
    const rangeStart = subsections[0]?.rangeStart ?? 0;
    const rangeEnd = subsections[subsections.length - 1]?.rangeEnd ?? 0;
    return {
      id: `part-${partIndex + 1}`,
      label: part.title,
      paragraphs: [],
      subsections,
      rangeStart,
      rangeEnd,
    };
  });

  return { intro, sections };
}

/** Group long numbered creeds into one collapsible row per article/chapter/question. */
export function buildSectionedCreedBody(
  paragraphs: string[],
  locale: AppLocale,
  creedId?: string,
): SectionedCreedBody | null {
  if (paragraphs.length === 0) return null;
  if (creedId && shouldRenderCreedBodyFlat(creedId)) return null;

  const unit = detectSectionUnit(paragraphs);
  if (unit === "lords-day") {
    const heidelberg = buildHeidelbergPartGroupedSections(paragraphs, locale);
    if (heidelberg) return heidelberg;
    return buildLordsDayGroupedSections(paragraphs, locale);
  }
  if (unit === "catechism-topic") {
    return buildCatechismTopicGroupedSections(paragraphs, locale);
  }

  const { intro, items } = buildIndexedItemSections(paragraphs);
  if (items.length < CREED_BODY_SECTION_MIN_INDEXED) return null;

  return { intro, sections: items };
}
