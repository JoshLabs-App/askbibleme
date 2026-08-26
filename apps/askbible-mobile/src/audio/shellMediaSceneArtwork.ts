import { Asset } from "expo-asset";
import { listBundledNatureSquarePosterModules } from "../media/generated/bundled-nature-posters-square";
import { getShellMusicWantPlaying } from "./shellMusicWantPlaying";

/** 系统媒体栏专辑图：随机 1:1 场景海报的本地 file URI（与当前首页场景解耦）。 */
let shellMediaSceneArtworkUri: string | null = null;
let shellMediaSceneArtworkId: string | null = null;
let warmInFlight: Promise<string | null> | null = null;

export function getShellMediaSceneArtworkUri(): string | null {
  return shellMediaSceneArtworkUri;
}

function notifyArtworkChanged(): void {
  if (!getShellMusicWantPlaying()) return;
  // 延迟 require，避免与 shellMediaSessionPayload 循环依赖。
  void import("./shellMediaSessionPayload")
    .then((m) => {
      m.refreshShellMediaSession({ playing: true });
    })
    .catch(() => {});
}

function setShellMediaSceneArtworkUri(uri: string | null, posterId: string | null): void {
  const next = (uri ?? "").trim() || null;
  const prev = shellMediaSceneArtworkUri;
  shellMediaSceneArtworkUri = next;
  shellMediaSceneArtworkId = posterId?.trim() || null;
  if (next !== prev) notifyArtworkChanged();
}

function toLocalFileUri(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("file://")) return trimmed;
  if (trimmed.startsWith("/")) return `file://${trimmed}`;
  return null;
}

function pickRandomSquarePoster(excludeId: string | null): { id: string; module: number } | null {
  const pool = listBundledNatureSquarePosterModules();
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0] ?? null;
  const candidates = excludeId ? pool.filter((p) => p.id !== excludeId) : pool;
  const list = candidates.length ? candidates : pool;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx] ?? null;
}

async function warmSquarePosterModule(posterModule: number): Promise<string | null> {
  try {
    const [asset] = await Asset.loadAsync(posterModule);
    if (asset && !asset.downloaded) {
      await asset.downloadAsync();
    }
    return (
      toLocalFileUri(asset?.localUri ?? "") || toLocalFileUri(asset?.uri ?? "")
    );
  } catch {
    return null;
  }
}

/** 尚无锁屏图时选一张随机 1:1 场景海报并预热。 */
export function ensureShellMediaSceneArtwork(): void {
  if (shellMediaSceneArtworkUri || warmInFlight) return;
  void reshuffleShellMediaSceneArtwork();
}

/**
 * 换一张随机 1:1 场景海报（尽量不与当前重复）并等待本地 URI 就绪。
 * 在新曲目 / 新章节 / 环境音开播时调用。
 */
export async function reshuffleShellMediaSceneArtwork(): Promise<string | null> {
  const picked = pickRandomSquarePoster(shellMediaSceneArtworkId);
  if (!picked) {
    setShellMediaSceneArtworkUri(null, null);
    return null;
  }

  const run = (async () => {
    const local = await warmSquarePosterModule(picked.module);
    if (local) {
      setShellMediaSceneArtworkUri(local, picked.id);
      return local;
    }
    if (shellMediaSceneArtworkId !== picked.id) {
      setShellMediaSceneArtworkUri(null, picked.id);
    }
    return null;
  })();

  warmInFlight = run.finally(() => {
    if (warmInFlight === run) warmInFlight = null;
  });
  return run;
}

/**
 * @deprecated 锁屏图已改为随机 1:1 池，不再绑定首页当前场景。
 * 保留签名以免旧调用方炸掉；行为等同 ensure。
 */
export function publishShellMediaSceneArtwork(_opts?: {
  sceneId?: string;
  posterModule?: number | null;
  posterUri?: string;
}): void {
  ensureShellMediaSceneArtwork();
}
