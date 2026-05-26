import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import {
  buildExternalCuvChapterAudioUrl,
  buildLocalCuvChapterAudioUrl,
  buildLocalTeochewNtChapterAudioUrl,
  translationSupportsCuvChapterAudio,
} from "../bible/cuv-chapter-audio";
import { scriptureBooks } from "../bible/scripture-books";
import {
  buildExternalWebChapterAudioUrl,
  buildLocalWebChapterAudioUrl,
  translationUsesWebChapterAudio,
} from "../bible/web-chapter-audio";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileOfflineFirst } from "../config/mobileBundledOnly";

const STORAGE_KEY = "askbible.mobile.read.audio-package-download.v1";
const AUDIO_PACKAGE_ROOT = `${FileSystem.documentDirectory}read-audio-packages`;

type DownloadStatus = "idle" | "running" | "paused" | "done" | "error";

type AudioPackageSelection = {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  label: string;
};

type DownloadChapterRef = {
  refKey: string;
  bookId: string;
  chapter: number;
  candidates: string[];
};

type PersistedState = {
  packageKey: string | null;
  label: string;
  status: DownloadStatus;
  total: number;
  completed: number;
  nextIndex: number;
  doneRefs: string[];
  currentRefKey: string | null;
  currentPercent: number;
  resumeRefKey: string | null;
  resumeData: string | null;
  error: string | null;
};

export type AudioPackageDownloadState = {
  hydrated: boolean;
  packageKey: string | null;
  label: string;
  status: DownloadStatus;
  total: number;
  completed: number;
  nextIndex: number;
  currentRefKey: string | null;
  currentPercent: number;
  error: string | null;
};

const listeners = new Set<() => void>();

let hydrated = false;
let hydratingPromise: Promise<void> | null = null;
let state: PersistedState = {
  packageKey: null,
  label: "",
  status: "idle",
  total: 0,
  completed: 0,
  nextIndex: 0,
  doneRefs: [],
  currentRefKey: null,
  currentPercent: 0,
  resumeRefKey: null,
  resumeData: null,
  error: null,
};

let currentDownload: FileSystem.DownloadResumable | null = null;
let runToken = 0;

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener failures */
    }
  });
}

async function persistState(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage failure */
  }
}

async function hydrateState(): Promise<void> {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    try {
      const raw = (await AsyncStorage.getItem(STORAGE_KEY))?.trim();
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (!parsed || typeof parsed !== "object") return;
      state = {
        packageKey: typeof parsed.packageKey === "string" ? parsed.packageKey : null,
        label: typeof parsed.label === "string" ? parsed.label : "",
        status:
          parsed.status === "running" ||
          parsed.status === "paused" ||
          parsed.status === "done" ||
          parsed.status === "error"
            ? parsed.status
            : "idle",
        total: Number.isInteger(parsed.total) && (parsed.total ?? 0) >= 0 ? parsed.total! : 0,
        completed:
          Number.isInteger(parsed.completed) && (parsed.completed ?? 0) >= 0 ? parsed.completed! : 0,
        nextIndex:
          Number.isInteger(parsed.nextIndex) && (parsed.nextIndex ?? 0) >= 0 ? parsed.nextIndex! : 0,
        doneRefs: Array.isArray(parsed.doneRefs)
          ? parsed.doneRefs.filter((s): s is string => typeof s === "string")
          : [],
        currentRefKey: typeof parsed.currentRefKey === "string" ? parsed.currentRefKey : null,
        currentPercent:
          typeof parsed.currentPercent === "number" && Number.isFinite(parsed.currentPercent)
            ? Math.max(0, Math.min(1, parsed.currentPercent))
            : 0,
        resumeRefKey: typeof parsed.resumeRefKey === "string" ? parsed.resumeRefKey : null,
        resumeData: typeof parsed.resumeData === "string" ? parsed.resumeData : null,
        error: typeof parsed.error === "string" ? parsed.error : null,
      };
      if (state.status === "running") {
        state.status = "paused";
      }
    } catch {
      /* ignore parse failure */
    } finally {
      hydrated = true;
      hydratingPromise = null;
      emit();
    }
  })();
  return hydratingPromise;
}

export function subscribeAudioPackageDownload(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function readAudioPackageDownloadState(): AudioPackageDownloadState {
  return {
    hydrated,
    packageKey: state.packageKey,
    label: state.label,
    status: state.status,
    total: state.total,
    completed: state.completed,
    nextIndex: state.nextIndex,
    currentRefKey: state.currentRefKey,
    currentPercent: state.currentPercent,
    error: state.error,
  };
}

export async function ensureAudioPackageDownloadHydrated(): Promise<void> {
  await hydrateState();
}

function packageKeyForSelection(selection: AudioPackageSelection): string {
  if (translationUsesWebChapterAudio(selection.translationId)) return "web-en";
  if (selection.voiceId === "teochew-nt") return "cuv-teochew-nt";
  return "cuv-mandarin";
}

function packageDir(packageKey: string): string {
  return `${AUDIO_PACKAGE_ROOT}/${packageKey}`;
}

function chapterFileUri(packageKey: string, bookId: string, chapter: number): string {
  return `${packageDir(packageKey)}/${bookId.toUpperCase()}-${chapter}.mp3`;
}

function uniqueNonEmpty(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const s = String(raw || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function chapterRefsForSelection(selection: AudioPackageSelection): DownloadChapterRef[] {
  if (isMobileOfflineFirst()) return [];
  const baseUrl = getAskBibleBaseUrl();
  const useWeb = translationUsesWebChapterAudio(selection.translationId);
  const refs: DownloadChapterRef[] = [];
  for (const book of scriptureBooks) {
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
      if (useWeb) {
        const local = buildLocalWebChapterAudioUrl(book.bookId, chapter);
        const remote = buildExternalWebChapterAudioUrl(book.bookId, chapter);
        refs.push({
          refKey: `${book.bookId}:${chapter}`,
          bookId: book.bookId,
          chapter,
          candidates: uniqueNonEmpty([toAbsoluteUrl(baseUrl, local), remote]),
        });
        continue;
      }
      if (selection.voiceId === "teochew-nt") {
        const localTeochew = buildLocalTeochewNtChapterAudioUrl(book.bookId, chapter);
        refs.push({
          refKey: `${book.bookId}:${chapter}`,
          bookId: book.bookId,
          chapter,
          candidates: uniqueNonEmpty([
            toAbsoluteUrl(baseUrl, localTeochew),
            toAbsoluteUrl("https://askbible.me", localTeochew),
          ]),
        });
        continue;
      }
      const local = buildLocalCuvChapterAudioUrl(book.bookId, chapter);
      const remote = buildExternalCuvChapterAudioUrl(book.bookName, chapter);
      refs.push({
        refKey: `${book.bookId}:${chapter}`,
        bookId: book.bookId,
        chapter,
        candidates: uniqueNonEmpty([toAbsoluteUrl(baseUrl, local), remote]),
      });
    }
  }
  return refs.filter((r) => r.candidates.length > 0);
}

async function isChapterFileReady(packageKey: string, ref: DownloadChapterRef): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(chapterFileUri(packageKey, ref.bookId, ref.chapter));
  return Boolean(info.exists && typeof info.size === "number" && info.size > 0);
}

async function ensurePackageDir(packageKey: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(packageDir(packageKey), { intermediates: true });
}

async function pauseCurrentInternal(): Promise<void> {
  const active = currentDownload;
  if (!active) return;
  try {
    const paused = await active.pauseAsync();
    if (state.currentRefKey) {
      state.resumeRefKey = state.currentRefKey;
      state.resumeData = paused.resumeData ?? null;
    }
  } catch {
    /* ignore */
  } finally {
    currentDownload = null;
    if (state.status === "running") {
      state.status = "paused";
      await persistState();
      emit();
    }
  }
}

export async function pauseAudioPackageDownload(): Promise<void> {
  await hydrateState();
  await pauseCurrentInternal();
}

async function markDone(refKey: string, index: number): Promise<void> {
  if (!state.doneRefs.includes(refKey)) state.doneRefs.push(refKey);
  state.completed = state.doneRefs.length;
  state.nextIndex = Math.max(state.nextIndex, index + 1);
  state.currentPercent = 0;
  await persistState();
  emit();
}

async function startDownloadRun(selection: AudioPackageSelection): Promise<void> {
  await hydrateState();
  runToken += 1;
  const token = runToken;
  const packageKey = packageKeyForSelection(selection);
  const refs = chapterRefsForSelection(selection);
  if (refs.length === 0) {
    state = {
      ...state,
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
    };
    await persistState();
    emit();
    return;
  }

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
  } else {
    state.label = selection.label;
    state.total = refs.length;
  }

  state.status = "running";
  state.error = null;
  await persistState();
  emit();

  await ensurePackageDir(packageKey);

  const doneSet = new Set(state.doneRefs);
  for (let i = Math.max(0, state.nextIndex); i < refs.length; i += 1) {
    if (token !== runToken) return;
    const ref = refs[i]!;

    if (await isChapterFileReady(packageKey, ref)) {
      await markDone(ref.refKey, i);
      continue;
    }

    state.currentRefKey = ref.refKey;
    state.currentPercent = 0;
    state.nextIndex = i;
    await persistState();
    emit();

    let chapterDone = false;
    let lastError: string | null = null;
    const target = chapterFileUri(packageKey, ref.bookId, ref.chapter);
    const resumeData = state.resumeRefKey === ref.refKey ? state.resumeData ?? undefined : undefined;
    state.resumeRefKey = null;
    state.resumeData = null;

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
            state.currentPercent = percent;
            emit();
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
      state.status = "error";
      state.error = lastError ?? "下载失败";
      state.currentRefKey = ref.refKey;
      state.currentPercent = 0;
      await persistState();
      emit();
      return;
    }

    doneSet.add(ref.refKey);
    state.doneRefs = [...doneSet];
    await markDone(ref.refKey, i);
  }

  if (token !== runToken) return;
  state.status = "done";
  state.currentRefKey = null;
  state.currentPercent = 1;
  state.error = null;
  state.resumeRefKey = null;
  state.resumeData = null;
  await persistState();
  emit();
}

export async function startAudioPackageDownload(selection: AudioPackageSelection): Promise<void> {
  await pauseCurrentInternal();
  void startDownloadRun(selection);
}

export async function resumeAudioPackageDownload(selection: AudioPackageSelection): Promise<void> {
  await hydrateState();
  if (state.packageKey && state.packageKey !== packageKeyForSelection(selection)) {
    await startAudioPackageDownload(selection);
    return;
  }
  void startDownloadRun(selection);
}

export function chapterAudioPackageKey(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
}): string {
  if (translationUsesWebChapterAudio(args.translationId)) return "web-en";
  return args.voiceId === "teochew-nt" ? "cuv-teochew-nt" : "cuv-mandarin";
}

export async function resolveDownloadedChapterAudioUri(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
}): Promise<string | null> {
  if (!translationUsesWebChapterAudio(args.translationId) && !translationSupportsCuvChapterAudio(args.translationId)) {
    return null;
  }
  const key = chapterAudioPackageKey({ translationId: args.translationId, voiceId: args.voiceId });
  const uri = chapterFileUri(key, args.bookId, args.chapter);
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof info.size === "number" && info.size > 0) return uri;
  } catch {
    /* ignore */
  }
  return null;
}

