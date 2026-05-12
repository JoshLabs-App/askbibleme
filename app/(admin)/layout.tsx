import {
  defaultVisualConsoleBundle,
  readMusicVisualConsoleBundle,
} from "@/lib/music-visual/visual-console-file";
import { AdminProviders } from "./admin-providers";

/**
 * 与前台 `(app-shell)` 一致：整屏 `fixed` 壳层；主栏内再滚动。
 * 顶缘出血与前台一致（`--app-viewport-bleed-top` + `transform-gpu`）。
 * 仍挂载播放与视觉 Provider，供 `/admin/visual` 等使用。
 */
export default async function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  const visualConsole =
    (await readMusicVisualConsoleBundle(process.cwd())) ?? defaultVisualConsoleBundle();
  return <AdminProviders visualConsole={visualConsole}>{children}</AdminProviders>;
}
