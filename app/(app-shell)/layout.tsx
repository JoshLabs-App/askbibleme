import {
  defaultVisualConsoleBundle,
  readMusicVisualConsoleBundle,
} from "@/lib/music-visual/visual-console-file";
import { AppShellProviders } from "./app-shell-providers";

/**
 * 视口锁定的壳：主区单独滚动；主导航 `HomeBottomNav` 始终在壳底（不受自然页「收起场景区」影响）。
 * 自然页内 `DockChromeCollapse`（场景卡）叠在画面上；默认收起，点主视频区域切换显隐。
 *
 * 壳层顶对齐视口；若 Android 顶缘仍有细缝，由 `html`/`body` 画布色兜底，勿再负 top 抬壳（避免壳内 `fixed` 错位）。
 * 自然首页壳层深色见 `AppShellFixedChrome`（随 pathname 更新，避免软导航残留浅色底）。
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const visualConsole =
    (await readMusicVisualConsoleBundle(process.cwd())) ?? defaultVisualConsoleBundle();
  return <AppShellProviders visualConsole={visualConsole}>{children}</AppShellProviders>;
}
