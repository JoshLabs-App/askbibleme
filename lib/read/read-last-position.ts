import { pushReadRecentChapter } from "@/lib/read/read-recent-chapters-web";

const READ_LAST_POSITION_KEY = "askbible-read-last-v1";

export type ReadLastPosition = {
  bookId: string;
  chapter: number;
  bookName: string;
};

export function readLastReadPosition(): ReadLastPosition | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(READ_LAST_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReadLastPosition;
    if (!parsed?.bookId || !Number.isInteger(parsed.chapter) || parsed.chapter < 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastReadPosition(pos: ReadLastPosition): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(READ_LAST_POSITION_KEY, JSON.stringify(pos));
    pushReadRecentChapter(pos);
  } catch {
    /* ignore */
  }
}
