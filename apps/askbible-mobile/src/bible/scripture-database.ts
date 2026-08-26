import * as SQLite from "expo-sqlite";
import { isBundledScriptureTranslation } from "./bundled-scripture-translations";
import {
  ensureBundledDatabaseOnDisk,
  ensureDownloadedDatabaseOnDisk,
  getLocalScriptureTranslationByteSize,
  rebuildBundledScriptureDatabaseInner,
} from "./scriptureDatabaseBundledInstall";
import { markScriptureDatabaseInstalled, writeRemoteScriptureBytesMarker } from "./scriptureDatabaseMarkers";
import { SCRIPTURE_SQLITE_SCHEMA_VERSION } from "./scriptureDatabasePaths";
import {
  clearOpenPromise,
  closeOpenedDatabase,
  enqueueScriptureDbOperation,
  getOpenPromise,
  getScriptureDatabaseDestPath,
  hasWarmedSearchTranslation,
  isNativeDatabaseRejectedError,
  isScriptureTranslationInstalled,
  markWarmedSearchTranslation,
  removeInstalledDatabase,
  removeScriptureDatabaseFiles,
  setOpenPromise,
  trackOpenedDatabase,
} from "./scriptureDatabaseSession";
import { dbFileName } from "./scriptureDatabasePaths";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "./types";

export {
  SCRIPTURE_SQLITE_SCHEMA_VERSION,
  getScriptureDatabaseDestPath,
  markScriptureDatabaseInstalled,
  writeRemoteScriptureBytesMarker,
  isScriptureTranslationInstalled,
  removeScriptureDatabaseFiles,
  getLocalScriptureTranslationByteSize,
  isNativeDatabaseRejectedError,
};

/** 打开指定译本 SQLite（须在 enqueue 回调内调用，避免与查询并发删库）。 */
async function openScriptureDatabaseUnlocked(
  translationId: string = DEFAULT_SCRIPTURE_TRANSLATION_ID,
): Promise<SQLite.SQLiteDatabase> {
  const id = String(translationId || "").trim();
  const bundled = isBundledScriptureTranslation(id);
  if (!bundled && !(await isScriptureTranslationInstalled(id))) {
    throw new Error(`译本未下载：${id}`);
  }

  let openPromise = getOpenPromise(id);
  if (!openPromise) {
    openPromise = (async () => {
      try {
        if (bundled) {
          await ensureBundledDatabaseOnDisk(id);
        } else {
          await ensureDownloadedDatabaseOnDisk(id);
        }
        // Android：共用连接被 close 后易 NPE；每次打开用新连接。
        const db = await SQLite.openDatabaseAsync(dbFileName(id), { useNewConnection: true });
        trackOpenedDatabase(id, db);
        return db;
      } catch (err) {
        clearOpenPromise(id);
        await closeOpenedDatabase(id);
        throw err;
      }
    })();
    setOpenPromise(id, openPromise);
  }
  return openPromise;
}

/** 打开指定译本 SQLite；内置译本从 assets 复制，其余须已下载到文档目录。 */
export async function getScriptureDatabase(
  translationId: string = DEFAULT_SCRIPTURE_TRANSLATION_ID,
): Promise<SQLite.SQLiteDatabase> {
  const id = String(translationId || "").trim();
  return enqueueScriptureDbOperation(id, () => openScriptureDatabaseUnlocked(id));
}

export async function rebuildBundledScriptureDatabase(translationId: string): Promise<void> {
  const id = String(translationId || "").trim();
  if (!isBundledScriptureTranslation(id)) return;
  await enqueueScriptureDbOperation(id, () => rebuildBundledScriptureDatabaseInner(id));
}

/** 打开译本 SQLite 并执行轻量查询，缩短首次搜索冷启动。 */
export async function warmScriptureSearchDatabase(
  translationId: string = DEFAULT_SCRIPTURE_TRANSLATION_ID,
): Promise<void> {
  const id = String(translationId || "").trim();
  if (!id || hasWarmedSearchTranslation(id)) return;
  if (!(await isScriptureTranslationInstalled(id))) return;
  try {
    await retryScriptureDatabaseOnPrepareError(id, (db) =>
      db.getFirstAsync<{ ok: number }>("SELECT 1 AS ok LIMIT 1"),
    );
    markWarmedSearchTranslation(id);
  } catch {
    /* warmup best-effort */
  }
}

/** SQLite 原生句柄偶发失效时，清理连接并重建一遍本地 DB。 */
export async function retryScriptureDatabaseOnPrepareError<T>(
  translationId: string,
  run: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const id = String(translationId || "").trim();
  return enqueueScriptureDbOperation(id, async () => {
    const firstDb = await openScriptureDatabaseUnlocked(id);
    try {
      return await run(firstDb);
    } catch (err) {
      if (!isNativeDatabaseRejectedError(err)) throw err;
      await closeOpenedDatabase(id);
      clearOpenPromise(id);
      // 先换新连接，避免一遇 NPE 就删库重装引发 Android 连接风暴。
      const reopened = await openScriptureDatabaseUnlocked(id);
      try {
        return await run(reopened);
      } catch (err2) {
        if (!isNativeDatabaseRejectedError(err2)) throw err2;
        if (!isBundledScriptureTranslation(id)) throw err2;
        await closeOpenedDatabase(id);
        clearOpenPromise(id);
        await rebuildBundledScriptureDatabaseInner(id);
        const rebuilt = await openScriptureDatabaseUnlocked(id);
        return run(rebuilt);
      }
    }
  });
}
