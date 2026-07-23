import { describe, expect, it } from "vitest";
import { evaluateTrendSignal } from "./testnet-signal";

describe("evaluateTrendSignal", () => {
  it("enters when trend and RSI are inside the configured window", () => {
    let value = 100;
    const closes = Array.from({ length: 60 }, (_, index) => {
      value += index % 2 === 0 ? 0.6 : -0.4;
      return value;
    });
    const signal = evaluateTrendSignal(closes);
    expect(signal.price).toBeGreaterThan(signal.sma20);
    expect(signal.sma20).toBeGreaterThan(signal.sma50);
    expect(signal.rsi14).toBeGreaterThanOrEqual(50);
    expect(signal.rsi14).toBeLessThanOrEqual(68);
    expect(signal.shouldEnter).toBe(true);
  });

  it("enters only when price, moving averages, and RSI agree", () => {
    const closes = Array.from({ length: 60 }, (_, index) => 100 + index * 0.2);
    const signal = evaluateTrendSignal(closes);
    expect(signal.price).toBeGreaterThan(signal.sma20);
    expect(signal.sma20).toBeGreaterThan(signal.sma50);
    expect(signal.shouldEnter).toBe(false);
    expect(signal.rsi14).toBe(100);
  });

  it("holds when the longer trend is falling", () => {
    const closes = Array.from({ length: 60 }, (_, index) => 120 - index * 0.2);
    const signal = evaluateTrendSignal(closes);
    expect(signal.shouldEnter).toBe(false);
    expect(signal.sma20).toBeLessThan(signal.sma50);
  });

  it("rejects insufficient closed candles", () => {
    expect(() => evaluateTrendSignal([1, 2, 3])).toThrow(/50/);
  });
});
