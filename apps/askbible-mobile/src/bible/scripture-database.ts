import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import { getBundledScriptureAssetModule, isBundledScriptureTranslation } from "./bundled-scripture-translations";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "./types";

/**
 * 与主仓库 `askbible-scripture-sqlite-v3`（含 theme_repeat_count）对齐；升级后须递增。
 * v5: 强制刷新设备侧已安装 sqlite，确保经文源文本修订（如个别汉字显示异常修复）能落地。
 * v6: 强制刷新说话标注修订（四福音神言/人话纠偏）。
 */
export const SCRIPTURE_SQLITE_SCHEMA_VERSION = 6;

const openPromises = new Map<string, Promise<SQLite.SQLiteDatabase>>();
const openDatabases = new Map<string, SQLite.SQLiteDatabase>();
const operationTails = new Map<string, Promise<void>>();

function enqueueScriptureDbOperation<T>(translationId: string, work: () => Promise<T>): Promise<T> {
  const tail = operationTails.get(translationId) ?? Promise.resolve();
  const run = tail.catch(() => undefined).then(work);
  operationTails.set(
    translationId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function dbFileName(translationId: string): string {
  const normalized = translationId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `${normalized}.sqlite`;
}

export function getScriptureDatabaseDestPath(translationId: string): string {
  return `${FileSystem.documentDirectory}SQLite/${dbFileName(translationId)}`;
}

function schemaVersionPath(dest: string): string {
  return `${dest}.schema-version`;
}

async function readInstalledSchemaVersion(dest: string): Promise<number | null> {
  const path = schemaVersionPath(dest);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  try {
    const raw = await FileSystem.readAsStringAsync(path);
    const n = Number(String(raw).trim());
    return Number.isInteger(n) && n >= 1 ? n : null;
  } catch {
    return null;
  }
}

async function writeInstalledSchemaVersion(dest: string, version: number): Promise<void> {
  await FileSystem.writeAsStringAsync(schemaVersionPath(dest), String(version));
}

function remoteBytesMarkerPath(dest: string): string {
  return `${dest}.remote-bytes`;
}

async function readRemoteBytesMarker(dest: string): Promise<number | null> {
  const path = remoteBytesMarkerPath(dest);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  try {
    const raw = await FileSystem.readAsStringAsync(path);
    const n = Number(String(raw).trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function writeRemoteScriptureBytesMarker(dest: string, bytes: number): Promise<void> {
  if (!Number.isInteger(bytes) || bytes <= 0) return;
  await FileSystem.writeAsStringAsync(remoteBytesMarkerPath(dest), String(bytes));
}

async function clearRemoteBytesMarker(dest: string): Promise<void> {
  await FileSystem.deleteAsync(remoteBytesMarkerPath(dest), { idempotent: true });
}

export async function markScriptureDatabaseInstalled(dest: string): Promise<void> {
  await writeInstalledSchemaVersion(dest, SCRIPTURE_SQLITE_SCHEMA_VERSION);
}

export async function isScriptureTranslationInstalled(translationId: string): Promise<boolean> {
  const id = String(translationId || "").trim();
  if (!id) return false;
  if (isBundledScriptureTranslation(id)) return true;
  const dest = getScriptureDatabaseDestPath(id);
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || typeof info.size !== "number" || info.size <= 0) return false;
  const installedVer = await readInstalledSchemaVersion(dest);
  return installedVer === SCRIPTURE_SQLITE_SCHEMA_VERSION;
}

function clearOpenPromise(translationId: string): void {
  openPromises.delete(translationId);
}

async function closeOpenedDatabase(translationId: string): Promise<void> {
  const db = openDatabases.get(translationId);
  if (!db) return;
  openDatabases.delete(translationId);
  try {
    await db.closeAsync();
  } catch {
    /* ignore */
  }
}

export async function removeScriptureDatabaseFiles(translationId: string): Promise<void> {
  const dest = getScriptureDatabaseDestPath(translationId);
  await closeOpenedDatabase(translationId);
  clearOpenPromise(translationId);
  try {
    await SQLite.deleteDatabaseAsync(dbFileName(translationId));
  } catch {
    /* 可能尚未打开 */
  }
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.deleteAsync(schemaVersionPath(dest), { idempotent: true });
  await clearRemoteBytesMarker(dest);
}

async function removeInstalledDatabase(dest: string, translationId: string): Promise<void> {
  await removeScriptureDatabaseFiles(translationId);
}

async function bundledAssetByteSize(assetModule: number): Promise<number> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  if (!asset.localUri) return 0;
  const info = await FileSystem.getInfoAsync(asset.localUri);
  return info.exists && typeof info.size === "number" ? info.size : 0;
}

/** 本地已安装译本 SQLite 体积；内置译本无文档副本时回退到安装包 asset 大小。 */
export async function getLocalScriptureTranslationByteSize(translationId: string): Promise<number> {
  const id = String(translationId || "").trim();
  if (!id) return 0;
  const dest = getScriptureDatabaseDestPath(id);
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists && typeof info.size === "number" && info.size > 0) {
    return info.size;
  }
  if (isBundledScriptureTranslation(id)) {
    const assetModule = getBundledScriptureAssetModule(id);
    if (assetModule != null) {
      return bundledAssetByteSize(assetModule);
    }
  }
  return 0;
}

async function copyBundledDatabaseToDisk(
  translationId: string,
  dest: string,
  assetModule: number,
): Promise<void> {
  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });

  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error(`无法从资源包加载圣经数据库：${translationId}`);
  }
  await FileSystem.copyAsync({ from: asset.localUri, to: dest });
  await writeInstalledSchemaVersion(dest, SCRIPTURE_SQLITE_SCHEMA_VERSION);
}

async function ensureDownloadedDatabaseOnDisk(translationId: string): Promise<void> {
  const dest = getScriptureDatabaseDestPath(translationId);
  const info = await FileSystem.getInfoAsync(dest);
  const installedVer = info.exists ? await readInstalledSchemaVersion(dest) : null;
  const destSize = info.exists && typeof info.size === "number" ? info.size : 0;
  if (info.exists && installedVer === SCRIPTURE_SQLITE_SCHEMA_VERSION && destSize > 0) {
    return;
  }
  throw new Error(`译本未下载：${translationId}`);
}

async function ensureBundledDatabaseOnDisk(translationId: string): Promise<void> {
  const assetModule = getBundledScriptureAssetModule(translationId);
  if (assetModule == null) {
    throw new Error(`译本未内置：${translationId}`);
  }

  const dest = getScriptureDatabaseDestPath(translationId);
  const legacyName = `${translationId}.sqlite`;
  const legacyDest = `${FileSystem.documentDirectory}SQLite/${legacyName}`;
  if (legacyName !== dbFileName(translationId)) {
    try {
      await SQLite.deleteDatabaseAsync(legacyName);
    } catch {
      /* ignore */
    }
    await FileSystem.deleteAsync(legacyDest, { idempotent: true });
    await FileSystem.deleteAsync(schemaVersionPath(legacyDest), { idempotent: true });
  }
  const [info, remoteBytes] = await Promise.all([
    FileSystem.getInfoAsync(dest),
    readRemoteBytesMarker(dest),
  ]);
  const installedVer = info.exists ? await readInstalledSchemaVersion(dest) : null;
  const destSize = info.exists && typeof info.size === "number" ? info.size : 0;
  // 内置译本：schema + 非空文件即视为就绪，避免每次 Asset.downloadAsync 探测体积。
  const upToDate =
    info.exists &&
    installedVer === SCRIPTURE_SQLITE_SCHEMA_VERSION &&
    destSize >= 512 * 1024 &&
    (remoteBytes == null || destSize === remoteBytes);

  if (upToDate) {
    return;
  }

  clearOpenPromise(translationId);

  if (info.exists) {
    await removeInstalledDatabase(dest, translationId);
  }

  await copyBundledDatabaseToDisk(translationId, dest, assetModule);
}

/** 打开指定译本 SQLite；内置译本从 assets 复制，其余须已下载到文档目录。 */
export async function getScriptureDatabase(
  translationId: string = DEFAULT_SCRIPTURE_TRANSLATION_ID,
): Promise<SQLite.SQLiteDatabase> {
  const id = String(translationId || "").trim();
  const bundled = isBundledScriptureTranslation(id);
  if (!bundled && !(await isScriptureTranslationInstalled(id))) {
    throw new Error(`译本未下载：${id}`);
  }

  let openPromise = openPromises.get(id);
  if (!openPromise) {
    openPromise = (async () => {
      if (bundled) {
        await ensureBundledDatabaseOnDisk(id);
      } else {
        await ensureDownloadedDatabaseOnDisk(id);
      }
      const db = await SQLite.openDatabaseAsync(dbFileName(id));
      openDatabases.set(id, db);
      return db;
    })();
    openPromises.set(id, openPromise);
  }
  return openPromise;
}

function isNativeDatabaseRejectedError(err: unknown): boolean {
  const message = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    message.includes("nativedatabase.prepareasync") ||
    message.includes("nativedatabase.preparesync") ||
    message.includes("prepareasync") ||
    message.includes("preparesync") ||
    (message.includes("call to function") && message.includes("nativedatabase."))
  );
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
      // 先只重建连接，避免并发查询场景下“删库+重拷贝”导致更多句柄失效。
      await closeOpenedDatabase(id);
      clearOpenPromise(id);
      const reopened = await getScriptureDatabase(id);
      try {
        return await run(reopened);
      } catch (err2) {
        if (!isNativeDatabaseRejectedError(err2)) throw err2;
        const dest = getScriptureDatabaseDestPath(id);
        // 二次失败再执行完整重建（内置译本删库并从 assets 重拷贝）。
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
