/**
 * 由播放位置定位当前节 + 节内进度。
 * 与 iOS `VerseTimingLookup.swift` / 安卓 `VerseTimingLookup.kt` 对等三写。
 */
import type { CuvChapterVerseTiming } from "@/lib/bible/cuv-chapter-verse-timings";

/**
 * 时间轴按 start 升序，用二分找最后一个 start <= time 的节；
 * 落在两节之间的空隙（朗读停顿）算作前一节仍在朗读。
 */
export function activeVerseAt(
  time: number,
  timings: readonly CuvChapterVerseTiming[],
): number | null {
  if (!timings.length || !(time >= 0)) return null;
  const first = timings[0]!;
  if (time < first.start) return null;

  let lo = 0;
  let hi = timings.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timings[mid]!.start <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return null;
  // 超出整章最后一节的 end 之后不再高亮
  if (found === timings.length - 1 && time > timings[found]!.end) return null;
  return found;
}

/**
 * 当前节在 `timings` 里的下标 + 节内进度（0…1）。
 * 停顿间隙（time > end）算 1.0，即停在本节最后一句上，不会提前跳走。
 */
export function activeVerseProgressAt(
  time: number,
  timings: readonly CuvChapterVerseTiming[],
): { index: number; verse: number; progress: number } | null {
  const index = activeVerseAt(time, timings);
  if (index === null) return null;
  const t = timings[index]!;
  const span = t.end - t.start;
  const progress = span > 0 ? Math.min(Math.max((time - t.start) / span, 0), 1) : 0;
  return { index, verse: t.verse, progress };
}
