/**
 * 跟读高亮的「句」切分。与 iOS `VerseSentences.swift` / 安卓 `VerseSentences.kt` 对等三写。
 *
 * 时间轴（verse-timings）只精确到**节**，一节可能长达三四行，整节铺底看起来就是
 * 「按行高亮」，和耳朵听到的位置对不上（Josh 2026-09-19）。
 * 这里把一节再切成句，节内按字数比例插值定位当前句 —— 每到一节边界都会重新对齐，
 * 误差被限制在一节之内，长节的观感提升最明显。
 */

/** 句末标点。冒号、逗号、顿号不算断句 —— 中文经文里逗号极多，按逗号切会碎成一片。 */
const TERMINATORS = new Set(["。", "！", "？", "；", "!", "?", ";"]);
/** 紧跟在句末标点后面、应当并进同一句的收尾符号 */
const TRAILING = new Set(["”", "’", "」", "』", "）", ")", "》", '"', "'"]);
/** 短于这个长度的尾巴并进上一句，避免出现只高亮一个引号的碎片 */
const MIN_LENGTH = 2;

/** 一句在节正文里的字符区间，前闭后开 */
export type VerseSentenceRange = { start: number; end: number };

export function splitVerseSentences(text: string): VerseSentenceRange[] {
  const chars = Array.from(text);
  if (!chars.length) return [];
  const out: VerseSentenceRange[] = [];
  let start = 0;
  let i = 0;
  while (i < chars.length) {
    if (!TERMINATORS.has(chars[i]!)) {
      i += 1;
      continue;
    }
    let end = i + 1;
    // 连续的句末标点（「？！」）和收尾引号都并进本句
    while (end < chars.length && (TERMINATORS.has(chars[end]!) || TRAILING.has(chars[end]!))) {
      end += 1;
    }
    out.push({ start, end });
    start = end;
    i = end;
  }
  if (start < chars.length) out.push({ start, end: chars.length });
  if (!out.length) return [{ start: 0, end: chars.length }];

  // 合并过短的碎片到上一句
  const merged: VerseSentenceRange[] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r.end - r.start < MIN_LENGTH) last.end = r.end;
    else merged.push({ ...r });
  }
  return merged;
}

/** 每句的权重：非空白字符数，朗读快慢在一节之内基本均匀 */
export function verseSentenceWeights(text: string, ranges: VerseSentenceRange[]): number[] {
  const chars = Array.from(text);
  return ranges.map((r) => {
    let n = 0;
    for (let i = r.start; i < r.end; i += 1) if (!/\s/.test(chars[i] ?? "")) n += 1;
    return Math.max(1, n);
  });
}

/**
 * 按节内进度（0…1）定位当前句。
 * `ranges` / `weights` 由调用方预先算好缓存 —— 播放秒数每 120ms 推一次，
 * 这个函数会被高频调用，不能每次重切句。
 */
export function verseSentenceIndexAt(
  progress: number,
  weights: number[],
): number {
  if (weights.length <= 1) return 0;
  const total = weights.reduce((a, b) => a + b, 0);
  const target = total * Math.min(Math.max(progress, 0), 1);
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i]!;
    if (acc > target) return i;
  }
  return weights.length - 1;
}
