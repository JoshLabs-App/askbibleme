/** Expo Router may pass string | string[] on Android for the same dynamic segment. */
export function resolveRouteParam(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}
