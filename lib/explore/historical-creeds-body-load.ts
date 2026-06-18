import type { AppLocale } from "../i18n/config";
import type { HistoricalCreedBodyContent } from "./historical-creeds-bodies";
import { INLINE_HISTORICAL_CREED_BODIES } from "./historical-creeds-bodies";
import {
  cleanupHistoricalCreedEnglishText,
  normalizeHistoricalCreedChineseText,
} from "./historical-creeds-text-cleanup.mjs";
import { linkifyNormalizedChineseRefs } from "./historical-creeds-scripture-links";
import { linkifyHistoricalCreedEnglishRefs } from "./historical-creeds-linkify-en";

function cleanupHistoricalCreedBodyParagraph(text: string, locale: "zh" | "en"): string {
  if (locale === "en") return cleanupHistoricalCreedEnglishText(text);
  return normalizeHistoricalCreedChineseText(text);
}

const LAZY_BODY_LOADERS: Record<string, () => Promise<HistoricalCreedBodyContent>> = {
  "chicago-inerrancy": () =>
    import("./historical-creeds-bodies/chicago-inerrancy").then((m) => m.chicagoInerrancyBody),
  "chicago-hermeneutics": () =>
    import("./historical-creeds-bodies/chicago-hermeneutics").then((m) => m.chicagoHermeneuticsBody),
  "heidelberg-catechism": () =>
    import("./historical-creeds-bodies/heidelberg-catechism").then((m) => m.heidelbergCatechismBody),
  "westminster-shorter-catechism": () =>
    import("./historical-creeds-bodies/westminster-shorter-catechism").then(
      (m) => m.westminsterShorterCatechismBody,
    ),
  "westminster-larger-catechism": () =>
    import("./historical-creeds-bodies/westminster-larger-catechism").then(
      (m) => m.westminsterLargerCatechismBody,
    ),
};

const rawBodyCache = new Map<string, HistoricalCreedBodyContent>();
const processedBodyCache = new Map<string, string[]>();

export function historicalCreedHasBody(creedId: string): boolean {
  return creedId in INLINE_HISTORICAL_CREED_BODIES || creedId in LAZY_BODY_LOADERS;
}

function pickBodyLocale(
  content: HistoricalCreedBodyContent,
  locale: AppLocale,
): string[] {
  if (locale === "en") return content.bodyEn;
  if (locale === "zh-TW") return content.bodyZhTw;
  return content.bodyZh;
}

function processBodyParagraphs(paragraphs: string[], locale: AppLocale): string[] {
  const bodyLocale = locale === "en" ? "en" : "zh";
  return paragraphs.map((paragraph) => {
    const cleaned = cleanupHistoricalCreedBodyParagraph(paragraph, bodyLocale);
    if (/\]\(\/read\//.test(cleaned)) return cleaned;
    return bodyLocale === "en"
      ? linkifyHistoricalCreedEnglishRefs(cleaned)
      : linkifyNormalizedChineseRefs(cleaned);
  });
}

export async function loadHistoricalCreedBodyContent(
  creedId: string,
): Promise<HistoricalCreedBodyContent | null> {
  const inline = INLINE_HISTORICAL_CREED_BODIES[creedId];
  if (inline) return inline;

  const cached = rawBodyCache.get(creedId);
  if (cached) return cached;

  const loader = LAZY_BODY_LOADERS[creedId];
  if (!loader) return null;

  const content = await loader();
  rawBodyCache.set(creedId, content);
  return content;
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

export function isLazyHistoricalCreedBody(creedId: string): boolean {
  return creedId in LAZY_BODY_LOADERS;
}
