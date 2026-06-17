import * as SQLite from "expo-sqlite";
import { isBundledScriptureTranslation } from "./bundled-scripture-translations";
import {
  ensureBundledDatabaseOnDisk,
  ensureDownloadedDatabaseOnDisk,
  getLocalScriptureTranslationByteSize,
  rebuildBundledScriptureDatabase,
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
  rebuildBundledScriptureDatabase,
};

/** 打开指定译本 SQLite；内置译本从 assets 复制，其余须已下载到文档目录。 */
export async function getScriptureDatabase(
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
      if (bundled) {
        await ensureBundledDatabaseOnDisk(id);
      } else {
        await ensureDownloadedDatabaseOnDisk(id);
      }
      const db = await SQLite.openDatabaseAsync(dbFileName(id));
      trackOpenedDatabase(id, db);
      return db;
    })();
    setOpenPromise(id, openPromise);
  }
  return openPromise;
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
    const firstDb = await getScriptureDatabase(id);
    try {
      return await run(firstDb);
    } catch (err) {
      if (!isNativeDatabaseRejectedError(err)) throw err;
      await closeOpenedDatabase(id);
      clearOpenPromise(id);
      const reopened = await getScriptureDatabase(id);
      try {
        return await run(reopened);
      } catch (err2) {
        if (!isNativeDatabaseRejectedError(err2)) throw err2;
        const dest = getScriptureDatabaseDestPath(id);
        await removeInstalledDatabase(dest, id);
        if (isBundledScriptureTranslation(id)) {
          await ensureBundledDatabaseOnDisk(id);
        } else {
          throw err2;
        }
        const rebuilt = await getScriptureDatabase(id);
        return run(rebuilt);
      }
    }
  });
}
