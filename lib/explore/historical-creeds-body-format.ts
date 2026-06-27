export type CreedBodyLevel =
  | "document"
  | "section"
  | "article"
  | "article-label"
  | "subsection"
  | "subarticle"
  | "proof-item"
  | "affirm"
  | "deny"
  | "question"
  | "answer"
  | "lords-day"
  | "paragraph";

export type ParsedCreedBodyBlock = {
  title: string;
  body: string;
  level: CreedBodyLevel;
};

export type CreedBodySegment = {
  title: string;
  body: string;
  level: CreedBodyLevel;
};

const DOCUMENT_LINE =
  /(?:信约|信約|宣言|Covenant|Declaration)\s*[（(]\d{4}[）)]/i;

const LORDS_DAY_LINE = /^主日\s*[\d一二三四五六七八九十]+|^Lord'?s Day\s*\d+/i;

const SECTION_LINE =
  /^(?:第\s*[\d〇零一二三四五六七八九十百千]+\s*章|第\s*[\d一二三四五六七八九十百千]+\s*[项項]?教[义義]|The (?:First|Second|Third|Fourth|Fifth) Main Point|Third and Fourth Main Points|简短声明|簡短聲明|肯定与否认条文|肯定与否認條文|Articles of Affirmation and Denial|引言|序言|結語|结语|INTRODUCTION|CONCLUSION|Rejection of|第[一二三四五六七八九十]+部分|PART\s+[IVXLC]+)/i;

const ARTICLE_LABEL_LINE =
  /^(?:Article\s+\d+[:：]?|第\s*[\d一二三四五六七八九十百千]+\s*条|第\d+条[：:])/i;

const ENUM_SECTION_LINE = /^[一二三四五六七八九十]+、/;

const EN_CATECHISM_TOPIC_LINE = /^(?:Introduction|Preface|[IVX]+\.)\s+\S/;

const REJECTION_INTRO_LINE =
  /^(?:拒绝谬论|拒絕謬論|Rejection of Errors|经文依据|經文依據|Scripture proofs)/i;

const REJECTION_MARKER =
  /(?:我們既已解說|我們既已解说|關于[\s\S]{2,40}?已經解說了[；;]|此真實的教義已解釋清楚，|真實教義既經解釋，)[\s\S]{0,80}?錯謬[：:]/;

function isRejectionItemLabel(line: string): boolean {
  const t = line.trim();
  return /^[一二三四五六七八九十]+、$/.test(t) || /^[IVX]+$/.test(t);
}

function isEnumSectionTitle(line: string): boolean {
  if (!ENUM_SECTION_LINE.test(line)) return false;
  if (isRejectionItemLabel(line)) return false;
  if (/^(?:引言|序言|Preface|Introduction)$/.test(line)) return true;
  return line.length <= 28 && !line.includes("。") && !line.includes("，");
}

function isDoctrineSectionLine(line: string): boolean {
  return /^第\s*[\d一二三四五六七八九十百千]+\s*[项項]?教[义義]/.test(line);
}

/** Belgian / 39 Articles style: `第 1 条：论……` → label + topic. */
export function splitNumberedArticleTitle(
  title: string,
): { label: string; topic: string } | null {
  const zh = title.match(/^(第\s*[\d一二三四五六七八九十百千]+\s*条)\s*[：:]\s*(.+)$/);
  if (zh?.[2]?.trim()) {
    return { label: zh[1].replace(/\s+/g, " ").trim(), topic: zh[2].trim() };
  }
  const en = title.match(/^(Article\s+\d+)\s*[：:]?\s*(.+)$/i);
  if (en?.[2]?.trim()) {
    return { label: en[1].trim(), topic: en[2].trim() };
  }
  return null;
}

const AFFIRM_DENY_SPLIT =
  /(?:(?<!但)(?=我们确认|我們確認)|(?=我们进一步确认|我們進一步確認|我们也确认|我們也確認|但我们确认|但我們確認|我们否认|我們否認|我们进一步否认|我們進一步否認|WE (?:FURTHER )?AFFIRM(?:\s+that)?|WE (?:FURTHER )?DENY(?:\s+that)?))/i;

const ZH_AFFIRM_LABEL =
  /^(我们确认|我們確認|我们进一步确认|我們進一步確認|我们也确认|我們也確認|但我们确认|但我們確認)(?:[：:]\s*|\s*)([\s\S]+)$/;
const ZH_DENY_LABEL =
  /^(我们否认|我們否認|我们进一步否认|我們進一步否認)(?:[：:，,]\s*|\s*)([\s\S]+)$/;
const EN_AFFIRM_LABEL = /^WE (FURTHER )?AFFIRM(?:\s+that)?[:\s]+([\s\S]+)$/i;
const EN_DENY_LABEL = /^WE (FURTHER )?DENY(?:\s+that)?[:\s]+([\s\S]+)$/i;

function stanceLevel(label: string): "affirm" | "deny" {
  if (/否认|否認|DENY/i.test(label)) return "deny";
  return "affirm";
}

function parseAffirmDenyChunk(chunk: string): CreedBodySegment | null {
  const trimmed = chunk.trim();
  if (!trimmed) return null;

  const zhAffirm = trimmed.match(ZH_AFFIRM_LABEL);
  if (zhAffirm) {
    return {
      title: zhAffirm[1],
      body: zhAffirm[2].trim(),
      level: stanceLevel(zhAffirm[1]),
    };
  }

  const zhDeny = trimmed.match(ZH_DENY_LABEL);
  if (zhDeny) {
    return { title: zhDeny[1], body: zhDeny[2].trim(), level: "deny" };
  }

  const enAffirm = trimmed.match(EN_AFFIRM_LABEL);
  if (enAffirm) {
    const label = enAffirm[1] ? "WE FURTHER AFFIRM" : "WE AFFIRM";
    return { title: label, body: enAffirm[2].trim(), level: "affirm" };
  }

  const enDeny = trimmed.match(EN_DENY_LABEL);
  if (enDeny) {
    const label = enDeny[1] ? "WE FURTHER DENY" : "WE DENY";
    return { title: label, body: enDeny[2].trim(), level: "deny" };
  }

  return null;
}

/** Split Chicago / Lausanne style 我们确认…我们否认… stanzas for paired contrast layout. */
export function splitAffirmDenyStanzas(body: string): CreedBodySegment[] | null {
  const trimmed = body.trim();
  if (!trimmed || !AFFIRM_DENY_SPLIT.test(trimmed)) return null;

  const segments: CreedBodySegment[] = [];
  const paragraphs = trimmed.split(/\n+/).filter(Boolean);

  for (const paragraph of paragraphs) {
    const chunks = paragraph.split(AFFIRM_DENY_SPLIT).map((c) => c.trim()).filter(Boolean);
    for (const chunk of chunks) {
      const parsed = parseAffirmDenyChunk(chunk);
      if (parsed) {
        segments.push(parsed);
      } else {
        segments.push({ title: "", body: chunk, level: "paragraph" });
      }
    }
  }

  if (!segments.some((s) => s.level === "affirm" || s.level === "deny")) return null;
  return segments;
}

const ZH_QUESTION_ANSWER =
  /^(问|問)\s*([0-9０-９]+)[：:]\s*([\s\S]*?)\n\s*答[：:]\s*([\s\S]+)$/;
const EN_QUESTION_ANSWER_MULTILINE =
  /^Q\.?\s*(\d+)\.?\s*([\s\S]*?)\n\s*A\.?\s*([\s\S]+)$/i;
const EN_QUESTION_ANSWER_INLINE =
  /^Q\.?\s*(\d+)\.\s*(.+?)\s+A\.\s+([\s\S]+)$/i;

/** Split catechism 问/答 or Q/A into labeled rows. */
export function splitQuestionAnswerStanzas(body: string): CreedBodySegment[] | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const zh = trimmed.match(ZH_QUESTION_ANSWER);
  if (zh) {
    const label = zh[1] === "問" ? "問" : "问";
    return [
      { title: `${label} ${zh[2]}`, body: zh[3].trim(), level: "question" },
      { title: "答", body: zh[4].trim(), level: "answer" },
    ];
  }

  const enMulti = trimmed.match(EN_QUESTION_ANSWER_MULTILINE);
  if (enMulti) {
    return [
      { title: `Q. ${enMulti[1]}`, body: enMulti[2].trim(), level: "question" },
      { title: "A.", body: enMulti[3].trim(), level: "answer" },
    ];
  }

  const enInline = trimmed.match(EN_QUESTION_ANSWER_INLINE);
  if (enInline) {
    return [
      { title: `Q. ${enInline[1]}`, body: enInline[2].trim(), level: "question" },
      { title: "A.", body: enInline[3].trim(), level: "answer" },
    ];
  }

  return null;
}

/** Visible row title for catechism Q/A blocks (question line only). */
export function extractCatechismQuestionTitle(paragraph: string): string {
  const line = paragraph.trim().split("\n")[0]?.trim() ?? "";
  if (line) return line.length <= 120 ? line : `${line.slice(0, 117)}…`;
  const trimmed = paragraph.trim();
  return trimmed.length <= 120 ? trimmed : `${trimmed.slice(0, 117)}…`;
}

/** Answer-only body for expanded catechism rows (question already shown in header). */
export function catechismAnswerOnlyParagraph(paragraph: string): string {
  const stanzas = splitQuestionAnswerStanzas(paragraph);
  if (!stanzas) return paragraph;
  const answer = stanzas.find((segment) => segment.level === "answer");
  if (!answer?.body) return paragraph;
  const isZh = /^(问|問)/.test(paragraph.trim());
  const label = answer.title?.trim() || (isZh ? "答" : "A.");
  const suffix = /[：:.]$/.test(label) ? "" : isZh ? "：" : ". ";
  return `${label}${suffix}${answer.body}`;
}

export function isChicagoStyleArticleLabel(title: string): boolean {
  const t = title.trim();
  return (
    /^第\s*[\d一二三四五六七八九十百千]+\s*条$/i.test(t) ||
    /^第\s*[\d一二三四五六七八九十百千]+\s*條$/i.test(t) ||
    /^Article\s+\d+$/i.test(t)
  );
}

export function isChicagoAffirmDenyArticleBlock(segments: CreedBodySegment[]): boolean {
  const head = segments[0];
  return (
    head?.level === "article" &&
    !!head.title &&
    !head.body &&
    isChicagoStyleArticleLabel(head.title)
  );
}

export function isChicagoArticleParagraph(text: string): boolean {
  const block = parseCreedBodyBlock(text);
  return !!block.title && isChicagoStyleArticleLabel(block.title);
}

export function peelChicagoArticleBlock(segments: CreedBodySegment[]): {
  block: CreedBodySegment[] | null;
  rest: CreedBodySegment[];
} {
  if (!isChicagoAffirmDenyArticleBlock(segments)) {
    return { block: null, rest: segments };
  }
  const block: CreedBodySegment[] = [segments[0]!];
  let index = 1;
  while (
    index < segments.length &&
    (segments[index]?.level === "affirm" || segments[index]?.level === "deny")
  ) {
    block.push(segments[index]!);
    index += 1;
  }
  return { block, rest: segments.slice(index) };
}

function articleSegments(block: ParsedCreedBodyBlock): CreedBodySegment[] | null {
  if (block.level !== "article" || !block.title) return null;
  const split = splitNumberedArticleTitle(block.title);
  if (!split) return null;
  return [
    { title: block.title.trim(), body: "", level: "article" },
    { title: "", body: block.body, level: "paragraph" },
  ];
}

function expandBodyStanzas(body: string): CreedBodySegment[] | null {
  return splitQuestionAnswerStanzas(body) ?? splitAffirmDenyStanzas(body);
}

function classifyWithBody(title: string): CreedBodyLevel {
  if (DOCUMENT_LINE.test(title)) return "document";
  if (LORDS_DAY_LINE.test(title)) return "lords-day";
  if (isEnumSectionTitle(title) || EN_CATECHISM_TOPIC_LINE.test(title)) return "section";
  if (
    SECTION_LINE.test(title) ||
    isDoctrineSectionLine(title) ||
    /^第\s*[\d一二三四五六七八九十百千]+\s*章/.test(title)
  ) {
    return "section";
  }
  if (REJECTION_INTRO_LINE.test(title)) return "subsection";
  if (isRejectionItemLabel(title)) return "subarticle";
  if (ARTICLE_LABEL_LINE.test(title) || /^Article\s/i.test(title)) return "article";
  return "article";
}

function classifyStandaloneLine(line: string): CreedBodyLevel {
  if (DOCUMENT_LINE.test(line)) return "document";
  if (LORDS_DAY_LINE.test(line)) return "lords-day";
  if (isEnumSectionTitle(line) || EN_CATECHISM_TOPIC_LINE.test(line)) return "section";
  if (
    SECTION_LINE.test(line) ||
    isDoctrineSectionLine(line) ||
    /^第\s*[\d一二三四五六七八九十百千]+\s*章/.test(line)
  ) {
    return "section";
  }
  if (REJECTION_INTRO_LINE.test(line)) return "subsection";
  if (/^\d+\.\s/.test(line)) return "proof-item";
  if (isRejectionItemLabel(line)) return "subarticle";
  if (ARTICLE_LABEL_LINE.test(line) && line.length < 56) return "article";
  return "paragraph";
}

/** Split Dort-style rejection tail (一、二、三…) out of a long article body. */
export function splitRejectionTail(body: string): {
  main: string;
  intro: string;
  items: Array<{ label: string; text: string }>;
} {
  const match = body.match(REJECTION_MARKER);
  if (!match) return { main: body.trim(), intro: "", items: [] };

  const idx = body.indexOf(match[0]);
  const main = body.slice(0, idx).trim();
  const tail = body.slice(idx).trim();
  const introEnd = match[0].length;
  const itemsText = tail.slice(introEnd).trim();
  const intro = tail.slice(0, introEnd).trim();
  const items: Array<{ label: string; text: string }> = [];

  for (const chunk of itemsText.split(/(?=[一二三四五六七八九十]+、)/)) {
    const m = chunk.match(/^([一二三四五六七八九十]+、)([\s\S]+)/);
    if (m) items.push({ label: m[1], text: m[2].trim() });
  }

  return { main, intro, items };
}

/** Split a creed body paragraph into title / body with a visual hierarchy level. */
export function parseCreedBodyBlock(text: string): ParsedCreedBodyBlock {
  const trimmed = text.trim();
  if (!trimmed) return { title: "", body: "", level: "paragraph" };

  const newline = trimmed.indexOf("\n");
  if (newline >= 0) {
    const title = trimmed.slice(0, newline).trim();
    const body = trimmed.slice(newline + 1).trim();
    return { title, body, level: classifyWithBody(title) };
  }

  const level = classifyStandaloneLine(trimmed);
  if (level === "proof-item") {
    const proofM = trimmed.match(/^(\d+\.)\s*(.+)$/);
    if (proofM) return { title: proofM[1], body: proofM[2], level };
  }
  if (level === "paragraph") {
    return { title: "", body: trimmed, level };
  }
  return { title: trimmed, body: "", level };
}

/** Expand one stored paragraph into render segments (title / body / nested 一、二、三). */
export function expandCreedBodyParagraph(text: string): CreedBodySegment[] {
  const block = parseCreedBodyBlock(text);

  if (block.level === "paragraph" && !block.title) {
    const stanzas = expandBodyStanzas(block.body);
    if (stanzas) return stanzas;

    const split = splitRejectionTail(block.body);
    if (!split.intro) {
      return [{ title: "", body: block.body, level: "paragraph" }];
    }
    const segments: CreedBodySegment[] = [];
    if (split.main) segments.push({ title: "", body: split.main, level: "paragraph" });
    segments.push({ title: split.intro, body: "", level: "subsection" });
    for (const item of split.items) {
      segments.push({ title: item.label, body: item.text, level: "subarticle" });
    }
    return segments;
  }

  if (block.title) {
    const numbered = articleSegments(block);
    if (numbered) {
      const topicSeg = numbered[numbered.length - 1];
      const stanzas = expandBodyStanzas(topicSeg.body);
      if (stanzas) {
        return [...numbered.slice(0, -1), ...stanzas];
      }
      return numbered;
    }

    if (isChicagoStyleArticleLabel(block.title)) {
      const stanzas = expandBodyStanzas(block.body);
      if (stanzas) {
        return [
          { title: block.title, body: "", level: "article" },
          ...stanzas,
        ];
      }
    }

    const titleSeg: CreedBodySegment = {
      title: block.title,
      body: "",
      level: block.level,
    };

    if (block.level === "subsection" && block.body) {
      const stanzas = expandBodyStanzas(block.body);
      if (stanzas) return [titleSeg, ...stanzas];
      return [titleSeg, { title: "", body: block.body, level: "paragraph" }];
    }

    if (block.body) {
      const stanzas = expandBodyStanzas(block.body);
      if (stanzas) return [titleSeg, ...stanzas];
      return [{ ...titleSeg, body: block.body }];
    }

    return [titleSeg];
  }

  if (!block.body) return [];

  const stanzas = expandBodyStanzas(block.body);
  if (stanzas) return stanzas;

  const split = splitRejectionTail(block.body);
  if (!split.intro) {
    return [{ title: "", body: block.body, level: "paragraph" }];
  }

  const segments: CreedBodySegment[] = [];
  if (split.main) segments.push({ title: "", body: split.main, level: "paragraph" });
  segments.push({ title: split.intro, body: "", level: "subsection" });
  for (const item of split.items) {
    segments.push({ title: item.label, body: item.text, level: "subarticle" });
  }
  return segments;
}
