import { AppShellProviders } from "./app-shell-providers";
import { buildHomeVerseRotationFromShellCookies } from "@/lib/bible/home-verse-rotation-rsc";

/**
 * 视口锁定的壳：主区单独滚动；非自然页时主导航为底部 fixed 图标条 + 播放键。
 * 自然首页 `/`、`/nature`：主导航叠在视频底部；场景选择在 `/scenes`；自然首页底栏不再收纳场景卡。
 *
 * 壳层顶对齐视口；若 Android 顶缘仍有细缝，由 `html`/`body` 画布色兜底，勿再负 top 抬壳（避免壳内 `fixed` 错位）。
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const cwd = process.cwd();
  const verseFallbackByLocale = await buildHomeVerseRotationFromShellCookies(cwd);
  return <AppShellProviders verseFallbackByLocale={verseFallbackByLocale}>{children}</AppShellProviders>;
}
