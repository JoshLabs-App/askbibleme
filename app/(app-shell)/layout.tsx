import { AppShellProviders } from "./app-shell-providers";
import { buildHomeVerseRotationFromShellCookies } from "@/lib/bible/home-verse-rotation-rsc";

/**
 * 视口锁定的壳：主区单独滚动；非自然页时主导航为底部 fixed 图标条 + 播放键。
 * 自然首页 `/`、`/nature`：主导航叠在视频底部；`DockChromeCollapse`（场景卡）为延迟约 3s → 淡入 → 展示约 3s → 渐隐收起（`peekDockChrome` 与进入首页同节奏）；点主画面可即时展开/收起并打断自动序列。
 *
 * 壳层顶对齐视口；若 Android 顶缘仍有细缝，由 `html`/`body` 画布色兜底，勿再负 top 抬壳（避免壳内 `fixed` 错位）。
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const cwd = process.cwd();
  const verseFallbackByLocale = await buildHomeVerseRotationFromShellCookies(cwd);
  return <AppShellProviders verseFallbackByLocale={verseFallbackByLocale}>{children}</AppShellProviders>;
}
