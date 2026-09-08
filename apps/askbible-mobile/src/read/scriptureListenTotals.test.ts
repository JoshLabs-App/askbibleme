import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

import {
  clearScriptureListenTotalsLocal,
  getScriptureListenTotalSec,
  noteScriptureListenProgress,
} from "./scripture-listen-totals";

/**
 * 「累计听读时长」是靠播放位置的**差值**累加的，不是墙钟。
 *
 * 它一度失去了唯一的调用方（删 expo-av 状态链时连带删掉），本机再也不累加，
 * 探索页那个数字只能靠服务端同步长——而且没有任何测试会失败。这个文件就是为了
 * 让那种情况下次会被测出来。
 */
describe("noteScriptureListenProgress", () => {
  beforeEach(async () => {
    await clearScriptureListenTotalsLocal();
  });

  it("accumulates the distance played, not wall-clock time", () => {
    noteScriptureListenProgress(10, true);
    noteScriptureListenProgress(11, true);
    noteScriptureListenProgress(12, true);
    expect(getScriptureListenTotalSec()).toBeCloseTo(2, 5);
  });

  it("counts nothing while paused", () => {
    noteScriptureListenProgress(10, true);
    noteScriptureListenProgress(11, false);
    noteScriptureListenProgress(20, false);
    expect(getScriptureListenTotalSec()).toBe(0);
  });

  /** 拖动进度条跳过去的那段没听过，不能算。 */
  it("caps a single step so scrubbing cannot inflate the total", () => {
    noteScriptureListenProgress(10, true);
    noteScriptureListenProgress(600, true);
    expect(getScriptureListenTotalSec()).toBeCloseTo(1.5, 5);
  });

  /** 换章后位置回到 0，不能记成负数或大跳。 */
  it("ignores a backwards jump", () => {
    noteScriptureListenProgress(100, true);
    noteScriptureListenProgress(0, true);
    noteScriptureListenProgress(1, true);
    expect(getScriptureListenTotalSec()).toBeCloseTo(1, 5);
  });
});
