import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import {
  HomeAtmosphereVisualProvider,
  MusicShellVisualProvider,
  MusicVisualTuningProvider,
} from "@/music-visual";

/**
 * 与前台 `(app-shell)` 一致：整屏 `fixed` 壳层；主栏内再滚动。
 * Android 顶缘 1px 缝与前台同法处理（`top:-1px` + `bottom:0`）。
 * 仍挂载播放与视觉 Provider，供 `/admin/visual` 等使用。
 */
export default function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <MusicShellPlaybackProvider>
      <MusicVisualTuningProvider>
        <HomeAtmosphereVisualProvider>
          <MusicShellVisualProvider>
            <div className="fixed bottom-0 left-0 right-0 top-[-1px] z-0 flex min-h-0 w-full flex-col overflow-hidden bg-adminBg">
              {children}
            </div>
          </MusicShellVisualProvider>
        </HomeAtmosphereVisualProvider>
      </MusicVisualTuningProvider>
    </MusicShellPlaybackProvider>
  );
}
