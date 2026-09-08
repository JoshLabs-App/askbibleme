import { describe, expect, it } from "vitest";
import { isStreamLit, type PlaybackStreamState } from "./playbackState";

function stream(overrides: Partial<PlaybackStreamState> = {}): PlaybackStreamState {
  return {
    playing: false,
    wantPlaying: false,
    userPaused: false,
    uri: null,
    positionSec: 0,
    durationSec: 0,
    queueLength: 0,
    title: "",
    artist: "",
    album: "",
    ...overrides,
  };
}

/**
 * 黄标该不该亮。
 *
 * 关键在最后一条：原生的 `wantPlaying` 在用户暂停后**仍然是 true**（音轨还挂着，
 * 按播放键要能原样接上）。早期界面直接拿它点灯，于是出现 Josh 报的
 * 「展示是黄色选中，但是没有声」——关掉音乐，首页音符还黄着（2026-09-08 真机截图）。
 */
describe("isStreamLit", () => {
  it("is lit while actually sounding", () => {
    expect(isStreamLit(stream({ playing: true }))).toBe(true);
  });

  it("is lit during the buffering moment right after the tap", () => {
    expect(isStreamLit(stream({ wantPlaying: true }))).toBe(true);
  });

  it("is dark when nothing was ever started", () => {
    expect(isStreamLit(stream())).toBe(false);
  });

  it("is dark after the user paused this stream, track still loaded", () => {
    expect(isStreamLit(stream({ wantPlaying: true, userPaused: true, uri: "file:///a.mp3" }))).toBe(
      false,
    );
  });
});
