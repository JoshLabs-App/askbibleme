import { HomeBottomNav } from "@/components/home/HomeBottomNav";
import { DockChromeCollapse, HomeDockChromeProvider } from "@/components/home/HomeDockChromeContext";
import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import {
  HomeAtmosphereVisualProvider,
  MusicShellVisualProvider,
  MusicVisualTuningProvider,
} from "@/music-visual";

/**
 * 视口锁定的壳：主区单独滚动，底栏始终在屏幕底部（不随文档流被「顶下去」）。
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <MusicShellPlaybackProvider>
      <MusicVisualTuningProvider>
        <HomeAtmosphereVisualProvider>
          <div className="fixed inset-0 z-[1] flex h-dvh min-h-0 max-h-dvh w-full flex-col overflow-hidden bg-canvas">
            <HomeDockChromeProvider>
              <MusicShellVisualProvider>
                <div className="relative z-0 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                  {children}
                </div>
                <DockChromeCollapse>
                  <HomeBottomNav />
                </DockChromeCollapse>
              </MusicShellVisualProvider>
            </HomeDockChromeProvider>
          </div>
        </HomeAtmosphereVisualProvider>
      </MusicVisualTuningProvider>
    </MusicShellPlaybackProvider>
  );
}
