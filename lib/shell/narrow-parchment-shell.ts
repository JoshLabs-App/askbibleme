/** 静态信息页：全屏羊皮卷底 + 手机窄栏版心（不随大屏铺开）。 */
export const NARROW_PARCHMENT_PATHS = ["/about", "/feedback", "/install", "/privacy", "/login", "/register"] as const;

export function normalizeAppPath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

export function isNarrowParchmentPath(pathname: string): boolean {
  return (NARROW_PARCHMENT_PATHS as readonly string[]).includes(normalizeAppPath(pathname));
}
