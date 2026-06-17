import * as FileSystem from "expo-file-system/legacy";
import {
  chapterFileUri,
  chapterRefsForSelection,
  ensurePackageDir,
  isChapterFileReady,
  packageKeyForSelection,
} from "./readAudioPackageDownloadPaths";
import type { AudioPackageSelection } from "./readAudioPackageDownloadStore";
import {
  emitDownloadState,
  hydrateDownloadState,
  patchPersistedDownloadState,
  persistDownloadState,
  readPersistedDownloadState,
  writePersistedDownloadState,
} from "./readAudioPackageDownloadStore";

let currentDownload: FileSystem.DownloadResumable | null = null;
let runToken = 0;

async function pauseCurrentInternal(): Promise<void> {
  const active = currentDownload;
  if (!active) return;
  const state = readPersistedDownloadState();
  try {
    const paused = await active.pauseAsync();
    if (state.currentRefKey) {
      patchPersistedDownloadState({
        resumeRefKey: state.currentRefKey,
        resumeData: paused.resumeData ?? null,
      });
    }
  } catch {
    /* ignore */
  } finally {
    currentDownload = null;
    const next = readPersistedDownloadState();
    if (next.status === "running") {
      patchPersistedDownloadState({ status: "paused" });
      await persistDownloadState();
      emitDownloadState();
    }
  }
}

export async function pauseAudioPackageDownload(): Promise<void> {
  await hydrateDownloadState();
  await pauseCurrentInternal();
}

async function markDone(refKey: string, index: number): Promise<void> {
  const state = readPersistedDownloadState();
  const doneRefs = state.doneRefs.includes(refKey) ? state.doneRefs : [...state.doneRefs, refKey];
  patchPersistedDownloadState({
    doneRefs,
    completed: doneRefs.length,
    nextIndex: Math.max(state.nextIndex, index + 1),
    currentPercent: 0,
  });
  await persistDownloadState();
  emitDownloadState();
}

async function startDownloadRun(selection: AudioPackageSelection): Promise<void> {
  await hydrateDownloadState();
  runToken += 1;
  const token = runToken;
  const packageKey = packageKeyForSelection(selection);
  const refs = chapterRefsForSelection(selection);
  if (refs.length === 0) {
    writePersistedDownloadState({
      ...readPersistedDownloadState(),
      packageKey,
      label: selection.label,
      status: "error",
      total: 0,
      completed: 0,
      nextIndex: 0,
      doneRefs: [],
      currentRefKey: null,
      currentPercent: 0,
      resumeRefKey: null,
      resumeData: null,
      error: "没有可下载的音频文件",
    });
    await persistDownloadState();
    emitDownloadState();
    return;
  }

  let state = readPersistedDownloadState();
  if (state.packageKey !== packageKey) {
    state = {
      packageKey,
      label: selection.label,
      status: "idle",
      total: refs.length,
      completed: 0,
      nextIndex: 0,
      doneRefs: [],
      currentRefKey: null,
      currentPercent: 0,
      resumeRefKey: null,
      resumeData: null,
      error: null,
    };
    writePersistedDownloadState(state);
  } else {
    writePersistedDownloadState({
      ...state,
      label: selection.label,
      total: refs.length,
    });
    state = readPersistedDownloadState();
  }

  patchPersistedDownloadState({ status: "running", error: null });
  await persistDownloadState();
  emitDownloadState();

  await ensurePackageDir(packageKey);

  const doneSet = new Set(state.doneRefs);
  for (let i = Math.max(0, state.nextIndex); i < refs.length; i += 1) {
    if (token !== runToken) return;
    const ref = refs[i]!;

    if (await isChapterFileReady(packageKey, ref)) {
      await markDone(ref.refKey, i);
      continue;
    }

    patchPersistedDownloadState({
      currentRefKey: ref.refKey,
      currentPercent: 0,
      nextIndex: i,
    });
    await persistDownloadState();
    emitDownloadState();

    let chapterDone = false;
    let lastError: string | null = null;
    const target = chapterFileUri(packageKey, ref.bookId, ref.chapter);
    const resumeState = readPersistedDownloadState();
    const resumeData =
      resumeState.resumeRefKey === ref.refKey ? resumeState.resumeData ?? undefined : undefined;
    patchPersistedDownloadState({ resumeRefKey: null, resumeData: null });

    for (const candidate of ref.candidates) {
      if (token !== runToken) return;
      try {
        const download = FileSystem.createDownloadResumable(
          candidate,
          target,
          {},
          (progress) => {
            const totalBytes = progress.totalBytesExpectedToWrite;
            const written = progress.totalBytesWritten;
            const percent =
              typeof totalBytes === "number" && totalBytes > 0
                ? Math.max(0, Math.min(1, written / totalBytes))
                : 0;
            patchPersistedDownloadState({ currentPercent: percent });
            emitDownloadState();
          },
          resumeData,
        );
        currentDownload = download;
        const result = resumeData ? await download.resumeAsync() : await download.downloadAsync();
        currentDownload = null;
        if (result?.uri) {
          chapterDone = true;
          break;
        }
      } catch (e) {
        currentDownload = null;
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    if (token !== runToken) return;

    if (!chapterDone) {
      patchPersistedDownloadState({
        status: "error",
        error: lastError ?? "下载失败",
        currentRefKey: ref.refKey,
        currentPercent: 0,
      });
      await persistDownloadState();
      emitDownloadState();
      return;
    }

    doneSet.add(ref.refKey);
    patchPersistedDownloadState({ doneRefs: [...doneSet] });
    await markDone(ref.refKey, i);
  }

  if (token !== runToken) return;
  patchPersistedDownloadState({
    status: "done",
    currentRefKey: null,
    currentPercent: 1,
    error: null,
    resumeRefKey: null,
    resumeData: null,
  });
  await persistDownloadState();
  emitDownloadState();
}

export async function startAudioPackageDownload(selection: AudioPackageSelection): Promise<void> {
  await pauseCurrentInternal();
  void startDownloadRun(selection);
}

export async function resumeAudioPackageDownload(selection: AudioPackageSelection): Promise<void> {
  await hydrateDownloadState();
  const state = readPersistedDownloadState();
  if (state.packageKey && state.packageKey !== packageKeyForSelection(selection)) {
    await startAudioPackageDownload(selection);
    return;
  }
  void startDownloadRun(selection);
}
