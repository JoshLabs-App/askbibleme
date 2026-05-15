const DB_NAME = "selah-device-music-v1";
const DB_VERSION = 1;
const STORE = "tracks";

export type DeviceMusicTrackMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
  addedAt: number;
};

type DeviceMusicTrackRow = DeviceMusicTrackMeta & { blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

export async function addDeviceTrackFromFile(file: File): Promise<string> {
  const db = await openDb();
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const row: DeviceMusicTrackRow = {
    id,
    name: file.name || "Untitled",
    mime: file.type || "application/octet-stream",
    size: file.size,
    addedAt: Date.now(),
    blob: file,
  };
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).add(row));
  db.close();
  return id;
}

export async function listDeviceTracks(): Promise<DeviceMusicTrackMeta[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const rows = (await idbReq(tx.objectStore(STORE).getAll())) as DeviceMusicTrackRow[];
  db.close();
  return rows
    .map(({ id, name, mime, size, addedAt }) => ({ id, name, mime, size, addedAt }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

export async function getDeviceTrackBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const row = (await idbReq(tx.objectStore(STORE).get(id))) as DeviceMusicTrackRow | undefined;
  db.close();
  return row?.blob ?? null;
}

export async function deleteDeviceTrack(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).delete(id));
  db.close();
}

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|opus|webm|flac)$/i;

export function isLikelyAudioFileName(name: string): boolean {
  return AUDIO_EXT.test(name.trim());
}

export async function importAudioFilesFromDirectoryHandle(
  dir: FileSystemDirectoryHandle,
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  const dirAny = dir as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };
  for await (const handle of dirAny.values()) {
    if (handle.kind !== "file") continue;
    const fh = handle as FileSystemFileHandle;
    const name = fh.name ?? "";
    if (!isLikelyAudioFileName(name)) {
      skipped++;
      continue;
    }
    try {
      const file = await fh.getFile();
      await addDeviceTrackFromFile(file);
      imported++;
    } catch {
      skipped++;
    }
  }
  return { imported, skipped };
}
