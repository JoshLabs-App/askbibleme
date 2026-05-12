import {
  defaultVisualConsoleBundle,
  readMusicVisualConsoleBundle,
} from "@/lib/music-visual/visual-console-file";
import { MusicRouteProviders } from "@/components/music/MusicRouteProviders";

/** 独立于 `(app-shell)`：无底栏；与主站共享根级 `MusicShellPlaybackProvider`。 */
export default async function MusicSegmentLayout({ children }: { children: React.ReactNode }) {
  const visualConsole =
    (await readMusicVisualConsoleBundle(process.cwd())) ?? defaultVisualConsoleBundle();
  return <MusicRouteProviders visualConsole={visualConsole}>{children}</MusicRouteProviders>;
}
