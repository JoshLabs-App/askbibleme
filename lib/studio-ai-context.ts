/**
 * AskBible.me Studio — 分层 AI 上下文（Layered Context Memory）
 * 纯函数：可运行于服务端路由或单元测试；不负责读盘。
 */

import type { DiscussionMessage } from "@/app/studio/discussion-types";
import type { StudioDocId } from "@/lib/studio-config";
import { STUDIO_DOC_ENTRIES } from "@/lib/studio-config";

/** 官方文档在组装时的优先级（越前越高） */
const DOC_PRIORITY: StudioDocId[] = [
  "03-principles",
  "09-dangerous-directions",
  "01-vision",
  "04-ux-philosophy",
  "05-emotional-design",
  "06-journey-system",
  "07-content-rules",
  "08-mvp-scope",
  "02-user-psychology",
  "10-parking-lot",
];

const MAX_LAYER1_PRODUCT_MEMORY = 8000;
const MAX_LAYER2_DISCUSSION_CHARS = 18_000;
const MAX_LAYER2_MESSAGES = 100;
const MAX_THREAD_PER_FILE = 4500;
const MAX_LAYER3_TOTAL = 12_000;
const MAX_DOC_PER_FILE = 2800;
const MAX_LAYER4_TOTAL = 14_000;
const MAX_ASSEMBLED = 52_000;

export type AssembledAIContext = {
  detectedTopics: string[];
  relatedThreadSlugs: string[];
  layers: {
    productMemory: string;
    discussion: string;
    topicThreads: string;
    officialDocs: string;
    activeDocExcerpt: string;
  };
  /** 交给模型的单一文本（分层标题 + 截断） */
  assembledPrompt: string;
};

export type BuildAIContextInput = {
  userInput: string;
  activeDocId: StudioDocId;
  officialDocBodies: Record<string, string>;
  discussionMessages: DiscussionMessage[];
  productMemoryMarkdown: string;
  /** slug → 正文（已由上层读取存在的 thread 文件） */
  topicThreadBodies: Record<string, string>;
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n…（已截断）`;
}

/** 关键词 → 主题标签 + thread 文件名（不含 .md） */
export function detectDiscussionTopics(userInput: string): {
  topics: string[];
  threadSlugs: string[];
} {
  const t = userInput.toLowerCase();
  const scored: { slug: string; topic: string; score: number }[] = [];

  const rules: { slug: string; topic: string; patterns: RegExp[] }[] = [
    {
      slug: "journey-system",
      topic: "Journey",
      patterns: [/journey/i, /旅程/, /回访/, /回来/, /路径/],
    },
    {
      slug: "gentle-return",
      topic: "Gentle Return",
      patterns: [/温和/, /回归/, /gentle/, /陪伴/, /安静入口/],
    },
    {
      slug: "bible-reader",
      topic: "Bible Reader",
      patterns: [/读经/, /阅读/, /经文/, /深色/, /黑色/, /排版/, /页面/, /reader/i],
    },
    {
      slug: "feature-creep",
      topic: "Feature Creep",
      patterns: [/功能/, /蔓延/, /mvp/, /范围/, /堆/, /停车场/, /parking/i],
    },
    {
      slug: "low-cognitive-load",
      topic: "Low Cognitive Load",
      patterns: [/认知/, /负荷/, /噪音/, /克制/, /一屏/, /少按钮/],
    },
    {
      slug: "user-psychology",
      topic: "User Psychology",
      patterns: [/用户/, /心理/, /现代人/, /手机/, /内疚/, /情绪/],
    },
    {
      slug: "quiet-atmosphere",
      topic: "Quiet atmosphere",
      patterns: [/神圣/, /氛围/, /仪式感/, /冥想/, /灵修/, /禅修/],
    },
  ];

  for (const r of rules) {
    let score = 0;
    for (const p of r.patterns) {
      if (p.test(t) || p.test(userInput)) score += 1;
    }
    if (score > 0) scored.push({ slug: r.slug, topic: r.topic, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 4);

  return {
    topics: top.map((x) => x.topic),
    threadSlugs: top.map((x) => x.slug),
  };
}

/** 与 detectDiscussionTopics 相同（别名，便于命名一致） */
export const detectDiscussionTopic = detectDiscussionTopics;

function formatDiscussionTranscript(messages: DiscussionMessage[]): string {
  const slice = messages.slice(-MAX_LAYER2_MESSAGES);
  const lines: string[] = [];
  let total = 0;
  for (const m of slice) {
    let block = "";
    if (m.kind === "user") {
      block = `[用户 ${m.createdAt.slice(0, 19)}]\n${m.content}`;
    } else if (m.kind === "assistant") {
      block = `[AI ${m.createdAt.slice(0, 19)}]\n${m.reflection.partnerReply}`;
    } else {
      block = `[附注 ${m.createdAt.slice(0, 19)}]\n${m.content}`;
    }
    if (total + block.length + 2 > MAX_LAYER2_DISCUSSION_CHARS) break;
    lines.push(block);
    total += block.length + 2;
  }
  return lines.join("\n\n---\n\n");
}

function formatOfficialDocs(
  bodies: Record<string, string>,
  activeDocId: StudioDocId,
): { activeExcerpt: string; layer: string } {
  const orderedIds = [
    ...DOC_PRIORITY.filter((id) => bodies[id] != null && bodies[id] !== ""),
    ...STUDIO_DOC_ENTRIES.map((e) => e.id).filter(
      (id) =>
        bodies[id] != null &&
        bodies[id] !== "" &&
        !DOC_PRIORITY.includes(id as StudioDocId),
    ),
  ];
  const activeRaw = bodies[activeDocId] ?? "";
  const activeExcerpt = clip(activeRaw, MAX_DOC_PER_FILE);

  const chunks: string[] = [];
  let layerTotal = 0;
  for (const id of orderedIds) {
    if (id === activeDocId) continue;
    const body = bodies[id];
    if (!body?.trim()) continue;
    const row = STUDIO_DOC_ENTRIES.find((e) => e.id === id);
    const title = row ? `${row.labelEn} (${id})` : id;
    const piece = clip(body, MAX_DOC_PER_FILE);
    const section = `### ${title}\n\n${piece}`;
    if (layerTotal + section.length > MAX_LAYER4_TOTAL) break;
    chunks.push(section);
    layerTotal += section.length;
  }

  return {
    activeExcerpt,
    layer: chunks.join("\n\n"),
  };
}

function formatTopicThreads(
  bodies: Record<string, string>,
  slugs: string[],
): string {
  const parts: string[] = [];
  let total = 0;
  for (const slug of slugs) {
    const raw = bodies[slug];
    if (!raw?.trim()) continue;
    const piece = clip(raw, MAX_THREAD_PER_FILE);
    const section = `### thread:${slug}\n\n${piece}`;
    if (total + section.length > MAX_LAYER3_TOTAL) break;
    parts.push(section);
    total += section.length;
  }
  return parts.join("\n\n");
}

/**
 * 分层组装上下文：截断、分层、高优先级文档靠前。
 */
export function buildAIContext(input: BuildAIContextInput): AssembledAIContext {
  const detected = detectDiscussionTopics(input.userInput);
  const slugsWithBodies = detected.threadSlugs.filter(
    (s) => input.topicThreadBodies[s]?.trim(),
  );

  const productMemory = clip(
    input.productMemoryMarkdown || "（尚无 product-memory.md 内容）",
    MAX_LAYER1_PRODUCT_MEMORY,
  );
  const discussion = formatDiscussionTranscript(input.discussionMessages);
  const topicThreads = formatTopicThreads(input.topicThreadBodies, slugsWithBodies);
  const { activeExcerpt, layer: officialDocs } = formatOfficialDocs(
    input.officialDocBodies,
    input.activeDocId,
  );

  const layers = {
    productMemory,
    discussion,
    topicThreads,
    officialDocs,
    activeDocExcerpt: activeExcerpt,
  };

  const assembledPrompt = clip(
    [
      "## Layer 1 — Product Memory（长期记忆 · 最高优先级）",
      "",
      productMemory,
      "",
      "## Layer 2 — Current Discussion（当前讨论摘录）",
      "",
      discussion || "（尚无讨论）",
      "",
      "## Layer 3 — Topic Threads（主题线程 · 与本轮问题相关）",
      "",
      topicThreads || "（未匹配到额外线程文件）",
      "",
      "## Layer 4 — Official Docs（正式文档摘录 · 高权重）",
      "",
      `### 当前选中文档 · ${input.activeDocId}`,
      "",
      activeExcerpt,
      "",
      "---",
      "",
      officialDocs || "（其余文档暂无正文）",
      "",
      "## User Input（本轮输入）",
      "",
      input.userInput.trim(),
    ].join("\n"),
    MAX_ASSEMBLED,
  );

  return {
    detectedTopics: detected.topics,
    relatedThreadSlugs: detected.threadSlugs,
    layers,
    assembledPrompt,
  };
}
