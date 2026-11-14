import type { LoadedChapter } from "@/lib/bible/load-chapter-from-default-translation";
import { LOCAL_SUBSTITUTE_TRANSLATION_IDS } from "@/lib/bible/local-substitute-translation-ids";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { ScriptureVerseXrefs } from "@/lib/bible/scripture-xref-types";
import {
  isSafeStaticScriptureIds,
  staticScriptureBookUrlPath,
  type StaticScriptureBookFile,
} from "@/lib/bible/static-scripture-shape";
import { staticScriptureEntriesToLoadedVerses } from "@/lib/bible/static-scripture-verses";
import {
  isSafeStaticXrefBookId,
  staticXrefsBookUrlPath,
  type StaticXrefsBookFile,
} from "@/lib/bible/static-xrefs-shape";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import type { AppLocale } from "@/lib/i18n/config";
import {
  pickFallbackTranslationId,
  type ReadChapterFallbackInfo,
} from "@/lib/read/read-chapter-format";

/**
 * 网页读经章页的浏览器端取数。
 *
 * 章页不再在服务端读 cookie / 文件——页面本身是静态壳，经文由浏览器取按卷静态 JSON
 * （/scripture/{译本}/{卷}.json，CDN 全缓存），交叉引用同理（/xrefs/{卷}.json）。
 * 远程译本（ESV / YouVersion / api-bible 等需要服务端 API key）静态产物里没有，
 * 回落到 /api/read/chapter。
 */

type TranslationMeta = BibleTranslationsIndex["translations"][number];

const MAX_CACHED_BOOKS = 8;
const bookCache = new Map<string, Promise<StaticScriptureBookFile | null>>();
const xrefCache = new Map<string, Promise<StaticXrefsBookFile | null>>();

function remember<T>(cache: Map<string, Promise<T | null>>, key: string, make: () => Promise<T | null>) {
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= MAX_CACHED_BOOKS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const p = make().then((v) => {
    /** 只记成功结果：失败多半是网络抖动，下次应该重试。 */
    if (v === null) cache.delete(key);
    return v;
  });
  cache.set(key, p);
  return p;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function fetchBookFile(translationId: string, bookId: string): Promise<StaticScriptureBookFile | null> {
  return remember(bookCache, `${translationId}/${bookId}`, async () => {
    const raw = (await fetchJson(staticScriptureBookUrlPath(translationId, bookId))) as
      | Partial<StaticScriptureBookFile>
      | null;
    /** 版本不认识就当没有，交给 API 回落，好过按旧形状静默错读。 */
    if (raw?.v !== 1 || !raw.c || typeof raw.c !== "object") return null;
    return { v: 1, c: raw.c as StaticScriptureBookFile["c"] };
  });
}

async function loadViaStatic(
  meta: TranslationMeta,
  bookId: string,
  chapter: number,
  bookName: string,
): Promise<LoadedChapter | null> {
  const dataId = LOCAL_SUBSTITUTE_TRANSLATION_IDS[meta.id] ?? meta.id;
  if (!isSafeStaticScriptureIds(dataId, bookId)) return null;
  const file = await fetchBookFile(dataId, bookId);
  const entries = file?.c[String(chapter)];
  if (!entries || entries.length === 0) return null;
  const verses = staticScriptureEntriesToLoadedVerses(entries);
  if (verses.length === 0) return null;
  return {
    translationId: meta.id,
    labelZh: meta.labelZh,
    labelEn: meta.labelEn,
    bookId,
    bookName,
    chapter,
    verses,
  };
}

async function loadViaApi(translationId: string, bookId: string, chapter: number): Promise<LoadedChapter | null> {
  try {
    const qs = new URLSearchParams({ bookId, chapter: String(chapter), translationId });
    const res = await fetch(`/api/read/chapter?${qs.toString()}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; data?: LoadedChapter };
    return body.ok && body.data?.verses?.length ? body.data : null;
  } catch {
    return null;
  }
}

/** 读一章：先取静态按卷 JSON，没有（远程译本）再走 /api/read/chapter。 */
export async function loadReadChapterTranslationClient(
  index: BibleTranslationsIndex,
  translationId: string,
  bookId: string,
  chapter: number,
): Promise<LoadedChapter | null> {
  const meta = index.translations.find((t) => t.id === translationId);
  if (!meta || meta.enabled === false) return null;
  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return null;
  const fromStatic = await loadViaStatic(meta, bookId, chapter, bookMeta.bookName);
  if (fromStatic) return fromStatic;
  return loadViaApi(translationId, bookId, chapter);
}

export type ReadChapterClientData = {
  primary: LoadedChapter;
  fallbackFrom: ReadChapterFallbackInfo | null;
  contrasts: { translationId: string; chapter: LoadedChapter }[];
};

/** 主译本 + 缺本章回退 + 对照译本。取不到任何一份主经文时返回 null。 */
export async function loadReadChapterClient(args: {
  index: BibleTranslationsIndex;
  primaryTranslationId: string;
  contrastTranslationIds: string[];
  bookId: string;
  chapter: number;
  locale: AppLocale;
}): Promise<ReadChapterClientData | null> {
  const { index, primaryTranslationId, contrastTranslationIds, bookId, chapter, locale } = args;

  let primary = await loadReadChapterTranslationClient(index, primaryTranslationId, bookId, chapter);
  let fallbackFrom: ReadChapterFallbackInfo | null = null;
  if (!primary) {
    const fallbackId = pickFallbackTranslationId(index, primaryTranslationId, locale);
    const fallbackChapter = fallbackId
      ? await loadReadChapterTranslationClient(index, fallbackId, bookId, chapter)
      : null;
    if (fallbackChapter) {
      const fromMeta = index.translations.find((t) => t.id === primaryTranslationId);
      primary = fallbackChapter;
      fallbackFrom = {
        fromTranslationId: primaryTranslationId,
        fromLabelZh: fromMeta?.labelZh || primaryTranslationId,
        fromLabelEn: fromMeta?.labelEn || primaryTranslationId,
      };
    }
  }
  if (!primary) return null;

  const loaded = await Promise.all(
    contrastTranslationIds.map(async (id) => {
      const c = await loadReadChapterTranslationClient(index, id, bookId, chapter);
      return c ? { translationId: id, chapter: c } : null;
    }),
  );
  return {
    primary,
    fallbackFrom,
    contrasts: loaded.filter((c): c is { translationId: string; chapter: LoadedChapter } => c !== null),
  };
}

/** 本章交叉引用（静态按卷 JSON）。取不到返回 null，页面按「没有交叉引用」处理。 */
export async function loadReadChapterXrefsClient(
  bookId: string,
  chapter: number,
): Promise<ScriptureVerseXrefs[] | null> {
  if (!isSafeStaticXrefBookId(bookId)) return null;
  const file = await remember(xrefCache, bookId, async () => {
    const raw = (await fetchJson(staticXrefsBookUrlPath(bookId))) as Partial<StaticXrefsBookFile> | null;
    if (raw?.v !== 1 || !raw.c || typeof raw.c !== "object") return null;
    return { v: 1, c: raw.c as StaticXrefsBookFile["c"] } as StaticXrefsBookFile;
  });
  if (!file) return null;
  return file.c[String(chapter)] ?? [];
}
