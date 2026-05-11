import { HomeBottomNav } from "@/components/home/HomeBottomNav";
import { DockChromeCollapse, HomeDockChromeProvider } from "@/components/home/HomeDockChromeContext";
import { AppShellFixedChrome } from "@/components/app-shell/AppShellFixedChrome";
import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import {
  HomeAtmosphereVisualProvider,
  MusicShellAtmosphereOverrideProvider,
  MusicShellVisualProvider,
  MusicVisualTuningProvider,
} from "@/music-visual";

/**
 * 视口锁定的壳：主区单独滚动，底栏始终在屏幕底部（不随文档流被「顶下去」）。
 *
 * Android 顶缘亚像素缝：见 `globals.css` 中 `--app-viewport-bleed-top`；负 top 略加大并 `transform-gpu` 促合成层。
 * 自然首页壳层深色见 `AppShellFixedChrome`（随 pathname 更新，避免软导航残留浅色底）。
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <MusicShellPlaybackProvider>
      <MusicVisualTuningProvider>
        <HomeAtmosphereVisualProvider>
          <MusicShellAtmosphereOverrideProvider>
            <AppShellFixedChrome>
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
            </AppShellFixedChrome>
          </MusicShellAtmosphereOverrideProvider>
        </HomeAtmosphereVisualProvider>
      </MusicVisualTuningProvider>
    </MusicShellPlaybackProvider>
  );
}
