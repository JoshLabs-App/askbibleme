import { useState } from "react";
import type { AudioStateSnapshot } from "../bridge/contracts";
import { platformBridge } from "../bridge/platform-adapter";

export interface HomePageProps {
  audioState: AudioStateSnapshot | null;
  lastRead: { bookId: string; chapter: number; translationId: string };
  onOpenReader: (bookId: string, chapter: number) => void;
  onNavigate: (path: string) => void;
}

const DAILY_VERSE = {
  ref: "约翰福音 1:4-5",
  bookId: "JHN",
  chapter: 1,
  text: "生命在他里头，这生命就是人的光。光照在黑暗里，黑暗却不接受光。",
};

export default function HomePage({
  audioState,
  lastRead,
  onOpenReader,
  onNavigate,
}: HomePageProps) {
  const [statusNote, setStatusNote] = useState<string>("");
  const musicPlaying = Boolean(audioState?.music.isPlaying);

  async function toggleQuietMusic() {
    await platformBridge.call("shell.haptic", { style: "light" });
    await platformBridge.call("audio.intent", {
      stream: "music",
      action: musicPlaying ? "pause" : "play",
      payload: {
        albumId: "quiet",
        title: "安静 · 晨光初照",
      },
      origin: "kernel-home-music",
    });
  }

  async function playDailyVerse() {
    await platformBridge.call("shell.haptic", { style: "light" });
    await platformBridge.call("audio.intent", {
      stream: "verse",
      action: "play",
      payload: {
        title: DAILY_VERSE.ref,
        bookId: DAILY_VERSE.bookId,
        chapter: DAILY_VERSE.chapter,
      },
      origin: "kernel-home-verse",
    });
  }

  async function shareDailyVerse() {
    const res = await platformBridge.call("sys.shareImage", {
      text: `${DAILY_VERSE.text}\n—— ${DAILY_VERSE.ref}（AskBible.me）`,
    });
    setStatusNote(res.method === "clipboard" ? "已复制到剪贴板" : "已唤起分享");
  }

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">安静进入圣经</h1>
        <p className="ab-page-subtitle">放下纷扰，从今天的一段经文开始。</p>
      </div>

      <section className="ab-card-agarwood">
        <div className="ab-row-between" style={{ marginBottom: 10 }}>
          <span className="ab-pill">今日经文</span>
          <span style={{ fontSize: 12, opacity: 0.78 }}>{DAILY_VERSE.ref}</span>
        </div>
        <p className="ab-serif-quote" style={{ marginBottom: 16 }}>
          {DAILY_VERSE.text}
        </p>
        <div className="ab-row">
          <button
            type="button"
            className="ab-btn ab-btn-primary"
            onClick={() => onOpenReader(DAILY_VERSE.bookId, DAILY_VERSE.chapter)}
          >
            进入该章
          </button>
          <button type="button" className="ab-btn" onClick={playDailyVerse}>
            聆听金句
          </button>
          <button type="button" className="ab-btn" onClick={shareDailyVerse}>
            分享
          </button>
        </div>
        {statusNote && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{statusNote}</div>
        )}
      </section>

      <section className="ab-card">
        <div className="ab-row-between">
          <div>
            <h2 className="ab-card-title">安静背景乐</h2>
            <div className="ab-card-meta">默认仅播「安静」专辑，与金句朗读可温柔叠放</div>
          </div>
          <button
            type="button"
            className={musicPlaying ? "ab-btn ab-btn-ok" : "ab-btn ab-btn-primary"}
            onClick={toggleQuietMusic}
          >
            {musicPlaying ? "暂停安静乐" : "播放安静乐"}
          </button>
        </div>
      </section>

      <section className="ab-grid-2">
        <button
          type="button"
          className="ab-card-elevated"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onOpenReader(lastRead.bookId, lastRead.chapter)}
        >
          <div className="ab-card-meta">继续阅读</div>
          <div className="ab-card-title" style={{ marginTop: 4 }}>
            {lastRead.bookId} 第 {lastRead.chapter} 章
          </div>
          <div className="ab-muted">译本：{lastRead.translationId}</div>
        </button>

        <button
          type="button"
          className="ab-card-elevated"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onNavigate("/plan")}
        >
          <div className="ab-card-meta">今日灵修</div>
          <div className="ab-card-title" style={{ marginTop: 4 }}>读经计划</div>
          <div className="ab-muted">静读约翰福音 · 清晨诗篇</div>
        </button>

        <button
          type="button"
          className="ab-card-elevated"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onNavigate("/panorama")}
        >
          <div className="ab-card-meta">宏观脉络</div>
          <div className="ab-card-title" style={{ marginTop: 4 }}>圣经全景</div>
          <div className="ab-muted">六幕救赎历史导览</div>
        </button>

        <button
          type="button"
          className="ab-card-elevated"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onNavigate("/ex-libris")}
        >
          <div className="ab-card-meta">阅读足迹</div>
          <div className="ab-card-title" style={{ marginTop: 4 }}>藏书票</div>
          <div className="ab-muted">安静记录你的读经印记</div>
        </button>
      </section>
    </div>
  );
}
