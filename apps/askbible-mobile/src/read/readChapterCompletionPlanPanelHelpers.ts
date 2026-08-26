import type { ReadingPlanRange } from "./reading-plan/types";

export type ChapterRef = {
  bookId: string;
  chapter: number;
};

export function buildChapterQueue(readings: ReadingPlanRange[]): ChapterRef[] {
  const out: ChapterRef[] = [];
  for (const r of readings) {
    for (let ch = r.startChapter; ch <= r.endChapter; ch += 1) {
      out.push({ bookId: r.bookId, chapter: ch });
    }
  }
  return out;
}

/**
 * 本章完成面板：把「创 1–5 章」拆成逐章行，避免点范围只跳 startChapter 出错。
 * 同章经节区间仍保留为一行。
 */
export function expandReadingsToChapterRows(readings: ReadingPlanRange[]): ReadingPlanRange[] {
  const out: ReadingPlanRange[] = [];
  for (const r of readings) {
    const start = Math.max(1, Math.trunc(r.startChapter));
    const end = Math.max(start, Math.trunc(r.endChapter));
    if (start === end) {
      out.push(r);
      continue;
    }
    for (let ch = start; ch <= end; ch += 1) {
      out.push({
        bookId: r.bookId,
        startChapter: ch,
        endChapter: ch,
        label: r.label,
        planChapterTotal: 1,
      });
    }
  }
  return out;
}

export function sameChapter(a: ChapterRef, b: ChapterRef): boolean {
  return a.bookId === b.bookId && a.chapter === b.chapter;
}

export function formatDisplayNickname(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** 探索页问候等：避免把整段邮箱当昵称撑破排版。 */
export function formatGreetingDisplayName(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  if (trimmed.includes("@")) {
    const at = trimmed.indexOf("@");
    const local = trimmed.slice(0, at).trim();
    const domain = trimmed.slice(at + 1).toLowerCase();
    // Apple 隐藏邮箱 / 过长本地段：不当昵称展示。
    if (!local || domain.includes("privaterelay.appleid.com") || local.length > 18) {
      return "";
    }
    return formatDisplayNickname(local);
  }

  // 长度截断交给 UI（单行 ellipsis），这里只做邮箱/隐藏邮箱归一。
  return formatDisplayNickname(trimmed);
}
