import {
  canLoadYouVersionChapterFromPage,
  loadYouVersionChapterRowsFromPage,
} from "@/lib/bible/youversion-chapter-page";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getScriptureBookDisplayName } from "./scripture-book-display-name";
import type { BibleTranslationMeta } from "./translations-types";
import type { LoadedChapter, LoadedChapterVerse } from "./types";

/**
 * 可选的本机/配置章 API（ESV / API.Bible 等需密钥）。
 * 永不包含 askbible.me：内容本地包与主站内容库分离。
 */
function chapterApiUrls(args: { translationId: string; bookId: string; chapter: number }): string[] {
  // 生产内容本地包：章正文不打任何 AskBible 主机。
  if (isMobileBundledOnly() && !__DEV__) return [];

  const configured = getAskBibleBaseUrl().replace(/\/+$/, "");
  if (!configured || /askbible\.me/i.test(configured)) return [];

  const query = new URLSearchParams({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: String(args.chapter),
  });
  return [`${configured}/api/read/chapter?${query.toString()}`];
}

function normalizeRemoteChapter(value: unknown, meta: BibleTranslationMeta): LoadedChapter | null {
  const data = value && typeof value === "object" ? (value as { data?: unknown }).data : null;
  if (!data || typeof data !== "object") return null;
  const raw = data as Partial<LoadedChapter>;
  if (!Array.isArray(raw.verses) || raw.verses.length === 0) return null;
  const verses = raw.verses.filter(
    (verse): verse is LoadedChapterVerse =>
      Boolean(
        verse &&
          typeof verse === "object" &&
          Number.isInteger(verse.verse) &&
          verse.verse > 0 &&
          typeof verse.text === "string" &&
          verse.text.trim(),
      ),
  );
  if (verses.length === 0) return null;
  return {
    translationId: meta.id,
    labelZh: meta.labelZh,
    labelEn: meta.labelEn,
    bookId: String(raw.bookId || "").trim().toUpperCase(),
    bookName: String(raw.bookName || "").trim(),
    chapter: Number(raw.chapter),
    verses,
  };
}

function chapterFromYouVersionRows(
  meta: BibleTranslationMeta,
  bookId: string,
  chapter: number,
  rows: Array<{ verse: number; text: string }>,
): LoadedChapter {
  return {
    translationId: meta.id,
    labelZh: meta.labelZh,
    labelEn: meta.labelEn,
    bookId: bookId.toUpperCase(),
    bookName: getScriptureBookDisplayName(bookId),
    chapter,
    verses: rows.map((row) => ({
      verse: row.verse,
      text: row.text,
      speechParts: null,
      themeRepeatCount: 0,
      isGolden: false,
    })),
  };
}

export async function loadRemoteChapter(
  meta: BibleTranslationMeta,
  bookId: string,
  chapter: number,
): Promise<LoadedChapter | null> {
  // YouVersion / chapter-api：设备直抓公开章节页（不等同拉 askbible 内容更新包）。
  // 目录缓存若丢了 provider，仍按 remoteId / delivery 走直抓。
  if (canLoadYouVersionChapterFromPage(meta)) {
    try {
      const rows = await loadYouVersionChapterRowsFromPage({
        translationId: meta.id,
        bookId,
        chapter,
        remoteId: meta.remoteId,
      });
      if (rows?.length) return chapterFromYouVersionRows(meta, bookId, chapter, rows);
      console.warn("[read] youversion chapter empty", {
        translationId: meta.id,
        bookId,
        chapter,
        remoteId: meta.remoteId ?? null,
        provider: meta.provider ?? null,
      });
    } catch (err) {
      console.warn("[read] youversion chapter throw", {
        translationId: meta.id,
        bookId,
        chapter,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ESV / API.Bible 等：仅开发或非 BUNDLED_ONLY 时走配置的本机/同源 API（不含 askbible.me）。
  for (const url of chapterApiUrls({ translationId: meta.id, bookId, chapter })) {
    try {
      const response = await fetchWithTimeout(url, {
        timeoutMs: 15_000,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const loaded = normalizeRemoteChapter(await response.json(), meta);
      if (loaded) return loaded;
    } catch {
      // 本机 API 未启动时继续失败返回。
    }
  }

  return null;
}
