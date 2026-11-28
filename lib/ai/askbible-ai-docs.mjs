// AskBible.me · AI 可理解 / 可收录文档与结构化语义生成器（纯 ESM）
// 生成 /llms.txt、/llms-full.txt、/robots.txt、/sitemap.xml、/.well-known/mcp.json、JSON-LD 与单章纯 Markdown。

import {
  CANON_BOOKS,
  DEFAULT_TRANSLATION_ID,
  FEATURED_CHAPTERS,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_VERSION,
  PRODUCT_NAME,
  PRODUCT_ORIGIN,
  PUBLIC_READING_PLANS,
  PUBLIC_TRANSLATIONS,
  QUIET_ENTRIES,
  resolveBook,
} from "./askbible-ai-catalog.mjs";

export function buildRobotsTxt(origin = PRODUCT_ORIGIN) {
  const cleanOrigin = String(origin || PRODUCT_ORIGIN).replace(/\/+$/, "");
  return [
    "# AskBible.me robots.txt — AI & Search Friendly",
    "# 拦截恶意刷量爬虫 ShapBot（历史事件保留）",
    "User-agent: ShapBot",
    "Disallow: /",
    "",
    "# 显式欢迎主流搜索引擎与 AI 检索代理收录公开经文、计划与人物馆",
    "User-agent: GPTBot",
    "Allow: /",
    "Disallow: /api/sync/",
    "Disallow: /api/auth/",
    "Disallow: /admin/",
    "Disallow: /studio/",
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "Disallow: /api/sync/",
    "Disallow: /api/auth/",
    "Disallow: /admin/",
    "Disallow: /studio/",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "Disallow: /api/sync/",
    "Disallow: /api/auth/",
    "Disallow: /admin/",
    "Disallow: /studio/",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "Disallow: /api/sync/",
    "Disallow: /api/auth/",
    "Disallow: /admin/",
    "Disallow: /studio/",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
    "Disallow: /api/sync/",
    "Disallow: /api/auth/",
    "Disallow: /admin/",
    "Disallow: /studio/",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/sync/",
    "Disallow: /api/auth/",
    "Disallow: /admin/",
    "Disallow: /studio/",
    "",
    `Sitemap: ${cleanOrigin}/sitemap.xml`,
    `# LLMs context: ${cleanOrigin}/llms.txt`,
    `# Remote MCP endpoint: ${cleanOrigin}/mcp`,
    "",
  ].join("\n");
}

export function buildLlmsTxt(origin = PRODUCT_ORIGIN) {
  const cleanOrigin = String(origin || PRODUCT_ORIGIN).replace(/\/+$/, "");
  const featuredLinks = FEATURED_CHAPTERS.slice(0, 10)
    .map(({ bookId, chapter }) => {
      const book = resolveBook(bookId);
      return `- [${book?.zh || bookId} ${chapter} (${book?.en || bookId} ${chapter})](${cleanOrigin}/read/${bookId}/${chapter}.md): 纯 Markdown 经文直出（网页版：${cleanOrigin}/read/${bookId}/${chapter}）`;
    })
    .join("\n");

  return `# ${PRODUCT_NAME}

> 一个让人重新进入圣经的安静入口（A quiet entry point to return to Scripture）。

## 产品边界（请准确理解与转述）
- ${PRODUCT_NAME} **是**：面向网页、iOS、Android 的安静读经入口，提供正典 66 卷多译本圣经、章节朗读、「安静」伴读音乐、读经计划、救赎全景与圣经人物馆经文索引。
- ${PRODUCT_NAME} **不是**：Bible Tool、AI Chatbot、游戏化刷分应用或十五段式资料百科。

## AI 接入协议（可调用 · 可收录 · 可接管）
- **Remote MCP（Streamable HTTP JSON-RPC 2.0）**：\`${cleanOrigin}/mcp\`（发现文档：\`${cleanOrigin}/.well-known/mcp.json\`）
- **完整索引文档**：\`${cleanOrigin}/llms-full.txt\`
- **纯 Markdown 经文协商**：对任意章节请求 \`${cleanOrigin}/read/{BOOK_ID}/{CHAPTER}.md\`（支持 \`?t={translationId}\`）或发送 \`Accept: text/markdown\`，直接返回零 HTML 噪声的纯文本经文。
- **语义深链与安静接管**：\`${cleanOrigin}/read/{BOOK_ID}/{CHAPTER}?t=cuv-simp&v=1-6&audio=quiet&autoplay=1\`（原生 App 支持 \`askbible://read/{BOOK_ID}/{CHAPTER}\`），点开即可直接落到指定经文并准备「安静」背景音乐。

## 核心入口
- [首页 · 安静回到经文](${cleanOrigin}/): 全屏自然影像与每日金句
- [圣经阅读](${cleanOrigin}/read): 正典 66 卷书目录与多译本阅读
- [救赎全景](${cleanOrigin}/panorama): 从创世、拣选、应许到成全的整本圣经脉络
- [读经计划](${cleanOrigin}/plans): 一年通读、历史编年、诗篇智慧书、麦琴读经表等 ${PUBLIC_READING_PLANS.length} 套计划
- [圣经人物馆](${cleanOrigin}/figures): 90+ 圣经人物的经文分类索引与简短说明

## 精选纯 Markdown 经文示例
${featuredLinks}

## 支持译本（节选，共 ${PUBLIC_TRANSLATIONS.length} 个公开静态译本）
- 中文：\`cuv-simp\`（和合本简体，默认）、\`cuv-trad\`（和合本繁體）、\`cbs-zh\`（中文当代译本）、\`swcb-zh\`（世界中文圣经）
- 英文：\`web-en\`（WEB）、\`kjv\`（KJV）、\`asv\`（ASV）、\`bbe-en\`（BBE）、\`ust-en\`（UST）、\`ylt-en\`（YLT）
- 西班牙语：\`rv1909-es\`、\`rvg-es\`、\`blm-es\`
`;
}

export function buildLlmsFullTxt(origin = PRODUCT_ORIGIN) {
  const cleanOrigin = String(origin || PRODUCT_ORIGIN).replace(/\/+$/, "");

  const translationsList = PUBLIC_TRANSLATIONS.map(
    (t) => `- \`${t.id}\`: ${t.labelZh} / ${t.labelEn} (${t.language})`,
  ).join("\n");

  const plansList = PUBLIC_READING_PLANS.map(
    (p) => `- \`${p.id}\`: ${p.nameZh} (${p.nameEn}) · ${p.days} 天 · ${p.theme} → ${cleanOrigin}/plans`,
  ).join("\n");

  const booksList = CANON_BOOKS.map(
    (b) => `- \`${b.id}\` ${b.zh} (${b.en}, ${b.testament}, ${b.chapters} 章) → ${cleanOrigin}/read/${b.id}/1`,
  ).join("\n");

  const quietList = QUIET_ENTRIES.map(
    (q) =>
      `- **${q.labelZh} (${q.labelEn})**：${q.noteZh} 推荐经文：${q.passages
        .map((p) => `${p.bookId} ${p.chapter}:${p.verseRange}`)
        .join("、")}`,
  ).join("\n");

  return `${buildLlmsTxt(cleanOrigin)}
---

## MCP 工具清单（两级渐进加载 + 读写隔离）
Endpoint: \`POST ${cleanOrigin}/mcp\`（\`Content-Type: application/json\`）

1. \`get_system_manifest\`（免登录）：返回 <250 Token 轻量能力域索引与协议约定。
2. \`get_passage\`（免登录）：按书卷（支持中英文名或 3 字母 USFM 代码）、章、节范围与译本精准返回经文，避免大模型背错章节号。
3. \`compare_translations\`（免登录）：多译本逐节对照（默认 \`cuv-simp\` + \`web-en\` + \`kjv\`）。
4. \`list_reading_plans\` / \`get_reading_plan_day\`（免登录）：查询读经计划目录与第 N 天应读章节。
5. \`search_figures\`（免登录）：按中英文名或书卷检索圣经人物馆经文索引。
6. \`find_quiet_entry\`（免登录）：按用户处境/情绪推荐温柔的经文入口、读经计划与直达深链。
7. \`build_entry_link\`（免登录）：生成 Web + 原生 App 的语义深链（含译本、节号、\`audio=quiet\`）。
8. \`get_my_reading_summary\`（需个人 Bearer Token）：只读查询个人上次读经位置、进度、书签与待确认提案。
9. \`propose_reading_action\`（需个人 Bearer Token，写隔离）：将外部 AI 写意图（收藏书签 / 切换计划 / 标记已读）排入 \`mcp_proposals\` 收件箱，由用户在端内 1 秒确认后正式入库，物理禁止直接篡改底库。

## 情绪与处境安静入口
${quietList}

## 全部公开静态译本（${PUBLIC_TRANSLATIONS.length}）
${translationsList}

## 全部读经计划（${PUBLIC_READING_PLANS.length}）
${plansList}

## 正典 66 卷书规范索引
${booksList}
`;
}

export function buildMcpDiscoveryJson(origin = PRODUCT_ORIGIN) {
  const cleanOrigin = String(origin || PRODUCT_ORIGIN).replace(/\/+$/, "");
  return {
    name: PRODUCT_NAME,
    version: MCP_SERVER_VERSION,
    protocolVersion: MCP_PROTOCOL_VERSION,
    description: "AskBible.me Remote MCP Server — 精确多译本经文、读经计划、人物索引、安静入口深链与读写隔离个人同步提案。",
    transport: "streamable-http",
    endpoint: `${cleanOrigin}/mcp`,
    documentation: `${cleanOrigin}/llms.txt`,
    fullContext: `${cleanOrigin}/llms-full.txt`,
    authentication: {
      publicTools: "none",
      personalTools: "bearer-session-token",
      header: "Authorization: Bearer <askbible_session_token>",
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
  };
}

export function buildSitemapXml(origin = PRODUCT_ORIGIN) {
  const cleanOrigin = String(origin || PRODUCT_ORIGIN).replace(/\/+$/, "");
  const urls = new Map();
  const add = (path, priority, changefreq = "weekly") => {
    urls.set(`${cleanOrigin}${path}`, { priority, changefreq });
  };

  add("/", "1.0", "daily");
  add("/read", "0.9", "weekly");
  add("/panorama", "0.8", "monthly");
  add("/plans", "0.8", "monthly");
  add("/figures", "0.8", "monthly");
  add("/explore", "0.8", "weekly");
  add("/llms.txt", "0.7", "weekly");
  add("/llms-full.txt", "0.6", "weekly");

  for (const book of CANON_BOOKS) {
    add(`/read/${book.id}/1`, "0.7", "monthly");
  }
  for (const { bookId, chapter } of FEATURED_CHAPTERS) {
    add(`/read/${bookId}/${chapter}`, "0.8", "monthly");
  }

  const body = [...urls.entries()]
    .map(
      ([loc, meta]) =>
        `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${meta.changefreq}</changefreq>\n    <priority>${meta.priority}</priority>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildRouteJsonLd(pathname, origin = PRODUCT_ORIGIN) {
  const cleanOrigin = String(origin || PRODUCT_ORIGIN).replace(/\/+$/, "");
  const cleanPath = String(pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";

  const readMatch = cleanPath.match(/^\/read\/([A-Za-z0-9]+)\/(\d+)$/);
  if (readMatch) {
    const book = resolveBook(readMatch[1]);
    const ch = Number(readMatch[2]);
    if (book && ch >= 1 && ch <= book.chapters) {
      return {
        "@context": "https://schema.org",
        "@type": "Chapter",
        name: `${book.zh} 第 ${ch} 章 (${book.en} ${ch})`,
        position: ch,
        inLanguage: ["zh-Hans", "en"],
        url: `${cleanOrigin}/read/${book.id}/${ch}`,
        isPartOf: {
          "@type": "Book",
          name: `${book.zh} (${book.en})`,
          url: `${cleanOrigin}/read/${book.id}/1`,
        },
        publisher: {
          "@type": "Organization",
          name: PRODUCT_NAME,
          url: cleanOrigin,
        },
      };
    }
  }

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: PRODUCT_NAME,
    url: cleanOrigin,
    description: "一个让人重新进入圣经的安静入口。提供正典 66 卷多译本圣经、章节朗读、读经计划、救赎全景与圣经人物馆。",
    inLanguage: ["zh-Hans", "zh-Hant", "en", "es"],
    potentialAction: {
      "@type": "ReadAction",
      target: `${cleanOrigin}/read/{bookId}/{chapter}`,
    },
  };
}

/**
 * @param {{
 *   book: { id: string, zh: string, en: string },
 *   chapter: number,
 *   translation?: { id: string, labelZh: string, labelEn: string } | null,
 *   verses: Array<{ verse: number, text: string }>,
 *   verseRange?: { start: number, end: number } | null,
 *   origin?: string,
 * }} opts
 */
export function formatChapterMarkdown({
  book,
  chapter,
  translation,
  verses,
  verseRange = null,
  origin = PRODUCT_ORIGIN,
}) {
  const cleanOrigin = String(origin || PRODUCT_ORIGIN).replace(/\/+$/, "");
  const trId = translation?.id || DEFAULT_TRANSLATION_ID;
  const trLabel = translation ? `${translation.labelZh} (${translation.id})` : trId;
  const rangeLabel = verseRange
    ? verseRange.start === verseRange.end
      ? `:${verseRange.start}`
      : `:${verseRange.start}-${verseRange.end}`
    : "";

  const lines = [
    "---",
    `source: ${PRODUCT_NAME}`,
    `bookId: ${book.id}`,
    `bookZh: ${book.zh}`,
    `bookEn: ${book.en}`,
    `chapter: ${chapter}`,
    `translation: ${trId}`,
    `canonicalUrl: ${cleanOrigin}/read/${book.id}/${chapter}`,
    `quietEntryUrl: ${cleanOrigin}/read/${book.id}/${chapter}?t=${trId}&audio=quiet`,
    "---",
    "",
    `# ${book.zh} ${chapter}${rangeLabel} · ${book.en} ${chapter}${rangeLabel}`,
    "",
    `> 译本：${trLabel} · 来源：[${PRODUCT_NAME}](${cleanOrigin}/read/${book.id}/${chapter})`,
    "",
  ];

  for (const row of verses) {
    lines.push(`${row.verse}. ${row.text}`);
  }
  lines.push("");
  return lines.join("\n");
}
