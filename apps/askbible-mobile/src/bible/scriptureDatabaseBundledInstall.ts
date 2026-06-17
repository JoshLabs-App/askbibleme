import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { getBundledScriptureAssetModule, isBundledScriptureTranslation } from "./bundled-scripture-translations";
import {
  clearRemoteBytesMarker,
  markScriptureDatabaseInstalled,
  readInstalledSchemaVersion,
} from "./scriptureDatabaseMarkers";
import { dbFileName, schemaVersionPath, SCRIPTURE_SQLITE_SCHEMA_VERSION } from "./scriptureDatabasePaths";
import {
  clearOpenPromise,
  closeOpenedDatabase,
  getScriptureDatabaseDestPath,
  removeInstalledDatabase,
  removeScriptureDatabaseFiles,
} from "./scriptureDatabaseSession";

async function fileByteSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === "number" ? info.size : 0;
}

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

  await markScriptureDatabaseInstalled(dest);
  await clearRemoteBytesMarker(dest);
  await verifyBundledScriptureDatabaseProbe(translationId);
}

export async function ensureBundledDatabaseOnDisk(translationId: string): Promise<void> {
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

export async function ensureDownloadedDatabaseOnDisk(translationId: string): Promise<void> {
  const dest = getScriptureDatabaseDestPath(translationId);
  const info = await FileSystem.getInfoAsync(dest);
  const installedVer = info.exists ? await readInstalledSchemaVersion(dest) : null;
  const destSize = info.exists && typeof info.size === "number" ? info.size : 0;
  if (info.exists && installedVer === SCRIPTURE_SQLITE_SCHEMA_VERSION && destSize > 0) {
    return;
  }
  throw new Error(`译本未下载：${translationId}`);
}

export async function rebuildBundledScriptureDatabase(translationId: string): Promise<void> {
  const id = String(translationId || "").trim();
  if (!isBundledScriptureTranslation(id)) return;
  await closeOpenedDatabase(id);
  clearOpenPromise(id);
  await removeScriptureDatabaseFiles(id);
  await ensureBundledDatabaseOnDisk(id);
}
