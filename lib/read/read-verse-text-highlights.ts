export const READ_VERSE_TEXT_HIGHLIGHTS_STORAGE_KEY = "askbible-read-verse-text-highlights-v1";
export const DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR = "#FFB103";
/**
 * 划重点四色板（2026-09-19 改版，见 `docs/design-color-system.md`）。
 * 存的是「颜料」hex，渲染时一律按 `VERSE_TEXT_HIGHLIGHT_ALPHA` 叠透明度铺在羊皮底上，
 * 让纸的暖底透上来 —— 不要直接把这里的 hex 当不透明背景色用。
 */
export const VERSE_TEXT_HIGHLIGHT_PALETTE = [
  DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR, // 灯油黄（品牌色，同时是双击收藏标记 / 跟读高亮底色）
  "#A3B565", // 橄榄绿
  "#4E86A0", // 青石蓝
  "#C0625F", // 石榴红
] as const;

/** 旧色板 → 新色板。老用户存量数据里是旧 hex，读取时就地迁移，不迁就会被打回默认黄。 */
export const LEGACY_VERSE_TEXT_HIGHLIGHT_COLOR_MAP: Record<string, string> = {
  "#7BC96F": "#A3B565",
  "#0FBCDB": "#4E86A0",
  "#F48FB1": "#C0625F",
};

/** 每支笔的铺色透明度：合成后亮度接近，谁也不比谁响。[浅色, 深色] */
const VERSE_TEXT_HIGHLIGHT_ALPHA: Record<string, readonly [number, number]> = {
  "#FFB103": [0.45, 0.28],
  "#A3B565": [0.5, 0.28],
  "#4E86A0": [0.46, 0.32],
  "#C0625F": [0.42, 0.3],
};

const HIGHLIGHT_COLOR_SET = new Set<string>(VERSE_TEXT_HIGHLIGHT_PALETTE);

/** 颜料 hex → 实际铺的 rgba()。渲染端一律走这里，不要直接用调色板 hex。 */
export function verseTextHighlightFill(color: string, dark = false): string {
  const hex = normalizeVerseTextHighlightColor(color);
  const [light, night] = VERSE_TEXT_HIGHLIGHT_ALPHA[hex] ?? [0.45, 0.28];
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${dark ? night : light})`;
}

/**
 * 渲染用的内联样式：只给「颜料 RGB + 两档 alpha」，实际合成交给 CSS
 * （`.read-chapter-verse-text-highlight` 用 `--vh-a`，`.dark` 那条用 `--vh-a-dark`），
 * 这样深浅模式切换不需要 JS 参与。
 */
export function verseTextHighlightStyle(color: string): Record<string, string> {
  const hex = normalizeVerseTextHighlightColor(color);
  const [light, night] = VERSE_TEXT_HIGHLIGHT_ALPHA[hex] ?? [0.45, 0.28];
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return { "--vh-rgb": `${r} ${g} ${b}`, "--vh-a": `${light}`, "--vh-a-dark": `${night}` };
}

/** 统一入口：不认识的值回默认黄，旧色板值就地迁移到新色板 */
export function normalizeVerseTextHighlightColor(input: unknown): string {
  const value = typeof input === "string" ? input.trim().toUpperCase() : "";
  if (HIGHLIGHT_COLOR_SET.has(value)) return value;
  const migrated = LEGACY_VERSE_TEXT_HIGHLIGHT_COLOR_MAP[value];
  return migrated ?? DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR;
}

type VerseTextHighlightRef = {
  translationId: string;
  bookId: string;
  chapter: number;
  verse: number;
};

type VerseCharHighlightMap = Map<number, string>;
type VerseTextHighlightEntry = { i: number; c: string };
type VerseTextHighlightStore = Record<string, VerseTextHighlightEntry[]>;

function highlightKey(ref: VerseTextHighlightRef): string {
  return `${ref.translationId}:${ref.bookId}:${ref.chapter}:${ref.verse}`;
}

function normalizeHighlightColor(input: unknown): string {
  return normalizeVerseTextHighlightColor(input);
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

function readStore(): VerseTextHighlightStore {
  if (typeof window === "undefined") return {};
  try {
    return parseStore(localStorage.getItem(READ_VERSE_TEXT_HIGHLIGHTS_STORAGE_KEY));
  } catch {
    return {};
  }
}

function writeStore(store: VerseTextHighlightStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_VERSE_TEXT_HIGHLIGHTS_STORAGE_KEY, JSON.stringify(store));
}

export function readVerseTextHighlightStore(): VerseTextHighlightStore {
  return readStore();
}

export function replaceVerseTextHighlightStore(store: VerseTextHighlightStore): void {
  writeStore(store);
}

export function readChapterVerseTextHighlights(ref: {
  translationId: string;
  bookId: string;
  chapter: number;
}): Map<number, VerseCharHighlightMap> {
  const store = readStore();
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

export function writeVerseTextHighlightIndices(
  ref: VerseTextHighlightRef,
  highlights: Iterable<[number, string]>,
): void {
  const store = readStore();
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
  writeStore(store);
}
