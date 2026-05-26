import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";

const XREF_DB_NAME = "scripture-xrefs.sqlite";
const XREF_SCHEMA_VERSION = 1;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XREF_ASSET = require("../../assets/scripture/scripture-xrefs.sqlite");

let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let openedDatabase: SQLite.SQLiteDatabase | null = null;

function schemaVersionPath(dest: string): string {
  return `${dest}.schema-version`;
}

async function ensureXrefDatabaseOnDisk(): Promise<void> {
  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  const dest = `${sqliteDir}/${XREF_DB_NAME}`;

  const asset = Asset.fromModule(XREF_ASSET);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error("无法从资源包加载 scripture-xrefs.sqlite");
  }

  const [info, bundledInfo] = await Promise.all([
    FileSystem.getInfoAsync(dest),
    FileSystem.getInfoAsync(asset.localUri),
  ]);
  const bundledSize = bundledInfo.exists && typeof bundledInfo.size === "number" ? bundledInfo.size : 0;
  const destSize = info.exists && typeof info.size === "number" ? info.size : 0;

  let installedVer: number | null = null;
  const verPath = schemaVersionPath(dest);
  const verInfo = await FileSystem.getInfoAsync(verPath);
  if (verInfo.exists) {
    try {
      const raw = await FileSystem.readAsStringAsync(verPath);
      const n = Number(String(raw).trim());
      installedVer = Number.isInteger(n) ? n : null;
    } catch {
      installedVer = null;
    }
  }

  const upToDate =
    info.exists &&
    installedVer === XREF_SCHEMA_VERSION &&
    bundledSize > 0 &&
    destSize === bundledSize;

  if (upToDate) return;

  if (info.exists) {
    try {
      await SQLite.deleteDatabaseAsync(XREF_DB_NAME);
    } catch {
      /* ignore */
    }
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.deleteAsync(verPath, { idempotent: true });
  }

  await FileSystem.copyAsync({ from: asset.localUri, to: dest });
  await FileSystem.writeAsStringAsync(verPath, String(XREF_SCHEMA_VERSION));
}

async function closeOpenedXrefDatabase(): Promise<void> {
  const db = openedDatabase;
  openedDatabase = null;
  if (!db) return;
  try {
    await db.closeAsync();
  } catch {
    /* ignore */
  }
}

/** Open curated cross-reference SQLite (bundled asset). */
export async function getScriptureXrefDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  try {
    if (!openPromise) {
      openPromise = (async () => {
        await ensureXrefDatabaseOnDisk();
        const db = await SQLite.openDatabaseAsync(XREF_DB_NAME);
        openedDatabase = db;
        return db;
      })();
    }
    return await openPromise;
  } catch {
    return null;
  }
}

function isNativeDatabaseRejectedError(err: unknown): boolean {
  const message = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    message.includes("nativedatabase.prepareasync") ||
    message.includes("prepareasync") ||
    (message.includes("call to function") && message.includes("nativedatabase."))
  );
}

export async function retryScriptureXrefDatabaseOnPrepareError<T>(
  run: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T | null> {
  const firstDb = await getScriptureXrefDatabase();
  if (!firstDb) return null;
  try {
    return await run(firstDb);
  } catch (err) {
    if (!isNativeDatabaseRejectedError(err)) throw err;
    await closeOpenedXrefDatabase();
    openPromise = null;
    await ensureXrefDatabaseOnDisk();
    const reopened = await getScriptureXrefDatabase();
    if (!reopened) return null;
    return run(reopened);
  }
}
