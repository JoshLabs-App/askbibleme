import {
  defaultVisualConsoleBundle,
  readMusicVisualConsoleBundle,
} from "@/lib/music-visual/visual-console-file";
import { AppShellProviders } from "./app-shell-providers";

/**
 * 视口锁定的壳：主区单独滚动；主导航 `HomeBottomNav` 始终在壳底（不受自然页「收起场景区」影响）。
 * 自然页内 `DockChromeCollapse` 可收起场景卡与快捷入口（默认展开；点主视频可切换）。
 *
 * Android 顶缘亚像素缝：见 `globals.css` 中 `--app-viewport-bleed-top`；负 top 略加大并 `transform-gpu` 促合成层。
 * 自然首页壳层深色见 `AppShellFixedChrome`（随 pathname 更新，避免软导航残留浅色底）。
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const visualConsole =
    (await readMusicVisualConsoleBundle(process.cwd())) ?? defaultVisualConsoleBundle();
  return <AppShellProviders visualConsole={visualConsole}>{children}</AppShellProviders>;
}
