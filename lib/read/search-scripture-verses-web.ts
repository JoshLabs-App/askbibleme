"use client";

import {
  hitsFromRows,
  isBookInScriptureSearchScope,
  isVerseInScriptureSearchScope,
  normalizeScriptureSearchQuery,
  SCRIPTURE_SEARCH_LIMIT,
  SCRIPTURE_SEARCH_MIN_LEN,
  type ScriptureSearchChapterRef,
  type ScriptureSearchHit,
  type ScriptureSearchScope,
} from "@/lib/bible/scripture-search";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import {
  isSafeStaticScriptureIds,
  staticScriptureBookUrlPath,
  type StaticScriptureBookFile,
} from "@/lib/bible/static-scripture-shape";

/**
 * 浏览器端经文搜索：直接取按卷静态文件（public/scripture/…）在本地匹配，
 * 不再打 /api/read/scripture-search。
 *
 * 这样网站运行时就不需要 sqlite 了——原来的服务端实现要把整个 5-6MB 库读进内存再全表
 * LIKE 扫描，是迁出 Render、上边缘运行时的最后一处硬依赖。卷文件本就有 CDN 缓存，
 * 首次之后的搜索纯内存完成，通常比走服务端更快。
 *
 * 行为与服务端实现对齐（含一处不太直觉的地方）：SQL 是 `ORDER BY book_id`，即**字母序**
 * （1CH, 1CO, 1JN … GEN …）而非创世记→启示录的书卷序。这里刻意照搬，免得同一次搜索
 * 在改造前后给出不同顺序；要不要改成书卷序是产品决定，不该混在这次搬迁里。
 */

/** 卷文件约 100KB，缓存住可让连续搜索只付一次下载。 */
const bookCache = new Map<string, StaticScriptureBookFile | null>();

/** 一次并发几卷：既不让 66 个请求同时压上去，又能在够数后尽早停手。 */
const FETCH_BATCH = 6;

function cacheKey(translationId: string, bookId: string): string {
  return `${translationId}/${bookId}`;
}

async function fetchBook(
  translationId: string,
  bookId: string,
): Promise<StaticScriptureBookFile | null> {
  const key = cacheKey(translationId, bookId);
  const cached = bookCache.get(key);
  if (cached !== undefined) return cached;

  let value: StaticScriptureBookFile | null = null;
  try {
    const res = await fetch(staticScriptureBookUrlPath(translationId, bookId), {
      cache: "force-cache",
    });
    if (res.ok) {
      const parsed = (await res.json()) as Partial<StaticScriptureBookFile>;
      /** 版本不认识就当没有，好过按旧形状错读。 */
      if (parsed?.v === 1 && parsed.c && typeof parsed.c === "object") {
        value = { v: 1, c: parsed.c as StaticScriptureBookFile["c"] };
      }
    }
  } catch {
    value = null;
  }
  bookCache.set(key, value);
  return value;
}

/** 按 scope 选出要搜的卷，并按 book_id 字母序排列——与服务端 ORDER BY book_id 对齐。 */
function booksForScope(
  scope: ScriptureSearchScope,
  chapterRef?: ScriptureSearchChapterRef | null,
): string[] {
  if (scope === "chapter") return chapterRef?.bookId ? [chapterRef.bookId] : [];
  const ids =
    scope === "all"
      ? scriptureBooks.map((b) => b.bookId)
      : scriptureBooks.map((b) => b.bookId).filter((id) => isBookInScriptureSearchScope(id, scope));
  return ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

type Row = { book_id: string; chapter: number; verse: number; text: string };

function collectFromBook(
  bookId: string,
  file: StaticScriptureBookFile,
  loweredQuery: string,
  scope: ScriptureSearchScope,
  chapterRef: ScriptureSearchChapterRef | null | undefined,
  out: Row[],
): void {
  /** 章号按数值升序，对齐服务端的 `ORDER BY chapter, verse`。 */
  const chapters = Object.keys(file.c)
    .map((k) => Number(k))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);

  for (const chapter of chapters) {
    if (out.length >= SCRIPTURE_SEARCH_LIMIT) return;
    if (!isVerseInScriptureSearchScope(bookId, chapter, scope, chapterRef)) continue;
    const entries = file.c[String(chapter)] ?? [];
    for (let i = 0; i < entries.length; i += 1) {
      if (out.length >= SCRIPTURE_SEARCH_LIMIT) return;
      const entry = entries[i];
      if (entry === undefined || entry === null) continue;
      const text = typeof entry === "string" ? entry : entry.t;
      if (!text) continue;
      /**
       * SQLite 的 LIKE 对 ASCII 大小写不敏感、对非 ASCII 敏感；中文无大小写之分，
       * 故统一 toLowerCase 后取子串即可等价，无需搬 LIKE 的通配语义（查询词已被
       * 服务端当作纯字面量，两侧包 % 而已）。
       */
      if (!text.toLowerCase().includes(loweredQuery)) continue;
      out.push({ book_id: bookId, chapter, verse: i + 1, text });
    }
  }
}

export async function searchScriptureVersesWeb(
  translationId: string,
  query: string,
  scope: ScriptureSearchScope,
  chapterRef?: ScriptureSearchChapterRef | null,
): Promise<ScriptureSearchHit[]> {
  const tid = String(translationId || "").trim();
  if (!tid) return [];

  const q = normalizeScriptureSearchQuery(query);
  if (!q || q.length < SCRIPTURE_SEARCH_MIN_LEN) return [];
  if (scope === "chapter" && (!chapterRef?.bookId || !Number.isInteger(chapterRef.chapter))) {
    return [];
  }

  const lowered = q.toLowerCase();
  const books = booksForScope(scope, chapterRef).filter((bookId) =>
    isSafeStaticScriptureIds(tid, bookId),
  );

  const rows: Row[] = [];
  for (let i = 0; i < books.length; i += FETCH_BATCH) {
    if (rows.length >= SCRIPTURE_SEARCH_LIMIT) break;
    const batch = books.slice(i, i + FETCH_BATCH);
    const files = await Promise.all(batch.map((bookId) => fetchBook(tid, bookId)));
    for (let j = 0; j < batch.length; j += 1) {
      const file = files[j];
      if (!file) continue;
      collectFromBook(batch[j], file, lowered, scope, chapterRef, rows);
      if (rows.length >= SCRIPTURE_SEARCH_LIMIT) break;
    }
  }

  return hitsFromRows(rows).slice(0, SCRIPTURE_SEARCH_LIMIT);
}
