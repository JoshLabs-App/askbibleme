import type { AppLocale } from "../i18n/config";
import type { HistoricalCreedBodyContent } from "./historical-creeds-bodies";
import { INLINE_HISTORICAL_CREED_BODIES } from "./historical-creeds-bodies";
import { LAZY_HISTORICAL_CREED_BODIES } from "./historical-creeds-bodies/lazy-bodies";
import { pickBodyLocale, processBodyParagraphs } from "./historical-creeds-body-process";

export { historicalCreedHasBody, isLazyHistoricalCreedBody } from "./historical-creeds-body-meta";

const rawBodyCache = new Map<string, HistoricalCreedBodyContent>();
const processedBodyCache = new Map<string, string[]>();

export async function loadHistoricalCreedBodyContent(
  creedId: string,
): Promise<HistoricalCreedBodyContent | null> {
  const inline = INLINE_HISTORICAL_CREED_BODIES[creedId];
  if (inline) return inline;

  const cached = rawBodyCache.get(creedId);
  if (cached) return cached;

  const lazy = LAZY_HISTORICAL_CREED_BODIES[creedId];
  if (!lazy) return null;

  rawBodyCache.set(creedId, lazy);
  return lazy;
}

/** Load + clean + linkify creed body only when the user opens full text. */
export async function resolveHistoricalCreedBodyParagraphs(
  creedId: string,
  locale: AppLocale,
): Promise<string[]> {
  const cacheKey = `${creedId}:${locale}`;
  const cached = processedBodyCache.get(cacheKey);
  if (cached) return cached;

  const content = await loadHistoricalCreedBodyContent(creedId);
  if (!content) return [];

  const processed = processBodyParagraphs(pickBodyLocale(content, locale), locale);
  processedBodyCache.set(cacheKey, processed);
  return processed;
}

/** Synchronous path for small inline bodies (optional fast path). */
export function resolveInlineHistoricalCreedBodyParagraphs(
  creedId: string,
  locale: AppLocale,
): string[] | null {
  const content = INLINE_HISTORICAL_CREED_BODIES[creedId];
  if (!content) return null;

  const cacheKey = `${creedId}:${locale}`;
  const cached = processedBodyCache.get(cacheKey);
  if (cached) return cached;

  const processed = processBodyParagraphs(pickBodyLocale(content, locale), locale);
  processedBodyCache.set(cacheKey, processed);
  return processed;
}
