// AskBible.me · 共享 MCP 核心引擎（JSON-RPC 2.0，支持 Streamable HTTP 与 Stdio 双通道）
// 严格遵循：
// 1. system.manifest 两级渐进自省（< 250 Token 能力索引）
// 2. 公开只读（Tier 0）零门槛、零幻觉取经文
// 3. 个人读写硬隔离（Tier 1 只读 / Tier 2 写操作只进 mcp_proposals 收件箱待用户端内确认）

import {
  CANON_BOOKS,
  DEFAULT_TRANSLATION_ID,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_VERSION,
  PRODUCT_NAME,
  PRODUCT_ORIGIN,
  PUBLIC_READING_PLANS,
  PUBLIC_TRANSLATIONS,
  buildEntryLink,
  matchQuietEntry,
  parseVerseRange,
  resolveBook,
  resolveTranslation,
} from "./askbible-ai-catalog.mjs";
import { buildLlmsTxt } from "./askbible-ai-docs.mjs";

/**
 * @typedef {Object} McpDataProvider
 * @property {(translationId: string, bookId: string, chapter: number) => Promise<Array<{verse: number, text: string}> | null>} loadChapter
 * @property {(planId: string) => Promise<any | null>} loadReadingPlan
 * @property {() => Promise<Array<any>>} loadFigures
 * @property {(path: string, init?: { method?: string, token?: string, body?: any }) => Promise<{ ok: boolean, status: number, data: any }>} [callSyncApi]
 */

export const MCP_TOOLS = [
  {
    name: "get_system_manifest",
    description:
      "返回 AskBible.me 的轻量自省清单（<250 Token）：产品边界、能力域、权限分层与可用工具概览。建议首次接入时优先调用。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_passage",
    description:
      "精准读取正典圣经经文（支持中英文书名或 3 字母 USFM 代码、章号、可选节范围与多译本），彻底杜绝大模型背错经文或章节号。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        book: { type: "string", description: "书卷名或 USFM 代码，例如 'PSA'、'诗篇'、'John'、'约'" },
        chapter: { type: "integer", minimum: 1, description: "章号" },
        verses: { type: "string", description: "可选节范围，如 '1-6' 或 '11'；省略则返回整章" },
        translation: { type: "string", description: "可选译本代码，默认 cuv-simp（和合本简体），如 web-en、kjv、cuv-trad" },
      },
      required: ["book", "chapter"],
      additionalProperties: false,
    },
  },
  {
    name: "compare_translations",
    description: "对同一段经文进行多译本逐节对照（默认对比 cuv-simp、web-en、kjv）。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        book: { type: "string", description: "书卷名或 USFM 代码" },
        chapter: { type: "integer", minimum: 1, description: "章号" },
        verses: { type: "string", description: "建议指定节范围（如 '1-6'），避免单次返回过长" },
        translations: {
          type: "array",
          items: { type: "string" },
          description: "译本代码数组（最多 4 个），默认 ['cuv-simp', 'web-en', 'kjv']",
        },
      },
      required: ["book", "chapter"],
      additionalProperties: false,
    },
  },
  {
    name: "list_reading_plans",
    description: "列出 AskBible.me 可用的读经计划目录（可按主题关键字筛选）。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "可选筛选词，如 '编年'、'诗篇'、'麦琴'、'chronological'" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_reading_plan_day",
    description: "查询指定读经计划第 N 天应读的经文章节，并返回可直接打开阅读的深链。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        planId: { type: "string", description: "读经计划 ID，如 'esvthroughthebible'、'mcheyne'" },
        day: { type: "integer", minimum: 1, maximum: 366, description: "第几天（1-365）；省略则按今天是一年第几天计算" },
      },
      required: ["planId"],
      additionalProperties: false,
    },
  },
  {
    name: "search_figures",
    description: "检索 AskBible.me 圣经人物馆的经文分类索引与简短说明（支持中英文名或书卷筛选）。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "人物中英文名或关键词，如 '大卫'、'David'、'摩西'、'保罗'" },
        book: { type: "string", description: "可选：按出现书卷筛选，如 'ACT' 或 '创世记'" },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "返回条数上限，默认 8" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "find_quiet_entry",
    description:
      "按用户的处境或情绪（如焦虑、失眠、疲惫、哀伤、清晨、感恩）推荐安静回到圣经的经文入口、读经计划与一键带「安静」伴读音乐的直达链接。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        mood: { type: "string", description: "情绪或处境描述，如 '睡不着很焦虑'、'早晨开始一天'、'tired'" },
        translation: { type: "string", description: "可选译本代码，默认 cuv-simp" },
      },
      required: ["mood"],
      additionalProperties: false,
    },
  },
  {
    name: "build_entry_link",
    description:
      "生成 AskBible.me 语义深链（Web HTTPS + 原生 askbible:// + 纯 Markdown 链接），可携带译本、节号与 audio=quiet 安静音乐参数。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        book: { type: "string", description: "书卷名或 USFM 代码" },
        chapter: { type: "integer", minimum: 1, description: "章号" },
        verses: { type: "string", description: "可选节号或节范围，如 '23' 或 '1-6'" },
        translation: { type: "string", description: "可选译本代码，默认 cuv-simp" },
        audio: { type: "string", enum: ["quiet", "off"], description: "是否默认配「安静」伴读音乐" },
        autoplay: { type: "boolean", description: "是否在打开后尝试自动播放安静伴读音乐" },
      },
      required: ["book", "chapter"],
      additionalProperties: false,
    },
  },
  {
    name: "get_my_reading_summary",
    description:
      "【需个人授权 Token】只读查询当前登录用户的读经进度、上次读到哪一章、活跃读经计划、近期书签摘要与待确认 AI 提案数。",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "propose_reading_action",
    description:
      "【需个人授权 Token · 写隔离收件箱】向用户的 AskBible 收件箱提交一条写操作建议（收藏经文书签 / 切换读经计划 / 标记章节已读）。不会直接覆盖用户底库，需用户在端内 1 秒确认后正式入库。",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["add_bookmark", "switch_reading_plan", "mark_chapter_read"],
          description: "提案动作类型",
        },
        book: { type: "string", description: "书卷名或 USFM 代码（add_bookmark / mark_chapter_read 时必填）" },
        chapter: { type: "integer", minimum: 1, description: "章号（add_bookmark / mark_chapter_read 时必填）" },
        verse: { type: "integer", minimum: 1, description: "可选节号（add_bookmark 时可用）" },
        note: { type: "string", description: "可选简短灵修备注（最多 500 字）" },
        planId: { type: "string", description: "读经计划 ID（switch_reading_plan 时必填）" },
        sourceAgent: { type: "string", description: "发起提案的外部 AI 名称，如 'Claude'、'Cursor'" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
];

export const MCP_RESOURCES = [
  {
    uri: "askbible://llms.txt",
    name: "AskBible.me LLMs Context",
    description: "产品边界、译本清单、URL 规范与 AI 协议总览",
    mimeType: "text/plain",
  },
  {
    uri: "askbible://catalog/books",
    name: "Canon 66 Books Catalog",
    description: "圣经正典 66 卷书规范代码、中英文名与章数",
    mimeType: "application/json",
  },
  {
    uri: "askbible://catalog/translations",
    name: "Public Translations Catalog",
    description: "18 个公开静态圣经译本元数据",
    mimeType: "application/json",
  },
  {
    uri: "askbible://catalog/plans",
    name: "Reading Plans Catalog",
    description: "公开读经计划目录",
    mimeType: "application/json",
  },
];

export const MCP_PROMPTS = [
  {
    name: "quiet_morning_entry",
    description: "生成一段安静、低认知负荷的清晨读经引导，并附带一键直达 AskBible.me 的深链",
    arguments: [
      { name: "mood", description: "用户当前状态或处境（可选）", required: false },
      { name: "translation", description: "译本代码（默认 cuv-simp）", required: false },
    ],
  },
  {
    name: "study_passage_clean",
    description: "零幻觉查经提示词：先调用 get_passage / compare_translations 取准确经文，再做温和克制的观察引导",
    arguments: [
      { name: "book", description: "书卷名或代码", required: true },
      { name: "chapter", description: "章号", required: true },
      { name: "verses", description: "节范围（可选）", required: false },
    ],
  },
];

function getDayOfYear() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const diff = now.getTime() - start.getTime();
  return Math.max(1, Math.min(365, Math.floor(diff / 86400000) + 1));
}

function okToolResult(payload, textSummary) {
  return {
    content: [
      {
        type: "text",
        text: textSummary || JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

function errToolResult(code, message) {
  return {
    isError: true,
    content: [{ type: "text", text: `[${code}] ${message}` }],
    structuredContent: { ok: false, code, error: message },
  };
}

function filterVerses(verses, rawRange) {
  if (!rawRange) return { verses, range: null };
  const range = parseVerseRange(rawRange);
  if (!range) return { verses: null, range: null, invalid: true };
  return {
    verses: verses.filter((v) => v.verse >= range.start && v.verse <= range.end),
    range,
  };
}

function extractPlanDayReadings(planDoc, day) {
  if (!planDoc || typeof planDoc !== "object") return [];
  const daysArr = Array.isArray(planDoc.days)
    ? planDoc.days
    : Array.isArray(planDoc.schedule)
      ? planDoc.schedule
      : null;
  if (daysArr) {
    const entry = daysArr.find((d) => Number(d?.day) === day) || daysArr[day - 1];
    if (!entry) return [];
    const rawList = entry.readings || entry.passages || entry.items || [];
    return Array.isArray(rawList) ? rawList : [];
  }
  return [];
}

/**
 * 执行单次 MCP JSON-RPC 2.0 请求
 * @param {any} rpcRequest
 * @param {{ provider: McpDataProvider, origin?: string, authToken?: string | null }} ctx
 */
export async function handleMcpJsonRpc(rpcRequest, ctx) {
  const origin = String(ctx?.origin || PRODUCT_ORIGIN).replace(/\/+$/, "");
  const provider = ctx?.provider;
  const authToken = ctx?.authToken || null;

  if (!rpcRequest || typeof rpcRequest !== "object" || rpcRequest.jsonrpc !== "2.0" || typeof rpcRequest.method !== "string") {
    return {
      jsonrpc: "2.0",
      id: rpcRequest?.id ?? null,
      error: { code: -32600, message: "Invalid JSON-RPC 2.0 Request" },
    };
  }

  const { id, method, params = {} } = rpcRequest;

  // JSON-RPC Notification（无 id）无需返回 body
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return null;
  }

  const reply = (result) => ({ jsonrpc: "2.0", id: id ?? null, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  if (method === "ping") {
    return reply({ ok: true, server: PRODUCT_NAME, version: MCP_SERVER_VERSION });
  }

  if (method === "initialize") {
    return reply({
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: {
        name: PRODUCT_NAME,
        version: MCP_SERVER_VERSION,
      },
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
      },
      instructions:
        "AskBible.me 是让人重新进入圣经的安静入口。请优先使用 get_passage 获取精确经文（不要靠记忆背诵章节号），并用 build_entry_link / find_quiet_entry 为用户提供安静直达链接。个人写操作仅通过 propose_reading_action 进入收件箱待用户确认。",
    });
  }

  if (method === "tools/list") {
    return reply({ tools: MCP_TOOLS });
  }

  if (method === "resources/list") {
    return reply({ resources: MCP_RESOURCES });
  }

  if (method === "resources/read") {
    const uri = String(params?.uri || "").trim();
    if (uri === "askbible://llms.txt") {
      return reply({ contents: [{ uri, mimeType: "text/plain", text: buildLlmsTxt(origin) }] });
    }
    if (uri === "askbible://catalog/books") {
      return reply({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(CANON_BOOKS) }] });
    }
    if (uri === "askbible://catalog/translations") {
      return reply({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(PUBLIC_TRANSLATIONS) }] });
    }
    if (uri === "askbible://catalog/plans") {
      return reply({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(PUBLIC_READING_PLANS) }] });
    }
    return fail(-32002, `Resource not found: ${uri}`);
  }

  if (method === "prompts/list") {
    return reply({ prompts: MCP_PROMPTS });
  }

  if (method === "prompts/get") {
    const name = String(params?.name || "").trim();
    const args = params?.arguments || {};
    if (name === "quiet_morning_entry") {
      const mood = String(args.mood || "清晨开始一天");
      const tr = String(args.translation || DEFAULT_TRANSLATION_ID);
      return reply({
        description: "清晨安静读经引导",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `请调用 find_quiet_entry(mood="${mood}", translation="${tr}") 和 get_passage，为我准备一段简短、安静、低认知负荷的今日经文（不超过 6 节），并附上可直接打开收听「安静」背景乐的 AskBible.me 链接。`,
            },
          },
        ],
      });
    }
    if (name === "study_passage_clean") {
      const book = String(args.book || "JHN");
      const chapter = String(args.chapter || "1");
      const verses = args.verses ? ` verses="${args.verses}"` : "";
      return reply({
        description: "零幻觉经文细读",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `请先调用 get_passage(book="${book}", chapter=${chapter}${verses ? `, ${verses}` : ""}) 与 compare_translations 获取精确原文，严禁凭记忆改写经文；然后用克制安静的语气帮我列出 3 个文本观察问题，并给出 AskBible.me 原文直达链接。`,
            },
          },
        ],
      });
    }
    return fail(-32602, `Unknown prompt: ${name}`);
  }

  if (method !== "tools/call") {
    return fail(-32601, `Method not found: ${method}`);
  }

  const toolName = String(params?.name || "").trim();
  const args = params?.arguments && typeof params.arguments === "object" ? params.arguments : {};

  try {
    if (toolName === "get_system_manifest") {
      const manifest = {
        product: PRODUCT_NAME,
        identity: "一个让人重新进入圣经的安静入口（非 AI 聊天工具 / 非游戏化 App / 非百科）",
        origin,
        mcpVersion: MCP_SERVER_VERSION,
        domains: [
          { id: "scripture", access: "public_read", tools: ["get_passage", "compare_translations"] },
          { id: "plans_and_figures", access: "public_read", tools: ["list_reading_plans", "get_reading_plan_day", "search_figures"] },
          { id: "quiet_entry", access: "public_read", tools: ["find_quiet_entry", "build_entry_link"] },
          { id: "personal_sync", access: "bearer_read_and_inbox_write", tools: ["get_my_reading_summary", "propose_reading_action"] },
        ],
        defaults: { translation: DEFAULT_TRANSLATION_ID, audioMood: "quiet" },
        writePolicy: "MCP_INBOX_ONLY — 外部写操作禁止直接覆盖底库，全部进入 mcp_proposals 收件箱待用户端内确认。",
      };
      return reply(okToolResult(manifest));
    }

    if (toolName === "get_passage") {
      const book = resolveBook(args.book);
      if (!book) return reply(errToolResult("INVALID_BOOK", `未识别的书卷：${String(args.book || "")}`));
      const chapter = Number(args.chapter);
      if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
        return reply(errToolResult("INVALID_CHAPTER", `${book.zh} 共 ${book.chapters} 章，无法读取第 ${args.chapter} 章。`));
      }
      const tr = resolveTranslation(args.translation || DEFAULT_TRANSLATION_ID);
      if (!tr) return reply(errToolResult("INVALID_TRANSLATION", `不支持的译本：${String(args.translation || "")}`));

      const rawVerses = await provider.loadChapter(tr.id, book.id, chapter);
      if (!rawVerses || rawVerses.length === 0) {
        return reply(errToolResult("PASSAGE_NOT_FOUND", `暂未找到 ${tr.id} 的 ${book.zh} 第 ${chapter} 章静态文本。`));
      }
      const { verses, range, invalid } = filterVerses(rawVerses, args.verses);
      if (invalid) return reply(errToolResult("INVALID_VERSE_RANGE", `节范围格式无效：${String(args.verses)}，请使用如 '1-6' 或 '11'。`));

      const links = buildEntryLink({
        bookId: book.id,
        chapter,
        verse: args.verses,
        translation: tr.id,
        audio: "quiet",
        origin,
      });

      const payload = {
        ok: true,
        bookId: book.id,
        bookZh: book.zh,
        bookEn: book.en,
        chapter,
        verseRange: range ? `${range.start}${range.end > range.start ? `-${range.end}` : ""}` : `1-${rawVerses.length}`,
        translation: { id: tr.id, labelZh: tr.labelZh, labelEn: tr.labelEn },
        verses,
        links,
      };
      const readable = [
        `${book.zh} ${chapter}${args.verses ? `:${args.verses}` : ""}（${tr.labelZh}）`,
        ...verses.map((v) => `${v.verse}. ${v.text}`),
        "",
        `安静阅读链接：${links.webUrl}`,
      ].join("\n");
      return reply(okToolResult(payload, readable));
    }

    if (toolName === "compare_translations") {
      const book = resolveBook(args.book);
      if (!book) return reply(errToolResult("INVALID_BOOK", `未识别的书卷：${String(args.book || "")}`));
      const chapter = Number(args.chapter);
      if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
        return reply(errToolResult("INVALID_CHAPTER", `${book.zh} 共 ${book.chapters} 章。`));
      }
      const requested = Array.isArray(args.translations) && args.translations.length > 0
        ? args.translations.slice(0, 4)
        : ["cuv-simp", "web-en", "kjv"];
      const resolved = requested.map((id) => resolveTranslation(id)).filter(Boolean);
      if (resolved.length === 0) {
        return reply(errToolResult("INVALID_TRANSLATION", "请提供至少一个有效译本代码。"));
      }

      const loaded = await Promise.all(
        resolved.map(async (tr) => {
          const rows = await provider.loadChapter(tr.id, book.id, chapter);
          const filtered = rows ? filterVerses(rows, args.verses) : { verses: [], invalid: false };
          return { tr, verses: filtered.verses || [], invalid: filtered.invalid };
        }),
      );
      if (loaded.some((x) => x.invalid)) {
        return reply(errToolResult("INVALID_VERSE_RANGE", `节范围格式无效：${String(args.verses)}`));
      }

      const byVerse = new Map();
      for (const { tr, verses } of loaded) {
        for (const v of verses) {
          if (!byVerse.has(v.verse)) byVerse.set(v.verse, { verse: v.verse, texts: {} });
          byVerse.get(v.verse).texts[tr.id] = v.text;
        }
      }
      const comparison = [...byVerse.values()].sort((a, b) => a.verse - b.verse);
      const links = buildEntryLink({ bookId: book.id, chapter, verse: args.verses, translation: resolved[0].id, audio: "quiet", origin });

      return reply(
        okToolResult({
          ok: true,
          bookId: book.id,
          bookZh: book.zh,
          bookEn: book.en,
          chapter,
          translations: resolved.map((t) => ({ id: t.id, labelZh: t.labelZh, labelEn: t.labelEn })),
          comparison,
          links,
        }),
      );
    }

    if (toolName === "list_reading_plans") {
      const q = String(args.query || "").trim().toLowerCase();
      const plans = q
        ? PUBLIC_READING_PLANS.filter(
            (p) =>
              p.id.toLowerCase().includes(q) ||
              p.nameZh.toLowerCase().includes(q) ||
              p.nameEn.toLowerCase().includes(q) ||
              p.theme.toLowerCase().includes(q),
          )
        : PUBLIC_READING_PLANS;
      return reply(okToolResult({ ok: true, count: plans.length, plans, webUrl: `${origin}/plans` }));
    }

    if (toolName === "get_reading_plan_day") {
      const planId = String(args.planId || "").trim().toLowerCase();
      const planMeta = PUBLIC_READING_PLANS.find((p) => p.id === planId);
      if (!planMeta) {
        return reply(errToolResult("PLAN_NOT_FOUND", `未找到读经计划：${planId}`));
      }
      const day = args.day ? Number(args.day) : getDayOfYear();
      const planDoc = await provider.loadReadingPlan(planId);
      const readings = extractPlanDayReadings(planDoc, day).map((item) => {
        const book = resolveBook(item?.bookId || item?.book);
        const chapter = Number(item?.startChapter || item?.chapter || 1);
        const entry = book ? buildEntryLink({ bookId: book.id, chapter, audio: "quiet", origin }) : null;
        return {
          ...item,
          bookZh: book?.zh || item?.bookId || "",
          webUrl: entry?.webUrl || `${origin}/plans`,
        };
      });
      return reply(okToolResult({ ok: true, plan: planMeta, day, readings, webUrl: `${origin}/plans` }));
    }

    if (toolName === "search_figures") {
      const q = String(args.query || "").trim().toLowerCase();
      const bookFilter = args.book ? resolveBook(args.book)?.id || null : null;
      const limit = Math.max(1, Math.min(20, Number(args.limit) || 8));
      const allFigures = (await provider.loadFigures()) || [];
      const matched = allFigures
        .filter((f) => {
          if (bookFilter) {
            const books = Array.isArray(f.bookIds) ? f.bookIds : f.primaryBookId ? [f.primaryBookId] : [];
            if (!books.includes(bookFilter)) return false;
          }
          if (!q) return true;
          const hay = [
            f.id,
            f.slug,
            f.displayNameZh,
            f.englishName,
            f.periodLabelZh,
            f.scripturePersonalityZh,
            ...(Array.isArray(f.aliasesZh) ? f.aliasesZh : []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
        .slice(0, limit)
        .map((f) => ({
          id: f.id,
          slug: f.slug || f.id,
          nameZh: f.displayNameZh || f.nameZh || "",
          nameEn: f.englishName || f.nameEn || "",
          primaryBookId: f.primaryBookId || null,
          bookIds: Array.isArray(f.bookIds) ? f.bookIds : [],
          periodZh: f.periodLabelZh || "",
          summaryZh: f.scripturePersonalityZh || f.summaryZh || "",
          webUrl: `${origin}/figures`,
        }));

      return reply(okToolResult({ ok: true, count: matched.length, figures: matched }));
    }

    if (toolName === "find_quiet_entry") {
      const entry = matchQuietEntry(args.mood);
      const tr = resolveTranslation(args.translation || DEFAULT_TRANSLATION_ID) || resolveTranslation(DEFAULT_TRANSLATION_ID);
      const passages = entry.passages.map((p) => ({
        ...p,
        links: buildEntryLink({
          bookId: p.bookId,
          chapter: p.chapter,
          verse: p.verseRange,
          translation: tr.id,
          audio: entry.audioMood,
          autoplay: true,
          origin,
        }),
      }));
      const plan = PUBLIC_READING_PLANS.find((p) => p.id === entry.recommendedPlanId) || null;
      const payload = {
        ok: true,
        entryId: entry.id,
        labelZh: entry.labelZh,
        labelEn: entry.labelEn,
        noteZh: entry.noteZh,
        audioMood: entry.audioMood,
        recommendedPlan: plan,
        passages,
      };
      const text = [
        `【${entry.labelZh}】${entry.noteZh}`,
        ...passages.map((p) => `- ${p.titleZh} → ${p.links.webUrl}`),
      ].join("\n");
      return reply(okToolResult(payload, text));
    }

    if (toolName === "build_entry_link") {
      const link = buildEntryLink({
        bookId: args.book,
        chapter: args.chapter,
        verse: args.verses,
        translation: args.translation,
        audio: args.audio,
        autoplay: Boolean(args.autoplay),
        origin,
      });
      if (!link) {
        return reply(errToolResult("INVALID_TARGET", "无法生成深链，请检查书卷代码与章号是否在正典范围内。"));
      }
      return reply(okToolResult({ ok: true, ...link }, `${link.bookZh} ${link.chapter}：${link.webUrl}`));
    }

    if (toolName === "get_my_reading_summary") {
      if (!authToken) {
        return reply(
          errToolResult(
            "AUTH_REQUIRED",
            "该工具需要个人授权：请在 HTTP Header 中传入 Authorization: Bearer <你的 AskBible Session Token>。",
          ),
        );
      }
      if (!provider.callSyncApi) {
        return reply(errToolResult("SYNC_UNAVAILABLE", "当前环境未连接个人同步服务。"));
      }
      const res = await provider.callSyncApi("/v1/mcp/summary", { method: "GET", token: authToken });
      if (!res.ok) {
        return reply(errToolResult("SYNC_ERROR", res.data?.error || `同步服务返回 ${res.status}`));
      }
      return reply(okToolResult(res.data));
    }

    if (toolName === "propose_reading_action") {
      if (!authToken) {
        return reply(
          errToolResult(
            "AUTH_REQUIRED",
            "写提案需要个人授权：请在 HTTP Header 中传入 Authorization: Bearer <你的 AskBible Session Token>。",
          ),
        );
      }
      if (!provider.callSyncApi) {
        return reply(errToolResult("SYNC_UNAVAILABLE", "当前环境未连接个人同步服务。"));
      }
      const action = String(args.action || "").trim();
      const payload = {};
      let summary = "";

      if (action === "add_bookmark" || action === "mark_chapter_read") {
        const book = resolveBook(args.book);
        const chapter = Number(args.chapter);
        if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
          return reply(errToolResult("INVALID_TARGET", "请提供有效的书卷与章号。"));
        }
        payload.bookId = book.id;
        payload.chapter = chapter;
        if (action === "add_bookmark") {
          if (args.verse) payload.verse = Number(args.verse);
          if (args.note) payload.note = String(args.note).trim().slice(0, 500);
          summary = `收藏 ${book.zh} ${chapter}${payload.verse ? `:${payload.verse}` : ""}`;
        } else {
          summary = `标记 ${book.zh} 第 ${chapter} 章已读`;
        }
      } else if (action === "switch_reading_plan") {
        const planId = String(args.planId || "").trim().toLowerCase();
        const plan = PUBLIC_READING_PLANS.find((p) => p.id === planId);
        if (!plan) return reply(errToolResult("PLAN_NOT_FOUND", `未找到读经计划：${planId}`));
        payload.planId = plan.id;
        summary = `切换读经计划为「${plan.nameZh}」`;
      } else {
        return reply(errToolResult("INVALID_ACTION", `不支持的提案动作：${action}`));
      }

      const res = await provider.callSyncApi("/v1/mcp/proposals", {
        method: "POST",
        token: authToken,
        body: {
          action,
          payload,
          summary,
          sourceAgent: String(args.sourceAgent || "External AI").slice(0, 48),
        },
      });
      if (!res.ok) {
        return reply(errToolResult("PROPOSAL_FAILED", res.data?.error || `创建提案失败 (${res.status})`));
      }
      return reply(
        okToolResult({
          ok: true,
          status: "pending_user_confirmation",
          proposal: res.data?.proposal || res.data,
          confirmUrl: `${origin}/read?mcp_inbox=1`,
          message: "提案已进入用户的 AskBible 待确认收件箱，打开 App 或网页确认后即正式生效。",
        }),
      );
    }

    return reply(errToolResult("UNKNOWN_TOOL", `未知工具：${toolName}`));
  } catch (err) {
    return reply(errToolResult("INTERNAL_ERROR", err instanceof Error ? err.message : String(err)));
  }
}
