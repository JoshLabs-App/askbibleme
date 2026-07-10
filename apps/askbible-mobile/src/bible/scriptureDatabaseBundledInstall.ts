import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
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

async function resolveBundledAssetLocalUri(assetModule: number): Promise<string> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  const localUri = (asset.localUri || asset.uri || "").trim();
  if (!localUri) {
    throw new Error("无法解析内置资源 URI");
  }
  return localUri;
}

function bundledScriptureDatabaseDirectory(): string {
  return new Directory(Paths.document, "SQLite").uri;
}

async function openBundledScriptureDatabase(translationId: string): Promise<SQLite.SQLiteDatabase> {
  const directory = bundledScriptureDatabaseDirectory();
  return SQLite.openDatabaseAsync(dbFileName(translationId), undefined, directory);
}

export async function openBundledScriptureDatabaseByTranslation(
  translationId: string,
): Promise<SQLite.SQLiteDatabase> {
  const assetModule = getBundledScriptureAssetModule(translationId);
  if (assetModule == null) {
    throw new Error(`译本未内置：${translationId}`);
  }
  await ensureBundledDatabaseOnDisk(translationId);
  return openBundledScriptureDatabase(translationId);
}

export async function getLocalScriptureTranslationByteSize(translationId: string): Promise<number> {
  const id = String(translationId || "").trim();
  if (!id) return 0;
  if (isBundledScriptureTranslation(id)) {
    return 1;
  }
  return 0;
}

async function verifyBundledScriptureDatabaseProbe(translationId: string): Promise<void> {
  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = await openBundledScriptureDatabase(translationId);
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

async function copyBundledDatabaseToDisk(
  translationId: string,
  assetModule: number,
): Promise<void> {
  const localUri = await resolveBundledAssetLocalUri(assetModule);
  const dest = getScriptureDatabaseDestPath(translationId);
  const dir = new Directory(Paths.document, "SQLite");
  try {
    dir.create({ intermediates: true });
  } catch {
    /* ignore */
  }
  const bytes = await new File(localUri).bytes();
  new File(dest).write(bytes);
  await verifyBundledScriptureDatabaseProbe(translationId);
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
  const legacyDest = `${new Directory(Paths.document, "SQLite").uri}/${legacyName}`;
  if (legacyName !== dbFileName(translationId)) {
    try {
      await SQLite.deleteDatabaseAsync(legacyName);
    } catch {
      /* ignore */
    }
    try {
      new File(legacyDest).delete();
    } catch {
      /* ignore */
    }
    try {
      new File(schemaVersionPath(legacyDest)).delete();
    } catch {
      /* ignore */
    }
  }
  const installedVer = await readInstalledSchemaVersion(dest);
  const upToDate = installedVer === SCRIPTURE_SQLITE_SCHEMA_VERSION;

  if (upToDate) {
    try {
      await verifyBundledScriptureDatabaseProbe(translationId);
      return;
    } catch {
      clearOpenPromise(translationId);
      await removeInstalledDatabase(dest, translationId);
    }
  } else {
    clearOpenPromise(translationId);
    await removeInstalledDatabase(dest, translationId);
  }

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
