/** 章页路由 `?verse=` / Expo `params.verse` → 节号 */
export function parseScriptureVerseParam(raw: string | string[] | null | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : null;
}
