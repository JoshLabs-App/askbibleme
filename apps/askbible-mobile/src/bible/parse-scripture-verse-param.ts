/** 章页路由 `params.verse` → 节号（与 `lib/bible/parse-scripture-verse-param.ts` 同构） */
export function parseScriptureVerseParam(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : null;
}
