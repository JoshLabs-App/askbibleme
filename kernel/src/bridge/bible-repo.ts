import {
  LOCAL_DB_ROUTES,
  type BibleChapterPayload,
  type BibleSearchHit,
  type BibleTranslationInfo,
  type BibleVerse,
} from "./contracts";

const DB_NAME = "askbible-kernel-db";
const DB_VERSION = 1;
const STORE_CHAPTERS = "chapters";
const STORE_META = "meta";

const MEDIA_CANDIDATES = [
  "",
  "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev",
  "https://media.askbible.me",
];

export const DEFAULT_TRANSLATIONS: BibleTranslationInfo[] = [
  { id: "cuv-simp", name: "和合本 (简体)", shortName: "和合本", language: "zh-Hans", bundled: true },
  { id: "cuv-trad", name: "和合本 (繁體)", shortName: "和合本繁", language: "zh-Hant" },
  { id: "kjv", name: "King James Version", shortName: "KJV", language: "en", bundled: true },
  { id: "web-en", name: "World English Bible", shortName: "WEB", language: "en" },
];

type RawStaticVerse = string | { t: string; r?: number };
interface RawStaticBook {
  v?: number;
  c?: Record<string, RawStaticVerse[]>;
}

const BUNDLED_FALLBACK_CHAPTERS: Record<string, BibleVerse[]> = {
  "cuv-simp:GEN:1": [
    { verse: 1, text: "起初，神创造天地。" },
    { verse: 2, text: "地是空虚混沌，渊面黑暗；神的灵运行在水面上。" },
    { verse: 3, text: "神说：「要有光」，就有了光。" },
    { verse: 4, text: "神看光是好的，就把光暗分开了。" },
    { verse: 5, text: "神称光为「昼」，称暗为「夜」。有晚上，有早晨，这是头一日。" },
  ],
  "cuv-simp:PSA:23": [
    { verse: 1, text: "耶和华是我的牧者，我必不致缺乏。" },
    { verse: 2, text: "他使我躺卧在青草地上，领我在可安歇的水边。" },
    { verse: 3, text: "他使我的灵魂苏醒，为自己的名引导我走义路。" },
    { verse: 4, text: "我虽然行过死荫的幽谷，也不怕遭害，因为你与我同在；你的杖，你的竿，都安慰我。" },
    { verse: 5, text: "在我敌人面前，你为我摆设筵席；你用油膏了我的头，使我的福杯满溢。" },
    { verse: 6, text: "我一生一世必有恩惠慈爱随着我；我且要住在耶和华的殿中，直到永远。" },
  ],
  "cuv-simp:JHN:1": [
    { verse: 1, text: "太初有道，道与神同在，道就是神。", refCount: 14 },
    { verse: 2, text: "这道太初与神同在。", refCount: 4 },
    { verse: 3, text: "万物是借着他造的；凡被造的，没有一样不是借着他造的。", refCount: 10 },
    { verse: 4, text: "生命在他里头，这生命就是人的光。", refCount: 2 },
    { verse: 5, text: "光照在黑暗里，黑暗却不接受光。", refCount: 9 },
  ],
  "cuv-simp:JHN:3": [
    { verse: 16, text: "神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不致灭亡，反得永生。" },
    { verse: 17, text: "因为神差他的儿子降世，不是要定世人的罪，乃是要叫世人因他得救。" },
  ],
  "kjv:JHN:1": [
    { verse: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
    { verse: 2, text: "The same was in the beginning with God." },
    { verse: 3, text: "All things were made by him; and without him was not any thing made that was made." },
    { verse: 4, text: "In him was life; and the life was the light of men." },
    { verse: 5, text: "And the light shineth in darkness; and the darkness comprehended it not." },
  ],
};

function openKernelDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
          db.createObjectStore(STORE_CHAPTERS, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openKernelDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openKernelDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbAllChapters(): Promise<Array<{ key: string; translationId: string; bookId: string; chapter: number; verses: BibleVerse[] }>> {
  const db = await openKernelDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CHAPTERS, "readonly");
      const req = tx.objectStore(STORE_CHAPTERS).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function normalizeVerses(rawList: RawStaticVerse[]): BibleVerse[] {
  return rawList.map((item, idx) => {
    if (typeof item === "string") {
      return { verse: idx + 1, text: item };
    }
    return {
      verse: idx + 1,
      text: item.t,
      refCount: item.r,
    };
  });
}

async function fetchStaticBookJson(translationId: string, bookId: string): Promise<RawStaticBook | null> {
  const rel = `/scripture/${encodeURIComponent(translationId)}/${encodeURIComponent(bookId)}.json`;
  for (const base of MEDIA_CANDIDATES) {
    try {
      const res = await fetch(`${base}${rel}`);
      if (res.ok) {
        return (await res.json()) as RawStaticBook;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

export function createBibleRepo(isNative: () => boolean) {
  async function getTranslations(): Promise<BibleTranslationInfo[]> {
    if (isNative()) {
      try {
        const res = await fetch(LOCAL_DB_ROUTES.translations, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as BibleTranslationInfo[] | { translations: BibleTranslationInfo[] };
          return Array.isArray(data) ? data : data.translations;
        }
      } catch {
        // Fallback below
      }
    }

    const downloaded = await idbGet<{ key: string; ids: string[] }>(STORE_META, "downloaded-translations");
    const downloadedSet = new Set(downloaded?.ids ?? []);
    return DEFAULT_TRANSLATIONS.map((t) => ({
      ...t,
      downloaded: t.bundled || downloadedSet.has(t.id),
    }));
  }

  async function getChapter(
    translationId: string,
    bookId: string,
    chapter: number,
  ): Promise<BibleChapterPayload> {
    if (isNative()) {
      const url = `${LOCAL_DB_ROUTES.chapter}?t=${encodeURIComponent(translationId)}&b=${encodeURIComponent(bookId)}&c=${chapter}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { verses: BibleVerse[] };
        return {
          translationId,
          bookId,
          chapter,
          verses: data.verses ?? [],
          source: "sqlite",
        };
      }
    }

    const cacheKey = `${translationId}:${bookId}:${chapter}`;
    const cached = await idbGet<{ key: string; verses: BibleVerse[] }>(STORE_CHAPTERS, cacheKey);
    if (cached?.verses?.length) {
      return { translationId, bookId, chapter, verses: cached.verses, source: "indexeddb" };
    }

    const rawBook = await fetchStaticBookJson(translationId, bookId);
    const rawChapter = rawBook?.c?.[String(chapter)];
    if (rawBook?.c && Array.isArray(rawChapter)) {
      const entries = Object.entries(rawBook.c);
      await Promise.all(
        entries.map(([chStr, list]) =>
          idbPut(STORE_CHAPTERS, {
            key: `${translationId}:${bookId}:${chStr}`,
            translationId,
            bookId,
            chapter: Number(chStr),
            verses: normalizeVerses(list),
          }),
        ),
      );
      return {
        translationId,
        bookId,
        chapter,
        verses: normalizeVerses(rawChapter),
        source: "network",
      };
    }

    const bundled = BUNDLED_FALLBACK_CHAPTERS[cacheKey] ?? BUNDLED_FALLBACK_CHAPTERS["cuv-simp:JHN:1"];
    return {
      translationId,
      bookId,
      chapter,
      verses: bundled,
      source: "bundled",
    };
  }

  async function search(
    translationId: string,
    keyword: string,
    limit = 50,
  ): Promise<BibleSearchHit[]> {
    const q = keyword.trim();
    if (!q) return [];

    if (isNative()) {
      const url = `${LOCAL_DB_ROUTES.search}?t=${encodeURIComponent(translationId)}&q=${encodeURIComponent(q)}&limit=${limit}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as BibleSearchHit[] | { hits: BibleSearchHit[] };
        return Array.isArray(data) ? data : data.hits;
      }
    }

    const lower = q.toLowerCase();
    const hits: BibleSearchHit[] = [];
    const cached = await idbAllChapters();
    for (const entry of cached) {
      if (entry.translationId !== translationId) continue;
      for (const v of entry.verses) {
        if (v.text.toLowerCase().includes(lower)) {
          hits.push({
            translationId,
            bookId: entry.bookId,
            chapter: entry.chapter,
            verse: v.verse,
            text: v.text,
          });
          if (hits.length >= limit) return hits;
        }
      }
    }

    for (const [key, verses] of Object.entries(BUNDLED_FALLBACK_CHAPTERS)) {
      const [tId, bId, chStr] = key.split(":");
      if (tId !== translationId) continue;
      for (const v of verses) {
        if (v.text.toLowerCase().includes(lower)) {
          const dup = hits.some(
            (h) => h.bookId === bId && h.chapter === Number(chStr) && h.verse === v.verse,
          );
          if (!dup) {
            hits.push({
              translationId: tId,
              bookId: bId,
              chapter: Number(chStr),
              verse: v.verse,
              text: v.text,
            });
            if (hits.length >= limit) return hits;
          }
        }
      }
    }

    return hits;
  }

  async function markTranslationDownloaded(id: string): Promise<string[]> {
    const existing = await idbGet<{ key: string; ids: string[] }>(STORE_META, "downloaded-translations");
    const next = Array.from(new Set([...(existing?.ids ?? []), id]));
    await idbPut(STORE_META, { key: "downloaded-translations", ids: next });
    return next;
  }

  async function getDownloadedTranslationIds(): Promise<string[]> {
    const existing = await idbGet<{ key: string; ids: string[] }>(STORE_META, "downloaded-translations");
    return existing?.ids ?? ["cuv-simp", "kjv"];
  }

  return {
    getTranslations,
    getChapter,
    search,
    markTranslationDownloaded,
    getDownloadedTranslationIds,
  };
}
