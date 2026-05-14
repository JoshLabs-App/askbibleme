import { DEFAULT_BRAND_COLORS } from "@/lib/site-branding-colors";

/** 默认底栏色（= `DEFAULT_BRAND_COLORS.appDark`）；运行时应优先用 CSS `var(--brand-app-dark)` */
export const HOME_DOCK_NAV_BG = DEFAULT_BRAND_COLORS.appDark;

/**
 * 自然页底部 fixed 压层请用 `bottom` 避让叠在画面上的导航/控件。
 * `readAppShellScrollContentBoxClientHeight`：量 `[data-app-shell-scroll]` 时扣除其 padding（底栏槽已取消，多为 0）。
 */
export function readAppShellScrollContentBoxClientHeight(root: HTMLElement): number {
  const cs = getComputedStyle(root);
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  return Math.max(0, Math.round(root.clientHeight - pt - pb));
}
