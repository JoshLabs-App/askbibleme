import AsyncStorage from "@react-native-async-storage/async-storage";

export const READ_VERSE_TEXT_HIGHLIGHTS_STORAGE_KEY = "askbible-read-verse-text-highlights-v1";
export const DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR = "#FFB103";
export const VERSE_TEXT_HIGHLIGHT_PALETTE = [
  DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR,
  "#7BC96F",
  "#0FBCDB",
  "#F48FB1",
] as const;

const HIGHLIGHT_COLOR_SET = new Set<string>(VERSE_TEXT_HIGHLIGHT_PALETTE);

type VerseTextHighlightRef = {
  translationId: string;
  bookId: string;
  chapter: number;
  verse: number;
};

type VerseCharHighlightMap = Map<number, string>;
type VerseTextHighlightEntry = { i: number; c: string };
export type VerseTextHighlightStore = Record<string, VerseTextHighlightEntry[]>;

function highlightKey(ref: VerseTextHighlightRef): string {
  return `${ref.translationId}:${ref.bookId}:${ref.chapter}:${ref.verse}`;
}

function normalizeHighlightColor(input: unknown): string {
  const value = typeof input === "string" ? input.trim() : "";
  if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value)) {
    return DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR;
  }
  const normalized = value.toUpperCase();
  return HIGHLIGHT_COLOR_SET.has(normalized) ? normalized : DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR;
}

function parseStore(raw: string | null): VerseTextHighlightStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: VerseTextHighlightStore = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      const byIndex = new Map<number, string>();
      for (const item of value) {
        if (typeof item === "number") {
          if (Number.isInteger(item) && item >= 0) {
            byIndex.set(item, DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR);
          }
          continue;
        }
        if (!item || typeof item !== "object") continue;
        const idx = Number((item as { i?: unknown }).i);
        if (!Number.isInteger(idx) || idx < 0) continue;
        byIndex.set(idx, normalizeHighlightColor((item as { c?: unknown }).c));
      }
      if (byIndex.size) {
        out[key] = Array.from(byIndex.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([i, c]) => ({ i, c }));
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function readStore(): Promise<VerseTextHighlightStore> {
  try {
    const raw = await AsyncStorage.getItem(READ_VERSE_TEXT_HIGHLIGHTS_STORAGE_KEY);
    return parseStore(raw);
  } catch {
    return {};
  }
}

async function writeStore(store: VerseTextHighlightStore): Promise<void> {
  await AsyncStorage.setItem(READ_VERSE_TEXT_HIGHLIGHTS_STORAGE_KEY, JSON.stringify(store));
}

export async function readVerseTextHighlightStore(): Promise<VerseTextHighlightStore> {
  return readStore();
}

export async function replaceVerseTextHighlightStore(store: VerseTextHighlightStore): Promise<void> {
  await writeStore(store);
}

export async function readChapterVerseTextHighlights(ref: {
  translationId: string;
  bookId: string;
  chapter: number;
}): Promise<Map<number, VerseCharHighlightMap>> {
  const store = await readStore();
  const out = new Map<number, VerseCharHighlightMap>();
  const prefix = `${ref.translationId}:${ref.bookId}:${ref.chapter}:`;
  for (const [key, entries] of Object.entries(store)) {
    if (!key.startsWith(prefix)) continue;
    const verseRaw = key.slice(prefix.length);
    const verse = Number(verseRaw);
    if (!Number.isInteger(verse) || verse <= 0) continue;
    const byIndex = new Map<number, string>();
    for (const row of entries) {
      if (!Number.isInteger(row.i) || row.i < 0) continue;
      byIndex.set(row.i, normalizeHighlightColor(row.c));
    }
    if (byIndex.size) out.set(verse, byIndex);
  }
  return out;
}

export async function writeVerseTextHighlightIndices(
  ref: VerseTextHighlightRef,
  highlights: Iterable<[number, string]>,
): Promise<void> {
  const store = await readStore();
  const byIndex = new Map<number, string>();
  for (const [idx, color] of highlights) {
    if (!Number.isInteger(idx) || idx < 0) continue;
    byIndex.set(idx, normalizeHighlightColor(color));
  }
  const normalized = Array.from(byIndex.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([i, c]) => ({ i, c }));
  const key = highlightKey(ref);
  if (!normalized.length) delete store[key];
  else store[key] = normalized;
  await writeStore(store);
  try {
    const { notifyMemberReadingLocalChanged } = await import("../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("highlights");
  } catch {
    /* ignore */
  }
}
