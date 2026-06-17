import AsyncStorage from "@react-native-async-storage/async-storage";

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

async function readCompletionSet(): Promise<Set<string>> {
  try {
    const raw =
      (await AsyncStorage.getItem(READ_CHAPTER_COMPLETION_KEY)) ??
      (await AsyncStorage.getItem(READ_CHAPTER_COMPLETION_KEY_LEGACY));
    if (raw != null) {
      await AsyncStorage.setItem(READ_CHAPTER_COMPLETION_KEY, raw);
      await AsyncStorage.removeItem(READ_CHAPTER_COMPLETION_KEY_LEGACY);
    }
    return new Set(parseRecord(raw).completed);
  } catch {
    return new Set();
  }
}

export async function readCompletedChapterKeySet(): Promise<Set<string>> {
  return readCompletionSet();
}

export async function readReadChapterCompletionRecord(): Promise<ReadChapterCompletionRecord> {
  const completed = [...(await readCompletionSet())].sort();
  return { version: 1, completed };
}

export async function replaceReadChapterCompletionRecord(
  record: ReadChapterCompletionRecord,
): Promise<void> {
  const completed = Array.isArray(record.completed)
    ? record.completed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
  await writeCompletionSet(new Set(completed));
}

async function writeCompletionSet(next: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      READ_CHAPTER_COMPLETION_KEY,
      JSON.stringify({ version: 1, completed: [...next] }),
    );
    await AsyncStorage.removeItem(READ_CHAPTER_COMPLETION_KEY_LEGACY);
    emit();
    const { notifyMemberReadingLocalChanged } = await import("../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("chapterCompletion");
  } catch {
    /* ignore persistence errors */
  }
}

export function subscribeReadChapterCompletion(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export async function isReadChapterCompleted(bookId: string, chapter: number): Promise<boolean> {
  const key = chapterKey(bookId, chapter);
  if (!key) return false;
  const done = await readCompletionSet();
  return done.has(key);
}

export async function markReadChapterCompleted(bookId: string, chapter: number): Promise<boolean> {
  const key = chapterKey(bookId, chapter);
  if (!key) return false;
  const done = await readCompletionSet();
  if (done.has(key)) return false;
  done.add(key);
  await writeCompletionSet(done);
  return true;
}

export async function readCompletedChapterCountsByBook(
  bookIds: string[],
): Promise<Record<string, number>> {
  const done = await readCompletionSet();
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
