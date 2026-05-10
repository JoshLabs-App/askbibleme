import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import {
  HomeAtmosphereVisualProvider,
  MusicShellVisualProvider,
  MusicVisualTuningProvider,
} from "@/music-visual";

/**
 * 与前台 `(app-shell)` 一致：`fixed inset-0` 锁定为整屏高度（含 `dvh` 安全区），主栏内再滚动。
 * 仍挂载播放与视觉 Provider，供 `/admin/visual` 等使用。
 */
export default function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <MusicShellPlaybackProvider>
      <MusicVisualTuningProvider>
        <HomeAtmosphereVisualProvider>
          <MusicShellVisualProvider>
            <div className="fixed inset-0 z-0 flex min-h-0 max-h-dvh w-full flex-col overflow-hidden bg-adminBg supports-[height:100dvh]:max-h-[100dvh]">
              {children}
            </div>
          </MusicShellVisualProvider>
        </HomeAtmosphereVisualProvider>
      </MusicVisualTuningProvider>
    </MusicShellPlaybackProvider>
  );
}
