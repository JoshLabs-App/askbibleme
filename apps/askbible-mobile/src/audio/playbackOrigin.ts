/**
 * 「这条播放命令是谁发的」——只给原生账本看的标签。
 *
 * 账本上，用户点播、章末续播、JS 兜底重播三条路走到最后都是同一个
 * `play scripture …`，长得完全一样。2026-09-08 追一条「iOS 上 JS 抢在原生前面播了
 * 下一章」花了两小时，全花在反复加临时日志、重启、复现上。
 *
 * 这个值**不参与任何判断**，只被写进日志。谁也不该 import 它来改行为。
 */
let current: string | null = null;

/** 在这段调用里，把播放命令标成这个来源。同步/异步都覆盖得到。 */
export async function withPlaybackOrigin<T>(origin: string, run: () => Promise<T>): Promise<T> {
  const previous = current;
  current = origin;
  try {
    return await run();
  } finally {
    current = previous;
  }
}

export function currentPlaybackOrigin(): string | null {
  return current;
}
