import type { HistoricalCreedBodyContent } from "./types";
import { chicagoHermeneuticsBody } from "./chicago-hermeneutics";
import { chicagoInerrancyBody } from "./chicago-inerrancy";
import { heidelbergCatechismBody } from "./heidelberg-catechism";
import { westminsterLargerCatechismBody } from "./westminster-larger-catechism";
import { westminsterShorterCatechismBody } from "./westminster-shorter-catechism";

/** Static registry so Metro / RN standalone builds include all long-form creed bodies. */
export const LAZY_HISTORICAL_CREED_BODIES: Readonly<
  Record<string, HistoricalCreedBodyContent>
> = {
  "chicago-inerrancy": chicagoInerrancyBody,
  "chicago-hermeneutics": chicagoHermeneuticsBody,
  "heidelberg-catechism": heidelbergCatechismBody,
  "westminster-shorter-catechism": westminsterShorterCatechismBody,
  "westminster-larger-catechism": westminsterLargerCatechismBody,
};
