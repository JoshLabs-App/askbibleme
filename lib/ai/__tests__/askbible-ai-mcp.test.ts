import { describe, expect, it } from "vitest";
import {
  CANON_BOOKS,
  PUBLIC_TRANSLATIONS,
  buildEntryLink,
  resolveBook,
  resolveTranslation,
} from "@/lib/ai/askbible-ai-catalog.mjs";
import {
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildMcpDiscoveryJson,
  buildRobotsTxt,
  buildRouteJsonLd,
  buildSitemapXml,
  formatChapterMarkdown,
} from "@/lib/ai/askbible-ai-docs.mjs";
import { handleMcpJsonRpc, type McpDataProvider } from "@/lib/ai/askbible-mcp-core.mjs";

function createMockProvider(): McpDataProvider {
  const chapters: Record<string, Array<{ verse: number; text: string }>> = {
    "cuv-simp/PSA/23": [
      { verse: 1, text: "耶和华是我的牧者，我必不至缺乏。" },
      { verse: 2, text: "他使我躺卧在青草地上，领我在可安歇的水边。" },
      { verse: 3, text: "他使我的灵魂苏醒，为自己的名引导我走义路。" },
    ],
    "web-en/PSA/23": [
      { verse: 1, text: "Yahweh is my shepherd; I shall lack nothing." },
      { verse: 2, text: "He makes me lie down in green pastures. He leads me beside still waters." },
    ],
    "kjv/PSA/23": [
      { verse: 1, text: "The LORD is my shepherd; I shall not want." },
      { verse: 2, text: "He maketh me to lie down in green pastures: he leadeth me beside the still waters." },
    ],
  };

  return {
    async loadChapter(translationId, bookId, chapter) {
      return chapters[`${translationId}/${bookId}/${chapter}`] || null;
    },
    async loadReadingPlan(planId) {
      if (planId !== "esvthroughthebible") return null;
      return {
        days: [{ day: 1, readings: [{ bookId: "GEN", startChapter: 1, endChapter: 2 }] }],
      };
    },
    async loadFigures() {
      return [
        {
          id: "david",
          slug: "figure-david",
          displayNameZh: "大卫",
          englishName: "David",
          primaryBookId: "PSA",
          bookIds: ["1SA", "2SA", "PSA"],
          periodLabelZh: "联合王国时期",
          scripturePersonalityZh: "以色列合神心意的君王与诗篇作者。",
        },
      ];
    },
    async callSyncApi(path, init) {
      if (path === "/v1/mcp/summary") {
        return {
          ok: true,
          status: 200,
          data: { ok: true, lastPosition: { bookId: "PSA", chapter: 23 }, pendingProposalsCount: 1 },
        };
      }
      if (path === "/v1/mcp/proposals" && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          data: { ok: true, proposal: { id: "prop-1", status: "pending", ...(init.body as Record<string, unknown>) } },
        };
      }
      return { ok: false, status: 404, data: { error: "not_found" } };
    },
  };
}

describe("AskBible AI discovery & Remote MCP engine", () => {
  it("normalizes 66 canon books, translations, and builds semantic entry links", () => {
    expect(CANON_BOOKS).toHaveLength(66);
    expect(PUBLIC_TRANSLATIONS.length).toBeGreaterThanOrEqual(15);
    expect(resolveBook("诗篇")?.id).toBe("PSA");
    expect(resolveBook("John")?.id).toBe("JHN");
    expect(resolveTranslation("cuv")?.id).toBe("cuv-simp");

    const link = buildEntryLink({
      bookId: "诗篇",
      chapter: 23,
      verse: "1-3",
      translation: "cuv-simp",
      audio: "quiet",
      autoplay: true,
    });
    expect(link?.webUrl).toBe("https://askbible.me/read/PSA/23?t=cuv-simp&v=1-3&audio=quiet&autoplay=1#v1");
    expect(link?.appUrl).toBe("askbible://read/PSA/23?t=cuv-simp&v=1-3&audio=quiet&autoplay=1#v1");
    expect(link?.markdownUrl).toBe("https://askbible.me/read/PSA/23.md?t=cuv-simp");
  });

  it("generates robots.txt, llms.txt, sitemap.xml, discovery json, json-ld, and chapter markdown", () => {
    const robots = buildRobotsTxt();
    expect(robots).toContain("User-agent: ShapBot\nDisallow: /");
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("Sitemap: https://askbible.me/sitemap.xml");

    const llms = buildLlmsTxt();
    expect(llms).toContain("AskBible.me");
    expect(llms).toContain("https://askbible.me/mcp");

    const llmsFull = buildLlmsFullTxt();
    expect(llmsFull).toContain("`PSA` 诗篇");
    expect(llmsFull).toContain("propose_reading_action");

    const sitemap = buildSitemapXml();
    expect(sitemap).toContain("<loc>https://askbible.me/read/PSA/23</loc>");

    const discovery = buildMcpDiscoveryJson();
    expect(discovery.endpoint).toBe("https://askbible.me/mcp");

    const jsonLd = buildRouteJsonLd("/read/JHN/10");
    expect(jsonLd["@type"]).toBe("Chapter");

    const md = formatChapterMarkdown({
      book: { id: "PSA", zh: "诗篇", en: "Psalms" },
      chapter: 23,
      translation: { id: "cuv-simp", labelZh: "和合本（简体）", labelEn: "CUV" },
      verses: [{ verse: 1, text: "耶和华是我的牧者，我必不至缺乏。" }],
    });
    expect(md).toContain("# 诗篇 23 · Psalms 23");
    expect(md).toContain("1. 耶和华是我的牧者，我必不至缺乏。");
  });

  it("handles MCP initialize, tools/list, get_passage, compare_translations, find_quiet_entry, and inbox write isolation", async () => {
    const provider = createMockProvider();

    const init = (await handleMcpJsonRpc({ jsonrpc: "2.0", id: 1, method: "initialize" }, { provider })) as Record<string, any>;
    expect(init.result.serverInfo.name).toBe("AskBible.me");

    const list = (await handleMcpJsonRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, { provider })) as Record<string, any>;
    expect(list.result.tools.length).toBeGreaterThanOrEqual(9);

    const passage = (await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_passage", arguments: { book: "诗篇", chapter: 23, verses: "1-2" } },
      },
      { provider },
    )) as Record<string, any>;
    expect(passage.result.structuredContent.verses).toHaveLength(2);
    expect(passage.result.structuredContent.verses[0].text).toContain("耶和华是我的牧者");

    const cmp = (await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "compare_translations", arguments: { book: "PSA", chapter: 23, verses: "1" } },
      },
      { provider },
    )) as Record<string, any>;
    expect(cmp.result.structuredContent.comparison[0].texts["cuv-simp"]).toContain("牧者");
    expect(cmp.result.structuredContent.comparison[0].texts["kjv"]).toContain("shepherd");

    const quiet = (await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "find_quiet_entry", arguments: { mood: "晚上睡不着很焦虑" } },
      },
      { provider },
    )) as Record<string, any>;
    expect(quiet.result.structuredContent.audioMood).toBe("quiet");
    expect(quiet.result.structuredContent.passages[0].links.webUrl).toContain("audio=quiet");

    // Personal tool without token must return AUTH_REQUIRED
    const unauth = (await handleMcpJsonRpc(
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "get_my_reading_summary", arguments: {} } },
      { provider },
    )) as Record<string, any>;
    expect(unauth.result.isError).toBe(true);
    expect(unauth.result.structuredContent.code).toBe("AUTH_REQUIRED");

    // Personal write proposal with token goes to pending inbox
    const proposed = (await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "propose_reading_action",
          arguments: { action: "add_bookmark", book: "PSA", chapter: 23, verse: 1, note: "安静得力", sourceAgent: "Claude" },
        },
      },
      { provider, authToken: "demo-token" },
    )) as Record<string, any>;
    expect(proposed.result.structuredContent.status).toBe("pending_user_confirmation");
    expect(proposed.result.structuredContent.proposal.id).toBe("prop-1");
  });
});
