import { Asset } from "expo-asset";
import { getBundledNatureVideoModule } from "./generated/bundled-nature-videos";

const readySceneIds = new Set<string>();
const ensurePromises = new Map<string, Promise<void>>();

/** 场景视频是否已在本地就绪（预解压过或曾成功播过） */
export function isNatureSceneVideoReady(sceneId: string): boolean {
  const id = sceneId.trim();
  return id.length > 0 && readySceneIds.has(id);
}

export function markNatureSceneVideoReady(sceneId: string): void {
  const id = sceneId.trim();
  if (id) readySceneIds.add(id);
}

/** APK 内 mp4：解压到本地；远程场景等播放器首帧后再 mark */
export async function ensureNatureSceneVideoReady(sceneId: string): Promise<void> {
  const id = sceneId.trim();
  if (!id || readySceneIds.has(id)) return;

  const pending = ensurePromises.get(id);
  if (pending) return pending;

  const work = (async () => {
    const mod = getBundledNatureVideoModule(id);
    if (mod == null) return;
    const asset = Asset.fromModule(mod);
    if (!asset.downloaded) await asset.downloadAsync();
    readySceneIds.add(id);
  })().finally(() => {
    ensurePromises.delete(id);
  });

  ensurePromises.set(id, work);
  return work;
}

export async function preloadAllNatureSceneVideos(sceneIds: readonly string[]): Promise<void> {
  const unique = [...new Set(sceneIds.map((id) => id.trim()).filter(Boolean))];
  await Promise.all(unique.map((id) => ensureNatureSceneVideoReady(id)));
}

/** 胶片条顺序下的左右相邻场景 id（不含当前） */
export function natureSceneNeighborIds(
  sceneIds: readonly string[],
  activeId: string,
): string[] {
  const ids = sceneIds.map((id) => id.trim()).filter(Boolean);
  const current = activeId.trim();
  if (!current || ids.length < 2) return [];
  const idx = ids.indexOf(current);
  if (idx < 0) return [];
  const neighbors: string[] = [];
  if (idx > 0) neighbors.push(ids[idx - 1]!);
  if (idx < ids.length - 1) neighbors.push(ids[idx + 1]!);
  return neighbors;
}

/** 预载当前场景左右相邻的 APK 内 mp4（滑动/点缩略图切换前暖机） */
export async function preloadAdjacentNatureSceneVideos(
  sceneIds: readonly string[],
  activeId: string,
): Promise<void> {
  const neighbors = natureSceneNeighborIds(sceneIds, activeId);
  if (!neighbors.length) return;
  await Promise.all(neighbors.map((id) => ensureNatureSceneVideoReady(id)));
}
