import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";

/**
 * 随包的「查找资料 / 陪你探索」内容库。
 *
 * 原先是 assets/content/info-edition-v1-published.json（22.5MB），在模块顶层
 * `require()` 同步解析——为显示一章而把全本 4761 章驻留内存（Hermes 实测解析 34ms、
 * 常驻约 27MB，手机更慢），且解析期间 JS 线程被阻塞，界面无法响应。
 * 改成按 key 查一行后内存几乎为零，也不再有同步大解析。
 *
 * 加载与重试策略照搬 scripture-xref-database.ts：先换连接、失败才重建库，
 * 避免一遇原生句柄失效就删库重装引发连接风暴。
 */

const INFO_EDITION_DB_NAME = "info_edition.sqlite";
const INFO_EDITION_SCHEMA_VERSION = 1;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const INFO_EDITION_ASSET = require("../../assets/content/info-edition.sqlite");

let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let openedDatabase: SQLite.SQLiteDatabase | null = null;
let operationTail: Promise<void> = Promise.resolve();

/** 串行化数据库操作：并发读时反复重连会互相打断。 */
function enqueueInfoEditionDbOperation<T>(work: () => Promise<T>): Promise<T> {
  const run = operationTail.catch(() => undefined).then(work);
  operationTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function schemaVersionPath(dest: string): string {
  return `${dest}.schema-version`;
}

async function ensureInfoEditionDatabaseOnDisk(): Promise<void> {
  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  const dest = `${sqliteDir}/${INFO_EDITION_DB_NAME}`;

  const asset = Asset.fromModule(INFO_EDITION_ASSET);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("无法从资源包加载 info-edition.sqlite");

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

  /** 版本号与字节数都对得上才算就绪；换包后字节数会变，自然触发重装。 */
  const upToDate =
    info.exists && installedVer === INFO_EDITION_SCHEMA_VERSION && bundledSize > 0 && destSize === bundledSize;
  if (upToDate) return;

  if (info.exists) {
    try {
      await SQLite.deleteDatabaseAsync(INFO_EDITION_DB_NAME);
    } catch {
      /* ignore */
    }
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.deleteAsync(verPath, { idempotent: true });
  }

  await FileSystem.copyAsync({ from: asset.localUri, to: dest });
  await FileSystem.writeAsStringAsync(verPath, String(INFO_EDITION_SCHEMA_VERSION));
}

async function closeOpenedInfoEditionDatabase(): Promise<void> {
  const db = openedDatabase;
  openedDatabase = null;
  if (!db) return;
  try {
    await db.closeAsync();
  } catch {
    /* ignore */
  }
}

export async function getInfoEditionDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  try {
    if (!openPromise) {
      openPromise = (async () => {
        await ensureInfoEditionDatabaseOnDisk();
        const db = await SQLite.openDatabaseAsync(INFO_EDITION_DB_NAME);
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
    message.includes("nativedatabase.preparesync") ||
    message.includes("prepareasync") ||
    message.includes("preparesync") ||
    (message.includes("call to function") && message.includes("nativedatabase."))
  );
}

/** 与译本 / xref 库同一套分级重试：先换连接，仍失败才重装。 */
export async function retryInfoEditionDatabaseOnPrepareError<T>(
  run: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T | null> {
  return enqueueInfoEditionDbOperation(async () => {
    const firstDb = await getInfoEditionDatabase();
    if (!firstDb) return null;
    try {
      return await run(firstDb);
    } catch (err) {
      if (!isNativeDatabaseRejectedError(err)) throw err;
      await closeOpenedInfoEditionDatabase();
      openPromise = null;
      const reopened = await getInfoEditionDatabase();
      if (!reopened) return null;
      try {
        return await run(reopened);
      } catch (err2) {
        if (!isNativeDatabaseRejectedError(err2)) throw err2;
        await closeOpenedInfoEditionDatabase();
        openPromise = null;
        await ensureInfoEditionDatabaseOnDisk();
        const rebuilt = await getInfoEditionDatabase();
        if (!rebuilt) return null;
        return run(rebuilt);
      }
    }
  });
}

let infoEditionWarmed = false;

/** 轻量查询预热，缩短进读经页后首次取资料的耗时。 */
export async function warmInfoEditionDatabase(): Promise<void> {
  if (infoEditionWarmed) return;
  try {
    await retryInfoEditionDatabaseOnPrepareError(async (db) => {
      await db.getFirstAsync<{ ok: number }>("SELECT 1 AS ok LIMIT 1");
      return { ok: 1 };
    });
    infoEditionWarmed = true;
  } catch {
    /* warmup best-effort */
  }
}
