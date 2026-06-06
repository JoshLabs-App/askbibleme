import * as FileSystem from "expo-file-system/legacy";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isBundledScriptureTranslation } from "./bundled-scripture-translations";
import {
  getScriptureDatabaseDestPath,
  isScriptureTranslationInstalled,
  markScriptureDatabaseInstalled,
  removeScriptureDatabaseFiles,
} from "./scripture-database";

export type ScriptureTranslationDownloadStatus = "idle" | "running" | "done" | "error";

export type ScriptureTranslationDownloadState = {
  translationId: string | null;
  status: ScriptureTranslationDownloadStatus;
  percent: number;
  error: string | null;
};

const listeners = new Set<() => void>();

let state: ScriptureTranslationDownloadState = {
  translationId: null,
  status: "idle",
  percent: 0,
  error: null,
};

let activeDownload: FileSystem.DownloadResumable | null = null;

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function setState(next: Partial<ScriptureTranslationDownloadState>) {
  state = { ...state, ...next };
  emit();
}

export function readScriptureTranslationDownloadState(): ScriptureTranslationDownloadState {
  return state;
}

export function subscribeScriptureTranslationDownload(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

function buildDownloadUrl(translationId: string, downloadUrl?: string | null): string {
  const rel = String(downloadUrl || "").trim();
  const base = getAskBibleBaseUrl().replace(/\/+$/, "");
  if (rel.startsWith("http://") || rel.startsWith("https://")) return rel;
  const path = rel || `/api/mobile/bible/translations/${encodeURIComponent(translationId)}/sqlite`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** 下载非内置译本 SQLite 到设备文档目录。 */
export async function downloadScriptureTranslation(
  translationId: string,
  downloadUrl?: string | null,
): Promise<void> {
  const id = String(translationId || "").trim();
  if (!id) throw new Error("译本 id 无效");
  if (isBundledScriptureTranslation(id)) return;
  if (await isScriptureTranslationInstalled(id)) return;

  if (state.status === "running" && state.translationId === id) {
    return;
  }

  if (activeDownload) {
    try {
      await activeDownload.pauseAsync();
    } catch {
      /* ignore */
    }
    activeDownload = null;
  }

  const dest = getScriptureDatabaseDestPath(id);
  const tmp = `${dest}.download`;
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}SQLite`, { intermediates: true });
  await FileSystem.deleteAsync(tmp, { idempotent: true });

  setState({ translationId: id, status: "running", percent: 0, error: null });

  const url = buildDownloadUrl(id, downloadUrl);
  const resumable = FileSystem.createDownloadResumable(
    url,
    tmp,
    {},
    (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      const pct =
        total > 0 ? Math.min(100, Math.floor((progress.totalBytesWritten / total) * 100)) : 0;
      setState({ percent: pct });
    },
  );
  activeDownload = resumable;

  try {
    const result = await resumable.downloadAsync();
    activeDownload = null;
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`下载失败（HTTP ${result?.status ?? "?"}）`);
    }
    await removeScriptureDatabaseFiles(id);
    await FileSystem.moveAsync({ from: tmp, to: dest });
    await markScriptureDatabaseInstalled(dest);
    setState({ translationId: id, status: "done", percent: 100, error: null });
  } catch (e) {
    activeDownload = null;
    await FileSystem.deleteAsync(tmp, { idempotent: true });
    const msg = e instanceof Error ? e.message : String(e);
    setState({ translationId: id, status: "error", error: msg });
    throw e;
  }
}

/** 删除已下载的非内置译本（内置译本不可删）。 */
export async function removeDownloadedScriptureTranslation(translationId: string): Promise<void> {
  const id = String(translationId || "").trim();
  if (!id || isBundledScriptureTranslation(id)) return;
  await removeScriptureDatabaseFiles(id);
  if (state.translationId === id) {
    setState({ translationId: null, status: "idle", percent: 0, error: null });
  }
}

export async function ensureScriptureTranslationReady(
  translationId: string,
  downloadUrl?: string | null,
): Promise<void> {
  if (await isScriptureTranslationInstalled(translationId)) return;
  await downloadScriptureTranslation(translationId, downloadUrl);
}
