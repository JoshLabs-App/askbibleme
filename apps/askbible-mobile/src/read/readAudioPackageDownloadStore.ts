import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "askbible.mobile.read.audio-package-download.v1";

export type DownloadStatus = "idle" | "running" | "paused" | "done" | "error";

export type AudioPackageSelection = {
  translationId: string;
  voiceId: import("../bible/cuv-chapter-audio-voices").CuvChapterAudioVoiceId;
  label: string;
};

export type PersistedDownloadState = {
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
let state: PersistedDownloadState = {
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

export function readPersistedDownloadState(): PersistedDownloadState {
  return state;
}

export function writePersistedDownloadState(next: PersistedDownloadState): void {
  state = next;
}

export function patchPersistedDownloadState(patch: Partial<PersistedDownloadState>): PersistedDownloadState {
  state = { ...state, ...patch };
  return state;
}

export function emitDownloadState(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener failures */
    }
  });
}

export async function persistDownloadState(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage failure */
  }
}

export async function hydrateDownloadState(): Promise<void> {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    try {
      const raw = (await AsyncStorage.getItem(STORAGE_KEY))?.trim();
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedDownloadState>;
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
      emitDownloadState();
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
  await hydrateDownloadState();
}

export function isAudioPackageDownloadHydrated(): boolean {
  return hydrated;
}
