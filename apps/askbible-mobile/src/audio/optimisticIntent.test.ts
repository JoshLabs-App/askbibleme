import { beforeEach, describe, expect, it } from "vitest";
import {
  applyNativePlaybackState,
  applyOptimisticIntent,
  getPlaybackSnapshot,
  getShellPlaybackMode,
} from "./playbackState";

/**
 * 从「JS 发出播放命令」到「原生回执到达」中间有一个来回。这段时间里
 * 「主轨是不是读经」必须已经答得上话——上层拿它判断刚点的那一章有没有起播成功。
 *
 * 只落 wantPlaying 是不够的：那个判断看的是 scripture 这条流有没有音轨。
 * 2026-09-08 iOS 实测过后果：点播创世记 1，日志随即 `playScriptureChapter failed GEN 1`，
 * 然后自己跳去播了创世记 2。
 */
describe("applyOptimisticIntent", () => {
  beforeEach(() => applyNativePlaybackState({}));

  it("answers scripture mode before native has reported back", () => {
    expect(getShellPlaybackMode()).toBe("music");
    applyOptimisticIntent("scripture", {
      wantPlaying: true,
      userPaused: false,
      uri: "file:///cache/esv/GEN-1.mp3",
    });
    expect(getShellPlaybackMode()).toBe("scripture");
  });

  it("lets the native report overwrite what it guessed", () => {
    applyOptimisticIntent("scripture", { wantPlaying: true, uri: "file:///guessed.mp3" });
    applyNativePlaybackState({
      scripture: { uri: "file:///actual.mp3", playing: true, wantPlaying: true },
    });
    expect(getPlaybackSnapshot().scripture.uri).toBe("file:///actual.mp3");
  });

  /** 原生说这一路已经停了，乐观值不能把它按回去。 */
  it("does not resurrect a stream native has cleared", () => {
    applyOptimisticIntent("scripture", { wantPlaying: true, uri: "file:///a.mp3" });
    applyNativePlaybackState({ scripture: { uri: null, playing: false } });
    expect(getShellPlaybackMode()).toBe("music");
  });

  it("ignores a patch that changes nothing", () => {
    applyOptimisticIntent("music", { wantPlaying: false });
    expect(getPlaybackSnapshot().music.wantPlaying).toBe(false);
  });
});
