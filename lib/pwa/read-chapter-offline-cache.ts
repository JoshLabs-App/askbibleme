import { MAX_READ_CHAPTER_SNAPSHOTS } from "@/lib/pwa/offline-cache-limits";

const DB_NAME = "selah-offline-v1";
const DB_VERSION = 1;
const STORE = "read-chapters";

export type ReadChapterVerseSnapshot = { verse: number; text: string };

export type ReadChapterOfflineSnapshot = {
  translationId: string;
  bookId: string;
  chapter: number;
  bookName: string;
  verses: ReadChapterVerseSnapshot[];
  contrastVerses: ReadChapterVerseSnapshot[] | null;
  cachedAt: number;
  lastAccessedAt: number;
};

export function readChapterOfflineKey(translationId: string, bookId: string, chapter: number): string {
  return `${translationId.trim()}:${bookId.trim().toUpperCase()}:${chapter}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb transaction failed"));
  });
}

async function trimReadChapterSnapshots(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE, "readonly");
  const rows = (await idbReq(
    tx.objectStore(STORE).getAll(),
  )) as ({ key: string } & ReadChapterOfflineSnapshot)[];
  if (rows.length <= MAX_READ_CHAPTER_SNAPSHOTS) return;

  rows.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  const toDelete = rows.slice(0, rows.length - MAX_READ_CHAPTER_SNAPSHOTS);
  const wtx = db.transaction(STORE, "readwrite");
  const store = wtx.objectStore(STORE);
  for (const row of toDelete) {
    store.delete(row.key);
  }
  await idbTxDone(wtx);
}

async function maybeTrimForStoragePressure(db: IDBDatabase): Promise<void> {
  try {
    const est = await navigator.storage?.estimate?.();
    const usage = est?.usage ?? 0;
    const quota = est?.quota ?? 0;
    if (!quota || usage / quota < 0.85) return;
    const tx = db.transaction(STORE, "readonly");
    const rows = (await idbReq(
      tx.objectStore(STORE).getAll(),
    )) as ({ key: string } & ReadChapterOfflineSnapshot)[];
    rows.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    const drop = Math.max(1, Math.floor(rows.length / 3));
    const wtx = db.transaction(STORE, "readwrite");
    const store = wtx.objectStore(STORE);
    for (const row of rows.slice(0, drop)) store.delete(row.key);
    await idbTxDone(wtx);
  } catch {
    /* ignore */
  }
}

export async function writeReadChapterOfflineSnapshot(
  input: Omit<ReadChapterOfflineSnapshot, "cachedAt" | "lastAccessedAt">,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const key = readChapterOfflineKey(input.translationId, input.bookId, input.chapter);
  const now = Date.now();
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const existing = (await idbReq(tx.objectStore(STORE).get(key))) as
    | ({ key: string } & ReadChapterOfflineSnapshot)
    | undefined;
  const row = {
    key,
    ...input,
    bookId: input.bookId.trim().toUpperCase(),
    cachedAt: existing?.cachedAt ?? now,
    lastAccessedAt: now,
  };
  await idbReq(tx.objectStore(STORE).put(row));
  db.close();
  const db2 = await openDb();
  await trimReadChapterSnapshots(db2);
  await maybeTrimForStoragePressure(db2);
  db2.close();
}

export async function readReadChapterOfflineSnapshot(
  translationId: string,
  bookId: string,
  chapter: number,
): Promise<ReadChapterOfflineSnapshot | null> {
  if (typeof indexedDB === "undefined") return null;
  const key = readChapterOfflineKey(translationId, bookId, chapter);
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const row = (await idbReq(tx.objectStore(STORE).get(key))) as
    | ({ key: string } & ReadChapterOfflineSnapshot)
    | undefined;
  if (!row?.verses?.length) {
    db.close();
    return null;
  }
  row.lastAccessedAt = Date.now();
  await idbReq(tx.objectStore(STORE).put(row));
  await idbTxDone(tx);
  db.close();
  const { key: _k, ...snap } = row;
  return snap;
}

export function isLikelyOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}
