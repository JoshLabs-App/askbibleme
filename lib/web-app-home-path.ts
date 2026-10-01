/**
 * 网页版首页（自然影像 + 轮播经文）。
 *
 * 根路径 `/` 自 2026-10-01 起是官网介绍页（`docs/DECISIONS.md` D-10），
 * 网页版里凡是「回首页」都指这里，不要再写 `/`。
 * `public/sw.js` 和 `lib/read/parchment-shell-boot.ts` 里是纯字符串脚本，各自写死了同一个值。
 */
export const WEB_APP_HOME_PATH = "/web";

export function isWebAppHomePath(pathname: string): boolean {
  return pathname === WEB_APP_HOME_PATH || pathname === `${WEB_APP_HOME_PATH}/`;
}
