/** 读经 Stack 全页选译本（对齐 App `/read/translations`）。 */
export function readTranslationsHref(): "/read/translations" {
  return "/read/translations";
}

export function isReadTranslationsPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === "/read/translations";
}
