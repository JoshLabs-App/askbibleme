import type { ReactNode } from "react";
import type { AudioStateSnapshot, ShellTabId } from "../bridge/contracts";

export interface ShellLayoutProps {
  activeTab: ShellTabId;
  isNative: boolean;
  audioState: AudioStateSnapshot | null;
  onSelectTab: (tab: ShellTabId) => void;
  onNavigate: (path: string) => void;
  onToggleAudioPause: (stream: "music" | "scripture" | "verse") => void;
  children: ReactNode;
}

const TABS: Array<{ id: ShellTabId; label: string; glyph: string }> = [
  { id: "home", label: "首页", glyph: "⌂" },
  { id: "panorama", label: "全景", glyph: "☷" },
  { id: "plan", label: "今日", glyph: "◷" },
  { id: "read", label: "圣经", glyph: "☰" },
  { id: "explore", label: "书房", glyph: "✦" },
];

export function ShellLayout({
  activeTab,
  isNative,
  audioState,
  onSelectTab,
  onNavigate,
  onToggleAudioPause,
  children,
}: ShellLayoutProps) {
  const activeStream = audioState?.audibleStreams[0];
  const activeAudio = activeStream ? audioState?.[activeStream] : null;

  return (
    <div className="ab-shell">
      <header className="ab-header">
        <div className="ab-header-inner">
          <button
            type="button"
            className="ab-btn-ghost ab-brand"
            onClick={() => onSelectTab("home")}
          >
            <span className="ab-brand-dot" aria-hidden="true" />
            <span>AskBible.me</span>
          </button>

          <div className="ab-row">
            <button
              type="button"
              className="ab-btn"
              onClick={() => onNavigate("/figures")}
            >
              人物馆
            </button>
            <button
              type="button"
              className="ab-btn"
              onClick={() => onNavigate("/settings")}
            >
              设置
            </button>
          </div>
        </div>
      </header>

      <main className={isNative ? "ab-main ab-main--native" : "ab-main"}>
        {children}
      </main>

      {!isNative && activeStream && activeAudio?.isPlaying && (
        <div className="ab-audio-dock" role="region" aria-label="正在播放">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{activeAudio.title}</div>
            <div style={{ fontSize: 11, opacity: 0.78 }}>
              {activeStream === "music" ? "安静背景乐" : activeStream === "scripture" ? "圣经朗读" : "每日金句"}
            </div>
          </div>
          <button
            type="button"
            className="ab-btn ab-btn-primary"
            onClick={() => onToggleAudioPause(activeStream)}
          >
            暂停
          </button>
        </div>
      )}

      {!isNative && (
        <nav className="ab-tabbar" aria-label="主导航">
          <div className="ab-tabbar-inner">
            {TABS.map((t) => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={active ? "ab-tab-item ab-tab-item--active" : "ab-tab-item"}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onSelectTab(t.id)}
                >
                  <span aria-hidden="true" style={{ fontSize: 15 }}>{t.glyph}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
