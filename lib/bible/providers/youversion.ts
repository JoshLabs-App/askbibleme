import { parseRemoteChapterContent, type RemoteChapterVerseRow } from "@/lib/bible/providers/content-parser";
import { loadYouVersionChapterRowsFromPage } from "@/lib/bible/youversion-chapter-page";
import type { BibleTranslationMeta } from "@/lib/bible/translations-types";

const YOUVERSION_BASE_URL = "https://api.youversion.com/v1";
const YOUVERSION_APP_KEY = process.env.YVP_APP_KEY?.trim() || "";

/**
 * `YVP_APP_KEY` 实际授权到的版本号。
 *
 * 2026-09-23 用官方目录接口 `/v1/bibles?language_ranges[]=eng|zho` 拉下来的实际清单，
 * **逐个用 `passages/JHN.3.16` 验证过**：在表里的返回正文，不在表里的一律 404 Not Found。
 *
 * 这张表决定走哪条路：**在表里的走官方 API（有授权），不在表里的才退回抓页**。
 * 以前是反过来的——抓页在前、API 兜底，于是有授权的译本也在抓网页。
 *
 * 目录会变（YouVersion 加减译本、我们的授权档位变了都会变），
 * 重新生成的办法见 docs/OPEN-ITEMS.md「YouVersion 授权目录」那一条。
 */
const YOUVERSION_LICENSED_VERSION_IDS = new Set<string>([
  // 英文 17
  "1588", "12", "3034", "42", "1932", "2163", "2660", "100", "2692",
  "110", "111", "113", "3427", "130", "206", "1209", "1207",
  // 中文 5
  "36", "43", "3354", "1392", "312",
]);

export function youVersionVersionIsLicensed(versionId: string): boolean {
  return YOUVERSION_LICENSED_VERSION_IDS.has(String(versionId || "").trim());
}

/** 一章打几路并发取节。上游一节一个请求，串行取诗篇 119 要 176 个来回。 */
const VERSE_FETCH_CONCURRENCY = 10;

/**
 * 章级缓存。经文不会变，同一章第二次打开直接命中，不再打 N 次上游。
 * 放进程内存里：Next 的 server 实例活多久它就活多久，重启即空，不落盘。
 */
const CHAPTER_CACHE = new Map<string, { rows: RemoteChapterVerseRow[]; at: number }>();
const CHAPTER_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const CHAPTER_CACHE_MAX = 500;

function readChapterCache(key: string): RemoteChapterVerseRow[] | null {
  const hit = CHAPTER_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CHAPTER_CACHE_TTL_MS) {
    CHAPTER_CACHE.delete(key);
    return null;
  }
  // 命中的挪到末尾，下面按插入顺序淘汰最久没用的
  CHAPTER_CACHE.delete(key);
  CHAPTER_CACHE.set(key, hit);
  return hit.rows;
}

function writeChapterCache(key: string, rows: RemoteChapterVerseRow[]): void {
  CHAPTER_CACHE.set(key, { rows, at: Date.now() });
  while (CHAPTER_CACHE.size > CHAPTER_CACHE_MAX) {
    const oldest = CHAPTER_CACHE.keys().next().value;
    if (oldest === undefined) break;
    CHAPTER_CACHE.delete(oldest);
  }
}

/**
 * 走官方 API 取一整章：先要节号列表，再并发取每一节的正文。
 *
 * **为什么非得一节一个请求**：官方 API 没有「整章逐节」的端点。
 * 整章的 `passages/{BOOK}.{CH}` 返回的是一大段连排文本、**不带节号**，切不开；
 * `books/{B}/chapters/{N}/verses` 只给节号和 passage_id、**不给正文**。
 * 批量写法也试过：`JHN.3.1-JHN.3.3` 和 `JHN.3.1,JHN.3.2` 都是 404，
 * `JHN.3.1+JHN.3.2` 能通但合并成一段、节与节之间没有分隔。
 * 所以只能逐节取——但可以并发，再加上面那层章级缓存，实际代价很低。
 */
async function loadYouVersionChapterRowsFromApi(
  versionId: string,
  bookId: string,
  chapter: number,
): Promise<RemoteChapterVerseRow[] | null> {
  if (!YOUVERSION_APP_KEY) return null;
  const book = String(bookId || "").trim().toUpperCase();
  if (!book) return null;

  const verseListUrl =
    `${YOUVERSION_BASE_URL}/bibles/${encodeURIComponent(versionId)}` +
    `/books/${encodeURIComponent(book)}/chapters/${encodeURIComponent(String(chapter))}/verses`;
  const verseListJson = await youVersionFetchJson(verseListUrl);
  const verseList = Array.isArray((verseListJson as { data?: unknown } | null)?.data)
    ? ((verseListJson as { data?: YouVersionChapterVerse[] }).data ?? [])
    : [];
  if (verseList.length === 0) return null;

  const targets = verseList
    .map((row, index) => {
      const verse = Number(String(row.title || row.id || "").trim()) || index + 1;
      const passageId = String(row.passage_id || `${book}.${chapter}.${verse}`).trim();
      return passageId ? { verse, passageId } : null;
    })
    .filter((x): x is { verse: number; passageId: string } => x != null);
  if (targets.length === 0) return null;

  const texts: (string | null)[] = new Array(targets.length).fill(null);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= targets.length) return;
      texts[i] = await loadYouVersionVerseText(versionId, targets[i]!.passageId);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(VERSE_FETCH_CONCURRENCY, targets.length) }, worker),
  );

  const rows: RemoteChapterVerseRow[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    const text = texts[i];
    if (text) rows.push({ verse: targets[i]!.verse, text });
  }
  return rows.length > 0 ? rows.sort((a, b) => a.verse - b.verse) : null;
}

async function youVersionFetchJson(url: string): Promise<unknown | null> {
  if (!YOUVERSION_APP_KEY) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "X-YVP-App-Key": YOUVERSION_APP_KEY,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function extractRemoteContent(raw: unknown): string | null {
  const findFirstStringValue = (value: unknown, depth = 0): string | null => {
    if (depth > 3 || value == null) return null;
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = findFirstStringValue(item, depth + 1);
        if (hit) return hit;
      }
      return null;
    }
    if (typeof value !== "object") return null;
    for (const key of ["content", "text", "passage", "body", "reference"]) {
      const candidate = findFirstStringValue((value as Record<string, unknown>)[key], depth + 1);
      if (candidate) return candidate;
    }
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const hit = findFirstStringValue(nested, depth + 1);
      if (hit) return hit;
    }
    return null;
  };

  return findFirstStringValue(raw);
}

function resolveYouVersionVersionId(meta: BibleTranslationMeta): string | null {
  const remoteId = meta.remoteId?.trim();
  if (remoteId) return remoteId;
  return meta.id === "niv" ? "111" : null;
}

type YouVersionChapterVerse = {
  id?: string;
  passage_id?: string;
  title?: string;
};

async function loadYouVersionVerseText(versionId: string, passageId: string): Promise<string | null> {
  const url = `${YOUVERSION_BASE_URL}/bibles/${encodeURIComponent(versionId)}/passages/${encodeURIComponent(
    passageId,
  )}?content-type=text`;
  const json = await youVersionFetchJson(url);
  const content = extractRemoteContent(json);
  return content ? content.trim() : null;
}

export async function loadYouVersionChapterRows(
  meta: BibleTranslationMeta,
  bookId: string,
  chapter: number,
): Promise<RemoteChapterVerseRow[] | null> {
  const versionId = resolveYouVersionVersionId(meta);
  if (!versionId) return null;

  const cacheKey = `${versionId}|${String(bookId || "").trim().toUpperCase()}|${chapter}`;
  const cached = readChapterCache(cacheKey);
  if (cached) return cached;

  // **官方 API 优先**（2026-09-23 改）。以前是抓页在前、API 兜底，
  // 结果有授权的译本（NIV、当代译本、CSB…）也在抓 bible.com 的网页。
  // 当时那么写是因为网页端要一次渲染整章，抓页 1 个请求就够、API 要打 N 次；
  // 现在并发 + 章级缓存之后这个差距没有了，没有理由再把抓页放前面。
  if (youVersionVersionIsLicensed(versionId)) {
    const apiRows = await loadYouVersionChapterRowsFromApi(versionId, bookId, chapter);
    if (apiRows?.length) {
      writeChapterCache(cacheKey, apiRows);
      return apiRows;
    }
  }

  // 不在授权目录里的译本目前只有抓页这一条路。
  // ⚠️ 这条是历史遗留，涉及版权，处理方式见 docs/OPEN-ITEMS.md「没有授权的 YouVersion 译本」。
  const pageRows = await loadYouVersionChapterRowsFromPage({
    translationId: meta.id,
    bookId,
    chapter,
    remoteId: versionId,
  });
  if (pageRows?.length) {
    writeChapterCache(cacheKey, pageRows);
    return pageRows;
  }

  // 有授权但上面那条没取到（配额、临时故障）时，再试一次整章接口。
  // 注意它返回的是不带节号的连排文本，`parseRemoteChapterContent` 尽力切分，精度不如逐节。
  if (!YOUVERSION_APP_KEY) return null;
  const chapterId = `${String(bookId || "").trim().toUpperCase()}.${chapter}`;
  const urls = [
    `${YOUVERSION_BASE_URL}/bibles/${encodeURIComponent(versionId)}/passages/${encodeURIComponent(
      chapterId,
    )}?content-type=text`,
    `${YOUVERSION_BASE_URL}/bibles/${encodeURIComponent(versionId)}/passages/${encodeURIComponent(chapterId)}`,
  ];
  for (const url of urls) {
    const json = await youVersionFetchJson(url);
    const content = extractRemoteContent(json);
    if (!content) continue;
    const rows = parseRemoteChapterContent(content);
    if (rows.length > 0) {
      writeChapterCache(cacheKey, rows);
      return rows;
    }
  }
  return null;
}
