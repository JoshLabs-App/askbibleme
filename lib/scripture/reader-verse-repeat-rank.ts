import type { Database } from "sql.js";
import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { scriptureBooks, testamentForBookNumber } from "@/lib/bible/scripture-books";
import { canonicalLabel } from "@/lib/scripture/reader-verse-themes-bucket";

/** 排行页正文摘要仅用此译本（与全站默认和合本一致）。 */
export const VERSE_REPEAT_RANK_TRANSLATION_ID = "cuv-simp";

const HITS_CTE = `
WITH RECURSIVE nums(n) AS (
  SELECT 0 UNION ALL SELECT n+1 FROM nums WHERE n < 250
),
hits AS (
  SELECT
    v.book_id AS book_id,
    v.chapter_start AS ch,
    v.verse_start + n.n AS verse,
    v.reference AS reference,
    v.verse_start AS verse_start,
    v.verse_end AS verse_end
  FROM verse v
  JOIN nums n ON n.n <= (v.verse_end - v.verse_start)
  WHERE v.book_id IS NOT NULL AND TRIM(v.book_id) != ''
    AND v.chapter_start = v.chapter_end
    AND v.verse_start > 0
    AND v.verse_start <= v.verse_end
),
grouped AS (
  SELECT
    book_id,
    ch,
    verse,
    COUNT(*) AS repeat_count,
    MAX(
      CASE
        WHEN verse_end > verse_start
          AND (instr(COALESCE(reference, ''), '-') > 0 OR instr(COALESCE(reference, ''), '–') > 0)
        THEN reference
        ELSE NULL
      END
    ) AS source_passage
  FROM hits
  GROUP BY book_id, ch, verse
)`;

export type VerseRepeatRankItem = {
  rank: number;
  bookId: string;
  chapter: number;
  verse: number;
  repeatCount: number;
  /** 单节引用（如「箴言 23:2」） */
  reference: string;
  /** 主题库经段著录（如「箴言 23:1-3」），仅与 reference 不同时展示 */
  sourcePassage: string | null;
  /** 主题库收录分类（子标签展示名，按大主题/子标签顺序） */
  themeLabels: string[];
  /** 和合本（cuv-simp）该节正文截断；不存主题库 verse_text */
  sampleText: string;
  readHref: string;
};

export type VerseRepeatRankPage = {
  totalRows: number;
  uniqueVerses: number;
  offset: number;
  limit: number;
  items: VerseRepeatRankItem[];
};

/** 索引只存书卷章节 + 次数 + 可选经段标签，不存正文。 */
type RankRow = {
  bookId: string;
  chapter: number;
  verse: number;
  repeatCount: number;
  sourcePassage: string | null;
};

const RANK_INDEX_CACHE_VERSION = 2;

type RankIndexCache = {
  version: number;
  mtimeMs: number;
  totalRows: number;
  rows: RankRow[];
};

let indexCache: RankIndexCache | null = null;

const bookNameById = new Map(scriptureBooks.map((b) => [b.bookId, b.bookName]));
const bookNumberById = new Map(scriptureBooks.map((b) => [b.bookId, b.bookNumber]));
const bookTestamentById = new Map(
  scriptureBooks.map((b) => [b.bookId, testamentForBookNumber(b.bookNumber)]),
);

export type VerseRepeatRankSortBy = "repeat" | "book";

export type VerseRepeatRankTestament = "all" | "old" | "new";

export function parseVerseRepeatRankTestament(raw: string | null | undefined): VerseRepeatRankTestament {
  if (raw === "old" || raw === "new") return raw;
  return "all";
}

export function parseVerseRepeatRankSortBy(raw: string | null | undefined): VerseRepeatRankSortBy {
  return raw === "repeat" ? "repeat" : "book";
}

function compareRankRowsByBook(a: RankRow, b: RankRow): number {
  const aBook = bookNumberById.get(a.bookId) ?? 999;
  const bBook = bookNumberById.get(b.bookId) ?? 999;
  if (aBook !== bBook) return aBook - bBook;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

function sortRankRows(rows: RankRow[], sortBy: VerseRepeatRankSortBy): RankRow[] {
  if (sortBy === "repeat") return rows;
  return [...rows].sort(compareRankRowsByBook);
}

function formatCanonicalReference(bookId: string, chapter: number, verse: number): string {
  const name = bookNameById.get(bookId) ?? bookId;
  return `${name} ${chapter}:${verse}`;
}

function truncateText(s: string, max = 120): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function normalizeQuery(q: string): string {
  return String(q ?? "").trim().toLowerCase();
}

export function invalidateVerseRepeatRankMetaCache(): void {
  indexCache = null;
}

export type VerseRepeatCountFilter = {
  minCount?: number;
  maxCount?: number;
};

export function parseVerseRepeatCountFilter(input: {
  minCount?: string | number | null;
  maxCount?: string | number | null;
}): VerseRepeatCountFilter {
  const out: VerseRepeatCountFilter = {};
  const minRaw = input.minCount;
  const maxRaw = input.maxCount;
  if (minRaw !== undefined && minRaw !== null && String(minRaw).trim() !== "") {
    const min = Number(minRaw);
    if (Number.isFinite(min) && min >= 1) out.minCount = Math.floor(min);
  }
  if (maxRaw !== undefined && maxRaw !== null && String(maxRaw).trim() !== "") {
    const max = Number(maxRaw);
    if (Number.isFinite(max) && max >= 1) out.maxCount = Math.floor(max);
  }
  if (out.minCount != null && out.maxCount != null && out.minCount > out.maxCount) {
    return { minCount: out.maxCount, maxCount: out.minCount };
  }
  return out;
}

function rowMatchesQuery(row: RankRow, q: string): boolean {
  if (!q) return true;
  const ref = formatCanonicalReference(row.bookId, row.chapter, row.verse).toLowerCase();
  const hay = [
    row.bookId.toLowerCase(),
    `${row.chapter}:${row.verse}`,
    ref,
    (row.sourcePassage ?? "").toLowerCase(),
  ].join("\n");
  return hay.includes(q);
}

function rowMatchesCount(row: RankRow, filter: VerseRepeatCountFilter): boolean {
  if (filter.minCount != null && row.repeatCount < filter.minCount) return false;
  if (filter.maxCount != null && row.repeatCount > filter.maxCount) return false;
  return true;
}

function rowMatchesTestament(row: RankRow, testament: VerseRepeatRankTestament): boolean {
  if (testament === "all") return true;
  return bookTestamentById.get(row.bookId) === testament;
}

function filterRankRows(
  rows: RankRow[],
  q: string,
  countFilter: VerseRepeatCountFilter,
  testament: VerseRepeatRankTestament = "all",
): RankRow[] {
  return rows.filter(
    (r) => rowMatchesQuery(r, q) && rowMatchesCount(r, countFilter) && rowMatchesTestament(r, testament),
  );
}

export type ThemeRepeatPoolSourceRow = {
  bookId: string;
  chapter: number;
  verse: number;
  repeatCount: number;
};

/** 供静态池构建：默认按收录次数降序；`sortBy: "book"` 则按圣经书卷顺序。 */
export function listThemeRepeatPoolSourceRows(
  db: Database,
  options: {
    minCount?: number;
    maxCount?: number;
    cap?: number;
    mtimeMs?: number;
    sortBy?: VerseRepeatRankSortBy;
  },
): ThemeRepeatPoolSourceRow[] {
  const mtimeMs = options.mtimeMs ?? 0;
  const countFilter = parseVerseRepeatCountFilter({
    minCount: options.minCount,
    maxCount: options.maxCount,
  });
  const index = getOrBuildRankIndex(db, mtimeMs);
  const filtered = sortRankRows(filterRankRows(index.rows, "", countFilter), options.sortBy ?? "repeat");
  const cap = options.cap != null && options.cap > 0 ? Math.floor(options.cap) : 0;
  return cap > 0 ? filtered.slice(0, cap) : filtered;
}

export { themeRepeatPoolScopeId } from "@/lib/scripture/theme-repeat-pool-scope-id";

export function getOrBuildRankIndex(db: Database, mtimeMs: number): RankIndexCache {
  if (indexCache && indexCache.mtimeMs === mtimeMs && indexCache.version === RANK_INDEX_CACHE_VERSION) {
    return indexCache;
  }

  const totalRows = Number(db.exec("SELECT COUNT(*) FROM verse")[0]?.values[0]?.[0] ?? 0);
  const sql = `${HITS_CTE}
    SELECT g.book_id, g.ch, g.verse, g.repeat_count, g.source_passage
    FROM grouped g
    ORDER BY g.repeat_count DESC, g.book_id, g.ch, g.verse`;
  const stmt = db.prepare(sql);
  const rows: RankRow[] = [];
  while (stmt.step()) {
    const o = stmt.getAsObject() as Record<string, unknown>;
    const bookId = String(o.book_id ?? "").trim().toUpperCase();
    const chapter = Number(o.ch ?? 0);
    const verse = Number(o.verse ?? 0);
    rows.push({
      bookId,
      chapter,
      verse,
      repeatCount: Number(o.repeat_count ?? 0),
      sourcePassage: String(o.source_passage ?? "").trim() || null,
    });
  }
  stmt.free();

  indexCache = { version: RANK_INDEX_CACHE_VERSION, mtimeMs, totalRows, rows };
  return indexCache;
}

export function getVerseRepeatRankMeta(db: Database, mtimeMs: number): { totalRows: number; uniqueVerses: number } {
  const index = getOrBuildRankIndex(db, mtimeMs);
  return { totalRows: index.totalRows, uniqueVerses: index.rows.length };
}

export function queryVerseRepeatRankPage(
  db: Database,
  options: {
    limit: number;
    offset: number;
    q?: string;
    minCount?: string | number | null;
    maxCount?: string | number | null;
    sortBy?: VerseRepeatRankSortBy;
    testament?: VerseRepeatRankTestament;
    mtimeMs?: number;
  },
): VerseRepeatRankPage {
  const limit = Math.min(500, Math.max(1, options.limit));
  const offset = Math.max(0, options.offset);
  const q = normalizeQuery(options.q ?? "");
  const countFilter = parseVerseRepeatCountFilter({
    minCount: options.minCount,
    maxCount: options.maxCount,
  });
  const testament = options.testament ?? "all";
  const mtimeMs = options.mtimeMs ?? 0;
  const index = getOrBuildRankIndex(db, mtimeMs);

  const filtered = sortRankRows(
    filterRankRows(index.rows, q, countFilter, testament),
    options.sortBy ?? "book",
  );
  const slice = filtered.slice(offset, offset + limit);

  const items: VerseRepeatRankItem[] = slice.map((row, i) => {
    const reference = formatCanonicalReference(row.bookId, row.chapter, row.verse);
    const sourcePassage =
      row.sourcePassage && row.sourcePassage !== reference ? row.sourcePassage : null;
    return {
      rank: offset + i + 1,
      bookId: row.bookId,
      chapter: row.chapter,
      verse: row.verse,
      repeatCount: row.repeatCount,
      reference,
      sourcePassage,
      themeLabels: [],
      sampleText: "",
      readHref: `/read/${encodeURIComponent(row.bookId)}/${encodeURIComponent(String(row.chapter))}#v${row.verse}`,
    };
  });

  return {
    totalRows: index.totalRows,
    uniqueVerses: filtered.length,
    offset,
    limit,
    items,
  };
}

/** 按书卷章从和合本（cuv-simp）填入正文摘要；每章只读一次圣经库。 */
export async function enrichVerseRepeatRankItems(items: VerseRepeatRankItem[]): Promise<void> {
  if (items.length === 0) return;
  const cwd = process.cwd();
  const tid = VERSE_REPEAT_RANK_TRANSLATION_ID;
  const byChapter = new Map<string, VerseRepeatRankItem[]>();
  for (const it of items) {
    const k = `${it.bookId}:${it.chapter}`;
    const list = byChapter.get(k) ?? [];
    list.push(it);
    byChapter.set(k, list);
  }
  for (const [key, group] of byChapter) {
    const [bookId, chStr] = key.split(":");
    const chapter = Number(chStr);
    if (!bookId || !Number.isFinite(chapter)) continue;
    const loaded = await loadChapterFromTranslation(cwd, bookId, chapter, tid);
    if (!loaded) continue;
    const textByVerse = new Map(loaded.verses.map((v) => [v.verse, v.text.trim()]));
    for (const it of group) {
      const t = textByVerse.get(it.verse);
      it.sampleText = t ? truncateText(t) : "";
    }
  }
}

/** 填入主题库收录分类（子标签名）。 */
export function enrichVerseRepeatRankThemeLabels(db: Database, items: VerseRepeatRankItem[]): void {
  if (items.length === 0) return;

  const byChapter = new Map<string, VerseRepeatRankItem[]>();
  for (const it of items) {
    const k = `${it.bookId}:${it.chapter}`;
    const list = byChapter.get(k) ?? [];
    list.push(it);
    byChapter.set(k, list);
  }

  const stmt = db.prepare(`
    SELECT v.verse_start AS verse_start, v.verse_end AS verse_end,
           s.name AS sub_name, c.position AS cat_pos, s.position AS sub_pos
    FROM verse v
    JOIN subcategory s ON s.category_id = v.category_id AND s.id = v.sub_id
    JOIN category c ON c.id = v.category_id
    WHERE UPPER(TRIM(v.book_id)) = ?
      AND v.chapter_start = ?
      AND v.chapter_end = ?
    ORDER BY c.position, s.position, s.name
  `);

  type TagRow = { verseStart: number; verseEnd: number; label: string };
  for (const [key, group] of byChapter) {
    const [bookId, chStr] = key.split(":");
    const chapter = Number(chStr);
    if (!bookId || !Number.isFinite(chapter)) continue;

    stmt.bind([bookId, chapter, chapter]);
    const tagRows: TagRow[] = [];
    while (stmt.step()) {
      const o = stmt.getAsObject() as Record<string, unknown>;
      const label = canonicalLabel(String(o.sub_name ?? ""));
      if (!label) continue;
      tagRows.push({
        verseStart: Number(o.verse_start ?? 0),
        verseEnd: Number(o.verse_end ?? 0),
        label,
      });
    }
    stmt.reset();

    for (const it of group) {
      const seen = new Set<string>();
      const labels: string[] = [];
      for (const row of tagRows) {
        if (row.verseStart > it.verse || row.verseEnd < it.verse) continue;
        if (seen.has(row.label)) continue;
        seen.add(row.label);
        labels.push(row.label);
      }
      it.themeLabels = labels;
    }
  }
  stmt.free();
}
