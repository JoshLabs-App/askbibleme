import * as FileSystem from "expo-file-system/legacy";
import {
  BUNDLED_SCRIPTURE_TRANSLATION_IDS,
  isBundledScriptureTranslation,
} from "./bundled-scripture-translations";
import { isMobileOfflineFirst } from "../config/mobileBundledOnly";
import {
  getScriptureDatabase,
  getScriptureDatabaseDestPath,
  isScriptureTranslationInstalled,
  markScriptureDatabaseInstalled,
  removeScriptureDatabaseFiles,
  writeRemoteScriptureBytesMarker,
} from "./scripture-database";
import type { BibleTranslationMeta } from "./translations-types";

export type ScriptureTranslationDownloadStatus = "idle" | "running" | "done" | "error";

export type ScriptureTranslationDownloadState = {
  translationId: string | null;
  status: ScriptureTranslationDownloadStatus;
  percent: number;
  error: string | null;
};

const DOWNLOAD_TIMEOUT_MS = 45_000;

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

/** 仅接受显式绝对 URL；主站 `/api/mobile/bible/translations/.../sqlite` 已下线，不再拼默认地址。 */
function resolveExternalDownloadUrl(downloadUrl?: string | null): string | null {
  const rel = String(downloadUrl || "").trim();
  if (!rel) return null;
  if (rel.startsWith("http://") || rel.startsWith("https://")) {
    if (/\/api\/mobile\/bible\/translations\/[^/]+\/sqlite\/?$/i.test(rel)) return null;
    return rel;
  }
  return null;
}

/** 下载译本 SQLite 到设备文档目录；`force` 用于覆盖已有文件。主站整本包已下线。 */
export async function downloadScriptureTranslation(
  translationId: string,
  downloadUrl?: string | null,
  options?: { force?: boolean },
): Promise<void> {
  const id = String(translationId || "").trim();
  if (!id) throw new Error("译本 id 无效");
  const force = Boolean(options?.force);
  if (!force && isBundledScriptureTranslation(id)) return;
  if (!force && (await isScriptureTranslationInstalled(id))) return;
  const url = resolveExternalDownloadUrl(downloadUrl);
  if (!url) {
    throw new Error("此译本不支持整本下载");
  }

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
    let downloadTimer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      resumable.downloadAsync(),
      new Promise<null>((resolve) => {
        downloadTimer = setTimeout(() => resolve(null), DOWNLOAD_TIMEOUT_MS);
      }),
    ]).finally(() => {
      if (downloadTimer) clearTimeout(downloadTimer);
    });
    if (!result) {
      try {
        await resumable.pauseAsync();
      } catch {
        /* ignore */
      }
      activeDownload = null;
      throw new Error("译本下载超时");
    }
    activeDownload = null;
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`下载失败（HTTP ${result?.status ?? "?"}）`);
    }
    await removeScriptureDatabaseFiles(id);
    await FileSystem.moveAsync({ from: tmp, to: dest });
    await markScriptureDatabaseInstalled(dest);
    const installedInfo = await FileSystem.getInfoAsync(dest);
    if (installedInfo.exists && typeof installedInfo.size === "number" && installedInfo.size > 0) {
      await writeRemoteScriptureBytesMarker(dest, installedInfo.size);
    }
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
  options?: { delivery?: BibleTranslationMeta["delivery"] },
): Promise<void> {
  const id = String(translationId || "").trim();
  if (!id) throw new Error("译本 id 无效");
  if (isBundledScriptureTranslation(id)) {
    await getScriptureDatabase(id);
    if (state.status === "error") {
      setState({ translationId: null, status: "idle", percent: 0, error: null });
    }
    return;
  }
  // 按章在线：无整本 sqlite，不下载。
  if (options?.delivery === "chapter-api") {
    if (state.status === "error") {
      setState({ translationId: null, status: "idle", percent: 0, error: null });
    }
    return;
  }
  if (await isScriptureTranslationInstalled(id)) {
    if (state.status === "error") {
      setState({ translationId: null, status: "idle", percent: 0, error: null });
    }
    return;
  }
  const externalUrl = resolveExternalDownloadUrl(downloadUrl);
  if (!externalUrl) {
    throw new Error(isMobileOfflineFirst() ? "译本未安装" : "此译本不支持整本下载");
  }
  if (isMobileOfflineFirst()) {
    throw new Error("译本未安装");
  }
  await downloadScriptureTranslation(id, externalUrl);
}

/** 联网下载失败时回退到安装包内译本，避免读经页空白。 */
export async function ensureScriptureTranslationReadyWithFallback(
  translationId: string,
  downloadUrl?: string | null,
): Promise<string> {
  const id = String(translationId || "").trim() || "cuv-simp";
  if (isMobileOfflineFirst()) {
    try {
      if (isBundledScriptureTranslation(id)) {
        await ensureScriptureTranslationReady(id);
        return id;
      }
      if (await isScriptureTranslationInstalled(id)) return id;
    } catch {
      /* fall through to bundled fallbacks */
    }
    for (const fallbackId of BUNDLED_SCRIPTURE_TRANSLATION_IDS) {
      try {
        await ensureScriptureTranslationReady(fallbackId);
        return fallbackId;
      } catch {
        /* try next bundled translation */
      }
    }
    try {
      await ensureScriptureTranslationReady("cuv-simp");
    } catch {
      /* loadChapter will surface chapterLoadError */
    }
    return "cuv-simp";
  }
  try {
    await ensureScriptureTranslationReady(id, downloadUrl);
    return id;
  } catch {
    for (const fallbackId of BUNDLED_SCRIPTURE_TRANSLATION_IDS) {
      if (fallbackId === id) continue;
      try {
        await ensureScriptureTranslationReady(fallbackId);
        return fallbackId;
      } catch {
        /* try next bundled translation */
      }
    }
    try {
      await ensureScriptureTranslationReady("cuv-simp");
    } catch {
      /* loadChapter will surface chapterLoadError */
    }
    return "cuv-simp";
  }
}

/** 仅预热主译本（~5MB），避免首次进读经时复制全部 3 个内置 sqlite（~15MB）。 */
const preloadTranslationPromises = new Map<string, Promise<void>>();

export async function preloadPrimaryScriptureTranslation(translationId: string): Promise<void> {
  const id = String(translationId || "").trim();
  if (!isBundledScriptureTranslation(id)) return;
  const pending = preloadTranslationPromises.get(id);
  if (pending) return pending;
  const work = getScriptureDatabase(id)
    .catch(() => undefined)
    .then(() => undefined);
  preloadTranslationPromises.set(id, work);
  try {
    await work;
  } finally {
    preloadTranslationPromises.delete(id);
  }
}

export async function preloadBundledScriptureTranslations(): Promise<void> {
  await Promise.all(
    BUNDLED_SCRIPTURE_TRANSLATION_IDS.map((id) =>
      getScriptureDatabase(id).catch(() => undefined),
    ),
  );
}
