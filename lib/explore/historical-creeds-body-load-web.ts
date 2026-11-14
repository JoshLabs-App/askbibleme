import type { AppLocale } from "../i18n/config";
import type { HistoricalCreedBodyContent } from "./historical-creeds-bodies";
import { INLINE_HISTORICAL_CREED_BODIES } from "./historical-creeds-bodies";
import { pickBodyLocale, processBodyParagraphs } from "./historical-creeds-body-process";
import { isLazyHistoricalCreedBody } from "./historical-creeds-body-meta";

export { historicalCreedHasBody, isLazyHistoricalCreedBody } from "./historical-creeds-body-meta";

/**
 * 网页端信经全文：长文（五篇，原文约 880KB）不再 import 进 JS，而是打开时取静态 JSON
 * `/data/historical-creeds/{id}.json`（prebuild 由 scripts/build-static-creed-bodies.ts 生成）。
 * 原先它们被打进探索页 chunk，每个访问者下载约 0.3MB（gzip），Cloudflare Worker 脚本也跟着变大。
 * 旧 Expo App 仍用 historical-creeds-body-load.ts（Metro 要静态注册表）。
 */
const STATIC_CREED_BODY_BASE = "/data/historical-creeds";
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const rawBodyCache = new Map<string, HistoricalCreedBodyContent>();
const processedBodyCache = new Map<string, string[]>();

async function loadHistoricalCreedBodyContent(creedId: string): Promise<HistoricalCreedBodyContent | null> {
  const inline = INLINE_HISTORICAL_CREED_BODIES[creedId];
  if (inline) return inline;
  const cached = rawBodyCache.get(creedId);
  if (cached) return cached;
  if (!isLazyHistoricalCreedBody(creedId) || !ID_RE.test(creedId)) return null;
  try {
    const res = await fetch(`${STATIC_CREED_BODY_BASE}/${creedId}.json`, { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<HistoricalCreedBodyContent>;
    if (!Array.isArray(data.bodyZh) || !Array.isArray(data.bodyZhTw) || !Array.isArray(data.bodyEn)) return null;
    const content: HistoricalCreedBodyContent = {
      bodyZh: data.bodyZh,
      bodyZhTw: data.bodyZhTw,
      bodyEn: data.bodyEn,
    };
    rawBodyCache.set(creedId, content);
    return content;
  } catch {
    return null;
  }
}

/** 打开全文时才取 + 清洗 + 链接化。 */
export async function resolveHistoricalCreedBodyParagraphs(creedId: string, locale: AppLocale): Promise<string[]> {
  const cacheKey = `${creedId}:${locale}`;
  const cached = processedBodyCache.get(cacheKey);
  if (cached) return cached;
  const content = await loadHistoricalCreedBodyContent(creedId);
  if (!content) return [];
  const processed = processBodyParagraphs(pickBodyLocale(content, locale), locale);
  processedBodyCache.set(cacheKey, processed);
  return processed;
}

/** 小体量内联正文（普世信经）的同步快路径。 */
export function resolveInlineHistoricalCreedBodyParagraphs(creedId: string, locale: AppLocale): string[] | null {
  const content = INLINE_HISTORICAL_CREED_BODIES[creedId];
  if (!content) return null;
  const cacheKey = `${creedId}:${locale}`;
  const cached = processedBodyCache.get(cacheKey);
  if (cached) return cached;
  const processed = processBodyParagraphs(pickBodyLocale(content, locale), locale);
  processedBodyCache.set(cacheKey, processed);
  return processed;
}
