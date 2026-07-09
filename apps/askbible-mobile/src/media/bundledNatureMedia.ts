import { Asset } from "expo-asset";
import type { NatureCoverPlayback } from "../home/natureCoverPlayback";
import {
  getBundledNaturePosterModule,
  resolveBundledNaturePosterUri,
} from "./generated/bundled-nature-posters";
import {
  getBundledNatureVideoModule,
  resolveBundledNatureVideoUri,
} from "./generated/bundled-nature-videos";
import { resolveNatureResourcePackUri } from "./natureResourcePackSync";

export {
  preloadAdjacentNatureSceneVideos,
  preloadAllNatureSceneVideos,
} from "./natureSceneReadiness";

export function resolveNatureVideoPlaybackUri(videoId: string, remoteAbsolute: string): string {
  const id = videoId.trim();
  if (id) {
    const bundled = resolveBundledNatureVideoUri(id);
    if (bundled) return bundled;
  }
  const synced = resolveNatureResourcePackUri(remoteAbsolute);
  if (synced) return synced;
  return "";
}

/** 安装包内置 mp4 优先；其次已下载资源包；不常规直连远端 URL。 */
export function resolveNatureCoverPlayback(
  videoId: string,
  remoteAbsolute: string,
): NatureCoverPlayback {
  const id = videoId.trim();
  const bundledModule = id ? (getBundledNatureVideoModule(id) ?? undefined) : undefined;
  if (bundledModule != null) {
    const asset = Asset.fromModule(bundledModule);
    const uri = (asset.localUri ?? asset.uri ?? resolveBundledNatureVideoUri(id) ?? "").trim();
    return {
      sceneId: id,
      uri,
      bundledModule,
    };
  }
  const synced = resolveNatureResourcePackUri(remoteAbsolute);
  if (synced) {
    return { sceneId: id, uri: synced };
  }
  return { sceneId: id, uri: "" };
}

export function resolveNaturePosterPlaybackUri(
  videoId: string,
  remoteAbsolute: string,
): string {
  const id = videoId.trim();
  if (id) {
    const bundled = resolveBundledNaturePosterUri(id);
    if (bundled) return bundled;
  }
  const synced = resolveNatureResourcePackUri(remoteAbsolute);
  if (synced) return synced;
  return "";
}

export function resolveNaturePosterPlaybackModule(videoId: string): number | null {
  const id = videoId.trim();
  if (!id) return null;
  return getBundledNaturePosterModule(id);
}
