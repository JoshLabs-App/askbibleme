import { AppShellProviders } from "./app-shell-providers";
import { buildHomeVerseRotationByLocale } from "@/lib/bible/home-verse-ref-rotation";
import "./read/read-parchment-background.css";
import "./read/read-parchment-shell-chrome.css";

/**
 * 视口锁定的壳：主区单独滚动；非自然页时主导航为底部 fixed 图标条 + 播放键。
 * 自然首页 `/`、`/nature`：主导航叠在视频底部；场景选择在 `/scenes`；自然首页底栏不再收纳场景卡。
 *
 * 壳层顶对齐视口；若 Android 顶缘仍有细缝，由 `html`/`body` 画布色兜底，勿再负 top 抬壳（避免壳内 `fixed` 错位）。
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const cwd = process.cwd();
  /**
   * 首屏兜底金句取全部语言（每种只有 bootstrap 的 40 句，很小），不再按请求 cookie 挑语言。
   * 这里读了 cookies()/headers() 会让整个壳下面的页面都被迫动态渲染、响应 no-store，
   * 读经章页因此每次现渲染（线上实测首字节 1.7s）。语言由客户端 LocaleProvider 选。
   */
  const verseFallbackByLocale = await buildHomeVerseRotationByLocale(cwd);
  return <AppShellProviders verseFallbackByLocale={verseFallbackByLocale}>{children}</AppShellProviders>;
}
