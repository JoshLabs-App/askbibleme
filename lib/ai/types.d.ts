// TypeScript declarations for AskBible shared AI & MCP modules.

declare module "@/lib/ai/askbible-ai-catalog.mjs" {
  export const PRODUCT_NAME: string;
  export const PRODUCT_ORIGIN: string;
  export const APP_SCHEME: string;
  export const MCP_PROTOCOL_VERSION: string;
  export const MCP_SERVER_VERSION: string;
  export const DEFAULT_TRANSLATION_ID: string;
  export const CANON_BOOKS: ReadonlyArray<{
    id: string;
    zh: string;
    en: string;
    testament: "OT" | "NT";
    chapters: number;
    aliases: string[];
  }>;
  export const PUBLIC_TRANSLATIONS: ReadonlyArray<{
    id: string;
    labelZh: string;
    labelEn: string;
    language: string;
    aliases: string[];
  }>;
  export const PUBLIC_READING_PLANS: ReadonlyArray<{
    id: string;
    nameZh: string;
    nameEn: string;
    days: number;
    theme: string;
  }>;
  export function resolveBook(input: unknown): {
    id: string;
    zh: string;
    en: string;
    testament: "OT" | "NT";
    chapters: number;
    aliases: string[];
  } | null;
  export function resolveTranslation(input: unknown): {
    id: string;
    labelZh: string;
    labelEn: string;
    language: string;
    aliases: string[];
  } | null;
  export function parseVerseRange(raw: unknown): { start: number; end: number } | null;
  export function buildEntryLink(opts: {
    bookId: string;
    chapter: number;
    verse?: string | number | null;
    translation?: string | null;
    audio?: "quiet" | "off" | null;
    autoplay?: boolean;
    origin?: string;
  }): {
    bookId: string;
    bookZh: string;
    bookEn: string;
    chapter: number;
    verse: string | null;
    translationId: string;
    audioMood: "quiet" | "off" | null;
    webUrl: string;
    appUrl: string;
    markdownUrl: string;
  } | null;
}

declare module "@/lib/ai/askbible-ai-docs.mjs" {
  export function buildRobotsTxt(origin?: string): string;
  export function buildLlmsTxt(origin?: string): string;
  export function buildLlmsFullTxt(origin?: string): string;
  export function buildMcpDiscoveryJson(origin?: string): Record<string, unknown>;
  export function buildSitemapXml(origin?: string): string;
  export function buildRouteJsonLd(pathname: string, origin?: string): Record<string, unknown>;
  export function formatChapterMarkdown(opts: {
    book: { id: string; zh: string; en: string };
    chapter: number;
    translation?: { id: string; labelZh: string; labelEn: string } | null;
    verses: Array<{ verse: number; text: string }>;
    verseRange?: { start: number; end: number } | null;
    origin?: string;
  }): string;
}

declare module "@/lib/ai/askbible-mcp-core.mjs" {
  export interface McpDataProvider {
    loadChapter(translationId: string, bookId: string, chapter: number): Promise<Array<{ verse: number; text: string }> | null>;
    loadReadingPlan(planId: string): Promise<unknown | null>;
    loadFigures(): Promise<Array<Record<string, unknown>>>;
    callSyncApi?: (
      path: string,
      init?: { method?: string; token?: string; body?: unknown },
    ) => Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }>;
  }
  export const MCP_TOOLS: ReadonlyArray<Record<string, unknown>>;
  export const MCP_RESOURCES: ReadonlyArray<Record<string, unknown>>;
  export const MCP_PROMPTS: ReadonlyArray<Record<string, unknown>>;
  export function handleMcpJsonRpc(
    rpcRequest: unknown,
    ctx: { provider: McpDataProvider; origin?: string; authToken?: string | null },
  ): Promise<Record<string, unknown> | null>;
}
