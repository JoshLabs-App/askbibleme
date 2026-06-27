import { INLINE_HISTORICAL_CREED_BODIES } from "./historical-creeds-bodies";

export const LAZY_HISTORICAL_CREED_BODY_IDS = [
  "chicago-inerrancy",
  "chicago-hermeneutics",
  "heidelberg-catechism",
  "westminster-shorter-catechism",
  "westminster-larger-catechism",
] as const;

const LAZY_BODY_ID_SET = new Set<string>(LAZY_HISTORICAL_CREED_BODY_IDS);

export function historicalCreedHasBody(creedId: string): boolean {
  return creedId in INLINE_HISTORICAL_CREED_BODIES || LAZY_BODY_ID_SET.has(creedId);
}

export function isLazyHistoricalCreedBody(creedId: string): boolean {
  return LAZY_BODY_ID_SET.has(creedId);
}
