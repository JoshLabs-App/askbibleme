import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import {
  deleteDatabaseAsync,
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";
import { getBundledScriptureAssetModule, isBundledScriptureTranslation } from "./bundled-scripture-translations";
import { markScriptureDatabaseInstalled, readInstalledSchemaVersion } from "./scriptureDatabaseMarkers";
import { dbFileName, schemaVersionPath, SCRIPTURE_SQLITE_SCHEMA_VERSION } from "./scriptureDatabasePaths";
import {
  clearOpenPromise,
  closeOpenedDatabase,
  getScriptureDatabaseDestPath,
  removeInstalledDatabase,
  removeScriptureDatabaseFiles,
} from "./scriptureDatabaseSession";

async function resolveBundledAsset(assetModule: number): Promise<{ localUri: string; size: number }> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  const localUri = (asset.localUri || asset.uri || "").trim();
  if (!localUri) {
    throw new Error("无法解析内置资源 URI");
  }
  const info = await FileSystem.getInfoAsync(localUri);
  const size = info.exists && typeof info.size === "number" ? info.size : 0;
  if (size < 1_000) {
    throw new Error("内置圣经资源无效或过小");
  }
  return { localUri, size };
}

export async function openBundledScriptureDatabaseByTranslation(
  translationId: string,
): Promise<SQLiteDatabase> {
  const assetModule = getBundledScriptureAssetModule(translationId);
  if (assetModule == null) {
    throw new Error(`译本未内置：${translationId}`);
  }
  await ensureBundledDatabaseOnDisk(translationId);
  return openDatabaseAsync(dbFileName(translationId), { useNewConnection: true });
}

export async function getLocalScriptureTranslationByteSize(translationId: string): Promise<number> {
  const id = String(translationId || "").trim();
  if (!id) return 0;
  if (isBundledScriptureTranslation(id)) {
    return 1;
  }
  return 0;
}

/** 只比对文件尺寸，不在安装路径里 open/close（Android 上易触发 prepareAsync NPE）。 */
async function assertBundledDatabaseFileReady(
  translationId: string,
  expectedSize: number,
): Promise<void> {
  const dest = getScriptureDatabaseDestPath(translationId);
  const info = await FileSystem.getInfoAsync(dest);
  const size = info.exists && typeof info.size === "number" ? info.size : 0;
  if (!info.exists || size < 1_000) {
    throw new Error(`内置圣经数据库缺失或过小：${translationId}`);
  }
  if (expectedSize > 0 && size !== expectedSize) {
    throw new Error(`内置圣经数据库大小不匹配：${translationId}`);
  }
}

async function copyBundledDatabaseToDisk(
  translationId: string,
  assetModule: number,
): Promise<void> {
  const { size } = await resolveBundledAsset(assetModule);
  const dest = getScriptureDatabaseDestPath(translationId);
  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  // 走 expo-sqlite 官方 asset 导入，避免 Android 上自管 copy + 连接复用触发 prepareAsync NPE。
  await importDatabaseFromAssetAsync(dbFileName(translationId), {
    assetId: assetModule,
    forceOverwrite: true,
  });
  await assertBundledDatabaseFileReady(translationId, size);
  await markScriptureDatabaseInstalled(dest);
}

const bundledInstallPromises = new Map<string, Promise<void>>();

async function ensureBundledDatabaseOnDiskInner(translationId: string): Promise<void> {
  const assetModule = getBundledScriptureAssetModule(translationId);
  if (assetModule == null) {
    throw new Error(`译本未内置：${translationId}`);
  }

  const dest = getScriptureDatabaseDestPath(translationId);
  const legacyName = `${translationId}.sqlite`;
  const legacyDest = `${FileSystem.documentDirectory}SQLite/${legacyName}`;
  if (legacyName !== dbFileName(translationId)) {
    try {
      await deleteDatabaseAsync(legacyName);
    } catch {
      /* ignore */
    }
    await FileSystem.deleteAsync(legacyDest, { idempotent: true });
    await FileSystem.deleteAsync(schemaVersionPath(legacyDest), { idempotent: true });
  }
  const { size: bundledSize } = await resolveBundledAsset(assetModule);
  const installedVer = await readInstalledSchemaVersion(dest);
  const destInfo = await FileSystem.getInfoAsync(dest);
  const destSize = destInfo.exists && typeof destInfo.size === "number" ? destInfo.size : 0;
  const upToDate =
    installedVer === SCRIPTURE_SQLITE_SCHEMA_VERSION &&
    destSize > 0 &&
    destSize === bundledSize;

  if (upToDate) return;

  clearOpenPromise(translationId);
  await removeInstalledDatabase(dest, translationId);
  await copyBundledDatabaseToDisk(translationId, assetModule);
}

/** 串行化 assets → 文档目录复制，避免 Android 并发复制损坏 sqlite。 */
export async function ensureBundledDatabaseOnDisk(translationId: string): Promise<void> {
  const id = String(translationId || "").trim();
  let pending = bundledInstallPromises.get(id);
  if (!pending) {
    pending = ensureBundledDatabaseOnDiskInner(id).finally(() => {
      if (bundledInstallPromises.get(id) === pending) {
        bundledInstallPromises.delete(id);
      }
    });
    bundledInstallPromises.set(id, pending);
  }
  await pending;
}

export async function ensureDownloadedDatabaseOnDisk(translationId: string): Promise<void> {
  const dest = getScriptureDatabaseDestPath(translationId);
  const installedVer = await readInstalledSchemaVersion(dest);
  if (installedVer === SCRIPTURE_SQLITE_SCHEMA_VERSION) {
    return;
  }
  throw new Error(`译本未下载：${translationId}`);
}

export async function rebuildBundledScriptureDatabaseInner(translationId: string): Promise<void> {
  const id = String(translationId || "").trim();
  if (!isBundledScriptureTranslation(id)) return;
  await closeOpenedDatabase(id);
  clearOpenPromise(id);
  await removeScriptureDatabaseFiles(id);
  await ensureBundledDatabaseOnDisk(id);
}
