export type SignalMetrics = {
  price: number;
  sma20: number;
  sma50: number;
  rsi14: number;
  shouldEnter: boolean;
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function rsi(values: number[], period = 14) {
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const window = changes.slice(-period);
  if (window.length < period) return 50;
  const gain = average(window.map((value) => Math.max(0, value)));
  const loss = average(window.map((value) => Math.max(0, -value)));
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export function evaluateTrendSignal(closes: number[]): SignalMetrics {
  if (closes.length < 50) {
    throw new Error("至少需要 50 根已收盘的 1 小时 K 线");
  }
  const price = closes.at(-1) ?? 0;
  const sma20 = average(closes.slice(-20));
  const sma50 = average(closes.slice(-50));
  const rsi14 = rsi(closes, 14);
  return {
    price: round(price),
    sma20: round(sma20),
    sma50: round(sma50),
    rsi14: round(rsi14),
    shouldEnter:
      price > sma20 && sma20 > sma50 && rsi14 >= 50 && rsi14 <= 68,
  };
}
