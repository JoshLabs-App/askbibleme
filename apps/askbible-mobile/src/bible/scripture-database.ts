import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { getBundledScriptureAssetModule, isBundledScriptureTranslation } from "./bundled-scripture-translations";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "./types";

/**
 * 与主仓库 `askbible-scripture-sqlite-v3`（含 theme_repeat_count）对齐；升级后须递增。
 * v5: 强制刷新设备侧已安装 sqlite，确保经文源文本修订（如个别汉字显示异常修复）能落地。
 * v6: 强制刷新说话标注修订（四福音神言/人话纠偏）。
 * v7: Android 内置 sqlite 复制校验 + 可读性探针，修复简体/繁体「无法读取本章」。
 */
export const SCRIPTURE_SQLITE_SCHEMA_VERSION = 7;

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

async function fileByteSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === "number" ? info.size : 0;
}

/** Android release 上 `Asset.fromModule().localUri` 偶发不可 copy；与章朗读/音乐播放一致走 loadAsync。 */
async function resolveBundledAssetLocalUri(assetModule: number): Promise<string> {
  if (Platform.OS === "android") {
    try {
      const [asset] = await Asset.loadAsync(assetModule);
      const localUri = (asset?.localUri || asset?.uri || "").trim();
      if (localUri) return localUri;
    } catch {
      /* fall through */
    }
  }
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  const localUri = (asset.localUri || asset.uri || "").trim();
  if (!localUri) {
    throw new Error("无法解析内置资源 URI");
  }
  return localUri;
}

async function bundledAssetByteSize(assetModule: number): Promise<number> {
  try {
    const localUri = await resolveBundledAssetLocalUri(assetModule);
    return fileByteSize(localUri);
  } catch {
    return 0;
  }
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

async function copyFilePreservingBytes(from: string, to: string, expectedSize: number): Promise<void> {
  try {
    await FileSystem.copyAsync({ from, to });
    const copiedSize = await fileByteSize(to);
    if (copiedSize === expectedSize) return;
    await FileSystem.deleteAsync(to, { idempotent: true });
  } catch {
    await FileSystem.deleteAsync(to, { idempotent: true });
  }

  if (Platform.OS === "android") {
    const base64 = await FileSystem.readAsStringAsync(from, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(to, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const copiedSize = await fileByteSize(to);
    if (copiedSize === expectedSize) return;
    await FileSystem.deleteAsync(to, { idempotent: true });
  }

  throw new Error("复制失败");
}

async function verifyBundledScriptureDatabaseProbe(translationId: string): Promise<void> {
  const name = dbFileName(translationId);
  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = await SQLite.openDatabaseAsync(name);
    const row = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) AS c FROM verse WHERE book_id = ? AND chapter = ?",
      "GEN",
      1,
    );
    if (Number(row?.c ?? 0) < 1) {
      throw new Error(`内置圣经数据库无可读经文：${translationId}`);
    }
  } finally {
    if (db) {
      try {
        await db.closeAsync();
      } catch {
        /* ignore */
      }
    }
  }
}

/** 删库并从 APK 内 asset 重拷（简体/繁体读章失败时由 load-chapter 调用）。 */
export async function rebuildBundledScriptureDatabase(translationId: string): Promise<void> {
  const id = String(translationId || "").trim();
  if (!isBundledScriptureTranslation(id)) return;
  await closeOpenedDatabase(id);
  clearOpenPromise(id);
  await removeScriptureDatabaseFiles(id);
  await ensureBundledDatabaseOnDisk(id);
}

async function copyBundledDatabaseToDisk(
  translationId: string,
  dest: string,
  assetModule: number,
): Promise<void> {
  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });

  const localUri = await resolveBundledAssetLocalUri(assetModule);
  const bundledSize = await fileByteSize(localUri);
  if (bundledSize < 512 * 1024) {
    throw new Error(`无法从资源包加载圣经数据库：${translationId}`);
  }

  await copyFilePreservingBytes(localUri, dest, bundledSize);

  await writeInstalledSchemaVersion(dest, SCRIPTURE_SQLITE_SCHEMA_VERSION);
  await clearRemoteBytesMarker(dest);
  await verifyBundledScriptureDatabaseProbe(translationId);
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
  const bundledSize = await bundledAssetByteSize(assetModule);
  const info = await FileSystem.getInfoAsync(dest);
  const installedVer = info.exists ? await readInstalledSchemaVersion(dest) : null;
  const destSize = info.exists && typeof info.size === "number" ? info.size : 0;
  // 内置译本：设备副本须与 APK 内 asset 字节一致（xref DB 同策略），避免 Android 上 copy 截断仍被误判为就绪。
  const upToDate =
    info.exists &&
    installedVer === SCRIPTURE_SQLITE_SCHEMA_VERSION &&
    bundledSize >= 512 * 1024 &&
    destSize === bundledSize;

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

const warmedSearchTranslationIds = new Set<string>();

/** 打开译本 SQLite 并执行轻量查询，缩短首次搜索冷启动。 */
export async function warmScriptureSearchDatabase(
  translationId: string = DEFAULT_SCRIPTURE_TRANSLATION_ID,
): Promise<void> {
  const id = String(translationId || "").trim();
  if (!id || warmedSearchTranslationIds.has(id)) return;
  if (!(await isScriptureTranslationInstalled(id))) return;
  try {
    await retryScriptureDatabaseOnPrepareError(id, (db) =>
      db.getFirstAsync<{ ok: number }>("SELECT 1 AS ok LIMIT 1"),
    );
    warmedSearchTranslationIds.add(id);
  } catch {
    /* warmup best-effort */
  }
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
