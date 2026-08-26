import type { ReadLastPosition } from "@/lib/read/read-last-position";

const KEY = "askbible-read-recent-chapters-v1";
const MAX_RECENT = 3;

export type ReadRecentChapter = ReadLastPosition & {
  at: number;
};

const listeners = new Set<() => void>();
let cached: ReadRecentChapter[] | null = null;
const EMPTY_RECENT: readonly ReadRecentChapter[] = [];

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

function chapterKey(item: Pick<ReadRecentChapter, "bookId" | "chapter">): string {
  return `${item.bookId}:${item.chapter}`;
}

function parseList(raw: string | null): ReadRecentChapter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ReadRecentChapter[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<ReadRecentChapter>;
      const bookId = typeof row.bookId === "string" ? row.bookId.trim() : "";
      const chapter = Number(row.chapter);
      const bookName = typeof row.bookName === "string" ? row.bookName.trim() : "";
      const at = Number(row.at);
      if (!bookId || !Number.isInteger(chapter) || chapter < 1) continue;
      out.push({
        bookId,
        chapter,
        bookName: bookName || bookId,
        at: Number.isFinite(at) && at > 0 ? at : Date.now(),
      });
      if (out.length >= MAX_RECENT) break;
    }
    return out;
  } catch {
    return [];
  }
}

function hydrate(): void {
  if (cached != null || typeof window === "undefined") return;
  try {
    cached = parseList(localStorage.getItem(KEY));
  } catch {
    cached = [];
  }
}

function persist(list: ReadRecentChapter[]): void {
  cached = list;
  emit();
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function subscribeReadRecentChapters(onStore: () => void): () => void {
  hydrate();
  listeners.add(onStore);
  return () => {
    listeners.delete(onStore);
  };
}

export function getReadRecentChapters(): readonly ReadRecentChapter[] {
  hydrate();
  return cached ?? EMPTY_RECENT;
}

/** 打开某章时写入：同章去重置顶，最多保留 3 条。 */
export function pushReadRecentChapter(pos: ReadLastPosition): void {
  hydrate();
  const nextItem: ReadRecentChapter = {
    bookId: pos.bookId,
    chapter: pos.chapter,
    bookName: pos.bookName,
    at: Date.now(),
  };
  const prev = cached ?? [];
  const key = chapterKey(nextItem);
  const next = [nextItem, ...prev.filter((item) => chapterKey(item) !== key)].slice(0, MAX_RECENT);
  persist(next);
}
