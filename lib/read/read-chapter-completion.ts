const READ_CHAPTER_COMPLETION_KEY = "askbible-read-chapter-completion-v1";
const READ_CHAPTER_COMPLETION_KEY_LEGACY = "selah-read-chapter-completion-v1";

export type ReadChapterCompletionRecord = {
  version: 1;
  completed: string[];
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  });
}

function chapterKey(bookId: string, chapter: number): string | null {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return null;
  return `${id}:${chapter}`;
}

function parseRecord(raw: string | null): ReadChapterCompletionRecord {
  if (!raw?.trim()) return { version: 1, completed: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<ReadChapterCompletionRecord>;
    const completed = Array.isArray(parsed?.completed)
      ? parsed.completed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];
    return { version: 1, completed };
  } catch {
    return { version: 1, completed: [] };
  }
}

function readCompletionSet(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw =
      localStorage.getItem(READ_CHAPTER_COMPLETION_KEY) ??
      localStorage.getItem(READ_CHAPTER_COMPLETION_KEY_LEGACY);
    if (raw != null) {
      localStorage.setItem(READ_CHAPTER_COMPLETION_KEY, raw);
      localStorage.removeItem(READ_CHAPTER_COMPLETION_KEY_LEGACY);
    }
    return new Set(parseRecord(raw).completed);
  } catch {
    return new Set();
  }
}

function writeCompletionSet(next: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      READ_CHAPTER_COMPLETION_KEY,
      JSON.stringify({ version: 1, completed: [...next] }),
    );
    localStorage.removeItem(READ_CHAPTER_COMPLETION_KEY_LEGACY);
    emit();
  } catch {
    /* ignore persistence errors */
  }
}

export function subscribeReadChapterCompletion(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function isReadChapterCompleted(bookId: string, chapter: number): boolean {
  const key = chapterKey(bookId, chapter);
  if (!key) return false;
  return readCompletionSet().has(key);
}

export function markReadChapterCompleted(bookId: string, chapter: number): boolean {
  const key = chapterKey(bookId, chapter);
  if (!key) return false;
  const done = readCompletionSet();
  if (done.has(key)) return false;
  done.add(key);
  writeCompletionSet(done);
  return true;
}

export function readCompletedChapterKeySet(): Set<string> {
  return readCompletionSet();
}

export function readReadChapterCompletionRecord(): ReadChapterCompletionRecord {
  return { version: 1, completed: [...readCompletionSet()].sort() };
}

export function replaceReadChapterCompletionRecord(record: ReadChapterCompletionRecord): void {
  const completed = Array.isArray(record.completed)
    ? record.completed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
  writeCompletionSet(new Set(completed));
}

export function readCompletedChapterCountsByBook(bookIds: string[]): Record<string, number> {
  const done = readCompletionSet();
  const wanted = new Set(bookIds.map((id) => String(id || "").trim().toUpperCase()).filter(Boolean));
  const out: Record<string, number> = {};
  for (const key of done) {
    const sep = key.indexOf(":");
    if (sep <= 0) continue;
    const id = key.slice(0, sep);
    if (!wanted.has(id)) continue;
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}
