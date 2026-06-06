import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  checkNatureResourcePackUpdate,
  ensureNatureResourcePackSync,
  type ResourcePackSyncProgress,
} from "../media/natureResourcePackSync";
import {
  checkMusicResourcePackUpdate,
  ensureMusicResourcePackSync,
} from "../media/musicResourcePackSync";
import {
  checkScriptureTranslationUpdates,
  downloadScriptureTranslationUpdate,
  readScriptureTranslationDownloadState,
  subscribeScriptureTranslationDownload,
  type ScriptureTranslationUpdateItem,
} from "../bible/scripture-translation-update";

export type MobileResourceUpdateKind = "nature" | "music" | "scripture";

export type MobileResourceUpdateItem = {
  kind: MobileResourceUpdateKind;
  id: string;
  labelZh: string;
  labelEn: string;
  bytes: number;
  reason?: "version" | "missing" | "outdated";
  scripture?: ScriptureTranslationUpdateItem;
};

export type MobileResourceUpdatePhase = "idle" | "checking" | "downloading" | "done" | "error";

export type MobileResourceUpdateState = {
  phase: MobileResourceUpdatePhase;
  overallPercent: number;
  currentLabel: string;
  stepIndex: number;
  stepCount: number;
  pendingItems: MobileResourceUpdateItem[];
  error: string | null;
};

const listeners = new Set<() => void>();

let state: MobileResourceUpdateState = {
  phase: "idle",
  overallPercent: 0,
  currentLabel: "",
  stepIndex: 0,
  stepCount: 0,
  pendingItems: [],
  error: null,
};

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function setState(next: Partial<MobileResourceUpdateState>) {
  state = { ...state, ...next };
  emit();
}

export function readMobileResourceUpdateState(): MobileResourceUpdateState {
  return state;
}

export function subscribeMobileResourceUpdate(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

function stepOverallPercent(stepIndex: number, stepCount: number, unitFraction: number): number {
  if (stepCount <= 0) return unitFraction >= 1 ? 100 : 0;
  const clamped = Math.max(0, Math.min(1, unitFraction));
  return Math.min(100, Math.floor(((stepIndex + clamped) / stepCount) * 100));
}

function packProgressToFraction(progress: ResourcePackSyncProgress): number {
  if (progress.totalUnits <= 0) return progress.unitPercent / 100;
  const base = progress.completedUnits / progress.totalUnits;
  const slice = progress.unitPercent / 100 / progress.totalUnits;
  return Math.min(1, base + slice);
}

export type CheckMobileResourceUpdatesDeps = {
  isMusicUpdateAvailable?: () => Promise<boolean>;
};

export async function checkMobileResourceUpdates(
  deps: CheckMobileResourceUpdatesDeps = {},
): Promise<MobileResourceUpdateItem[]> {
  if (isMobileBundledOnly()) return [];

  setState({ phase: "checking", error: null });
  const items: MobileResourceUpdateItem[] = [];

  try {
    const [natureCheck, musicPackCheck, musicExtra, scriptureItems] = await Promise.all([
      checkNatureResourcePackUpdate(),
      checkMusicResourcePackUpdate(),
      deps.isMusicUpdateAvailable?.() ?? Promise.resolve(false),
      checkScriptureTranslationUpdates(),
    ]);

    if (natureCheck.available) {
      items.push({
        kind: "nature",
        id: "nature-pack",
        labelZh: "场景视频与配置",
        labelEn: "Scene videos & settings",
        bytes: 0,
        reason: "version",
      });
    }

    if (musicPackCheck.available || musicExtra) {
      items.push({
        kind: "music",
        id: "music-pack",
        labelZh: "音乐资源",
        labelEn: "Music resources",
        bytes: 0,
        reason: "version",
      });
    }

    for (const tr of scriptureItems) {
      items.push({
        kind: "scripture",
        id: tr.translationId,
        labelZh: tr.labelZh,
        labelEn: tr.labelEn,
        bytes: tr.bytes,
        reason: tr.reason,
        scripture: tr,
      });
    }

    setState({ phase: "idle", pendingItems: items });
    return items;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setState({ phase: "error", error: msg, pendingItems: [] });
    return [];
  }
}

export type ApplyMobileResourceUpdatesDeps = {
  downloadMusicUpdate?: () => Promise<boolean>;
};

export async function applyMobileResourceUpdates(
  items: MobileResourceUpdateItem[],
  deps: ApplyMobileResourceUpdatesDeps = {},
): Promise<{ ok: boolean; failed: MobileResourceUpdateItem[] }> {
  if (items.length === 0) {
    setState({ phase: "done", overallPercent: 100, stepIndex: 0, stepCount: 0, currentLabel: "" });
    return { ok: true, failed: [] };
  }

  const stepCount = items.length;
  const failed: MobileResourceUpdateItem[] = [];
  setState({
    phase: "downloading",
    overallPercent: 0,
    stepIndex: 0,
    stepCount,
    currentLabel: "",
    error: null,
    pendingItems: items,
  });

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const label = item.labelZh || item.labelEn || item.id;
    setState({ stepIndex: i, currentLabel: label });

    try {
      if (item.kind === "nature") {
        const ok = await ensureNatureResourcePackSync({
          force: true,
          onProgress: (progress) => {
            setState({
              overallPercent: stepOverallPercent(i, stepCount, packProgressToFraction(progress)),
              currentLabel: progress.currentLabel || label,
            });
          },
        });
        if (!ok) failed.push(item);
      } else if (item.kind === "music") {
        let ok = await ensureMusicResourcePackSync({
          force: true,
          onProgress: (progress) => {
            setState({
              overallPercent: stepOverallPercent(i, stepCount, packProgressToFraction(progress)),
              currentLabel: progress.currentLabel || label,
            });
          },
        });
        if (deps.downloadMusicUpdate) {
          const metaOk = await deps.downloadMusicUpdate();
          ok = ok || metaOk;
        }
        if (!ok) failed.push(item);
      } else if (item.kind === "scripture" && item.scripture) {
        const off = subscribeScriptureTranslationDownload(() => {
          const dl = readScriptureTranslationDownloadState();
          if (dl.status === "running" && dl.translationId === item.scripture?.translationId) {
            setState({
              overallPercent: stepOverallPercent(i, stepCount, dl.percent / 100),
              currentLabel: label,
            });
          }
        });
        try {
          await downloadScriptureTranslationUpdate(item.scripture, { force: true });
          setState({
            overallPercent: stepOverallPercent(i + 1, stepCount, 0),
          });
        } finally {
          off();
        }
      }
    } catch (e) {
      failed.push(item);
      const msg = e instanceof Error ? e.message : String(e);
      setState({ error: msg });
    }
  }

  const ok = failed.length === 0;
  setState({
    phase: ok ? "done" : "error",
    overallPercent: ok ? 100 : state.overallPercent,
    pendingItems: failed,
  });
  return { ok, failed };
}
