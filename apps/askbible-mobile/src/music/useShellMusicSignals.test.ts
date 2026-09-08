import { describe, expect, it } from "vitest";
import { isShellMusicOn } from "./useShellMusicSignals";

/**
 * 「音乐在不在响」只由音乐这一条流回答。
 *
 * 旧版本要把 wantPlaying、原生心跳、共用 `playing` 三者取或，再额外判断 playbackMode
 * 免得读经把音乐标黄——那些补偿的存在本身就说明没有一个来源可信。原生按流上报后不需要了。
 */
describe("isShellMusicOn", () => {
  it("follows the music stream alone", () => {
    expect(isShellMusicOn({ wantPlaying: false, nativePlaying: false })).toBe(false);
    expect(isShellMusicOn({ wantPlaying: true, nativePlaying: false })).toBe(true);
    expect(isShellMusicOn({ wantPlaying: false, nativePlaying: true })).toBe(true);
  });

  /** 刚点下、还在缓冲：wantPlaying 已为真，图标该亮。 */
  it("lights up while the tap is still buffering", () => {
    expect(isShellMusicOn({ wantPlaying: true, nativePlaying: false })).toBe(true);
  });
});
