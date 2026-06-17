import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import { isBundledScriptureTranslation } from "./bundled-scripture-translations";
import { clearRemoteBytesMarker, readInstalledSchemaVersion } from "./scriptureDatabaseMarkers";
import { dbFileName, schemaVersionPath, SCRIPTURE_SQLITE_SCHEMA_VERSION } from "./scriptureDatabasePaths";

export function getScriptureDatabaseDestPath(translationId: string): string {
  return `${FileSystem.documentDirectory}SQLite/${dbFileName(translationId)}`;
}

const openPromises = new Map<string, Promise<SQLite.SQLiteDatabase>>();
const openDatabases = new Map<string, SQLite.SQLiteDatabase>();
const operationTails = new Map<string, Promise<void>>();

export function enqueueScriptureDbOperation<T>(translationId: string, work: () => Promise<T>): Promise<T> {
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

export function clearOpenPromise(translationId: string): void {
  openPromises.delete(translationId);
}

export function getOpenPromise(translationId: string): Promise<SQLite.SQLiteDatabase> | undefined {
  return openPromises.get(translationId);
}

export function setOpenPromise(translationId: string, promise: Promise<SQLite.SQLiteDatabase>): void {
  openPromises.set(translationId, promise);
}

export async function closeOpenedDatabase(translationId: string): Promise<void> {
  const db = openDatabases.get(translationId);
  if (!db) return;
  openDatabases.delete(translationId);
  try {
    await db.closeAsync();
  } catch {
    /* ignore */
  }
}

export function trackOpenedDatabase(translationId: string, db: SQLite.SQLiteDatabase): void {
  openDatabases.set(translationId, db);
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

export async function removeInstalledDatabase(dest: string, translationId: string): Promise<void> {
  await removeScriptureDatabaseFiles(translationId);
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

const warmedSearchTranslationIds = new Set<string>();

export function hasWarmedSearchTranslation(id: string): boolean {
  return warmedSearchTranslationIds.has(id);
}

export function markWarmedSearchTranslation(id: string): void {
  warmedSearchTranslationIds.add(id);
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

export { isNativeDatabaseRejectedError };
