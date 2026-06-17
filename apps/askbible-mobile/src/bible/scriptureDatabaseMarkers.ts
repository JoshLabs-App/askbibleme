import * as FileSystem from "expo-file-system/legacy";
import {
  remoteBytesMarkerPath,
  schemaVersionPath,
  SCRIPTURE_SQLITE_SCHEMA_VERSION,
} from "./scriptureDatabasePaths";

export async function readInstalledSchemaVersion(dest: string): Promise<number | null> {
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

export async function writeInstalledSchemaVersion(dest: string, version: number): Promise<void> {
  await FileSystem.writeAsStringAsync(schemaVersionPath(dest), String(version));
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

export async function clearRemoteBytesMarker(dest: string): Promise<void> {
  await FileSystem.deleteAsync(remoteBytesMarkerPath(dest), { idempotent: true });
}

export async function markScriptureDatabaseInstalled(dest: string): Promise<void> {
  await writeInstalledSchemaVersion(dest, SCRIPTURE_SQLITE_SCHEMA_VERSION);
}

export { readRemoteBytesMarker };
