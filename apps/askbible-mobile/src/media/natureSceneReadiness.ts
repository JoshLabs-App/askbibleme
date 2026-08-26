import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  getCachedBundledModuleUri,
  warmBundledModuleUri,
} from "../music/musicTrackPlayback";
import { getBundledNatureVideoModule } from "./generated/bundled-nature-videos";

const readySceneIds = new Set<string>();
/** Android：expo-video 可播 URI（file / content / android.resource；勿再 Asset.fromModule）。 */
const readySceneUris = new Map<string, string>();
const ensurePromises = new Map<string, Promise<void>>();

/**
 * 默认湖景（雪山湖）：冷启动优先从安装包预解压。
 * 与 bundled activeVideoId 一致；即使用户暂未开 live video 也先暖机。
 */
export const PRIMARY_NATURE_LAKE_SCENE_ID = "9cc949f2-3c1d-49c0-8357-2dc1d32bd954";

const ANDROID_PACKAGE =
  Constants.expoConfig?.android?.package?.trim() ||
  Constants.android?.package?.trim() ||
  "me.askbible";

/** expo-video / Media3 可播的本地 URI（拒绝 file:///android_res 虚拟路径）。 */
function isAndroidExpoVideoPlayableUri(uri: string): boolean {
  const u = uri.trim();
  if (!u) return false;
  if (u.includes("android_res/") || u.includes("android_asset/")) return false;
  if (u.startsWith("file:") || u.startsWith("content:")) return true;
  // Media3 可直接读包内 raw；裸资源名需先转成 android.resource://
  if (u.startsWith("android.resource://")) return true;
  return false;
}

/** 音乐暖机常回退「无 scheme raw 名」；expo-video 要 android.resource:// 才能播。 */
function toAndroidExpoVideoUri(candidate: string): string {
  const u = candidate.trim();
  if (!u) return "";
  if (isAndroidExpoVideoPlayableUri(u)) return u;
  // assets_nature_videos_xxx
  if (!u.includes("://") && !u.startsWith("/") && !u.includes("/")) {
    const name = u.replace(/\.(mp4|webm|mov)$/i, "");
    return `android.resource://${ANDROID_PACKAGE}/raw/${name}`;
  }
  return "";
}

/** 安装包内是否有该场景的 mp4。没有则只铺静帧，不要空等解码。 */
export function hasBundledNatureSceneVideo(sceneId: string): boolean {
  return getBundledNatureVideoModule(sceneId.trim()) != null;
}

/** 场景视频是否已在本地就绪（预解压过或曾成功播过） */
export function isNatureSceneVideoReady(sceneId: string): boolean {
  const id = sceneId.trim();
  if (!id || !readySceneIds.has(id)) return false;
  // Android：必须已有可播 file URI；仅 markReady（静帧回退）不算解压完成。
  if (Platform.OS === "android") return readySceneUris.has(id);
  return true;
}

export function getNatureSceneVideoFileUri(sceneId: string): string | null {
  const id = sceneId.trim();
  if (!id) return null;
  return readySceneUris.get(id) ?? null;
}

export function markNatureSceneVideoReady(sceneId: string): void {
  const id = sceneId.trim();
  if (id) readySceneIds.add(id);
}

/** APK 内 mp4：解压到本地；远程场景等播放器首帧后再 mark */
export async function ensureNatureSceneVideoReady(sceneId: string): Promise<void> {
  const id = sceneId.trim();
  if (!id) return;
  if (Platform.OS === "android" && readySceneUris.has(id)) {
    readySceneIds.add(id);
    return;
  }
  if (Platform.OS !== "android" && readySceneIds.has(id)) return;

  const pending = ensurePromises.get(id);
  if (pending) return pending;

  const work = (async () => {
    const mod = getBundledNatureVideoModule(id);
    if (mod == null) return;

    if (Platform.OS === "android") {
      // 与音乐同一暖机缓存：Asset.fromModule 在 release 会新建实例并冲掉 localUri。
      const warmed = await warmBundledModuleUri(mod);
      const cached = getCachedBundledModuleUri(mod);
      const playable = toAndroidExpoVideoUri(warmed || cached || "");
      if (!playable) {
        throw new Error(`nature video playable uri missing: ${id}`);
      }
      readySceneUris.set(id, playable);
      readySceneIds.add(id);
      return;
    }

    await warmBundledModuleUri(mod);
    readySceneIds.add(id);
  })().finally(() => {
    ensurePromises.delete(id);
  });

  ensurePromises.set(id, work);
  return work;
}

/** 冷启动尽早解压默认湖景（幂等；可在 root / home 各 kick 一次） */
export function ensurePrimaryNatureLakeVideoReady(): Promise<void> {
  return ensureNatureSceneVideoReady(PRIMARY_NATURE_LAKE_SCENE_ID);
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
