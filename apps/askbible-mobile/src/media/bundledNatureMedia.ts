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
  const synced = resolveNatureResourcePackUri(remoteAbsolute);
  if (synced) return synced;
  const id = videoId.trim();
  if (!id) return "";
  return resolveBundledNatureVideoUri(id) ?? "";
}

/** APK 内场景：有内置 mp4 则直连 require；否则才用远程 URI */
export function resolveNatureCoverPlayback(
  videoId: string,
  remoteAbsolute: string,
): NatureCoverPlayback {
  const id = videoId.trim();
  const synced = resolveNatureResourcePackUri(remoteAbsolute);
  if (synced) {
    return { sceneId: id, uri: synced };
  }
  const bundledModule = id ? (getBundledNatureVideoModule(id) ?? undefined) : undefined;
  const uri = bundledModule != null ? resolveBundledNatureVideoUri(id) ?? "" : "";
  return { sceneId: id, uri, bundledModule };
}

export function resolveNaturePosterPlaybackUri(
  videoId: string,
  remoteAbsolute: string,
): string {
  const synced = resolveNatureResourcePackUri(remoteAbsolute);
  if (synced) return synced;
  const id = videoId.trim();
  if (!id) return "";
  const bundled = resolveBundledNaturePosterUri(id);
  return bundled ?? "";
}

export function resolveNaturePosterPlaybackModule(videoId: string): number | null {
  const id = videoId.trim();
  if (!id) return null;
  return getBundledNaturePosterModule(id);
}
