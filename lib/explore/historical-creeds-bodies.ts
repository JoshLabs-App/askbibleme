export type { HistoricalCreedBodyContent } from "./historical-creeds-bodies/types";
import type { HistoricalCreedBodyContent } from "./historical-creeds-bodies/types";
import { ECUMENICAL_CREED_BODIES } from "./historical-creeds-bodies/ecumenical-creeds.generated";

/** Ecumenical creed bodies synced from published sources; long texts load on demand. */
export const INLINE_HISTORICAL_CREED_BODIES: Record<string, HistoricalCreedBodyContent> = {
  ...ECUMENICAL_CREED_BODIES,
};

/** @deprecated Use historicalCreedHasBody / resolveHistoricalCreedBodyParagraphs instead. */
export const HISTORICAL_CREED_BODIES = INLINE_HISTORICAL_CREED_BODIES;
