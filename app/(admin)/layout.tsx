import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import {
  HomeAtmosphereVisualProvider,
  MusicShellVisualProvider,
  MusicVisualTuningProvider,
} from "@/music-visual";

/**
 * 后台与前台 `(app-shell)` 分离：不做 fixed 视口 + 双纵向滚动，避免 Studio 三栏在后台嵌入时高度链断裂。
 * 仍挂载播放与视觉 Provider，供 `/admin/visual` 等使用。
 */
export default function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <MusicShellPlaybackProvider>
      <MusicVisualTuningProvider>
        <HomeAtmosphereVisualProvider>
          <MusicShellVisualProvider>
            <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-adminBg supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]">
              {children}
            </div>
          </MusicShellVisualProvider>
        </HomeAtmosphereVisualProvider>
      </MusicVisualTuningProvider>
    </MusicShellPlaybackProvider>
  );
}
