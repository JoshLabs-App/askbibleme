import { Platform } from "react-native";
import type { NatureCoverPlayback } from "../home/natureCoverPlayback";
import {
  getBundledNaturePosterModule,
  resolveBundledNaturePosterUri,
} from "./generated/bundled-nature-posters";
import {
  getBundledNatureSoftPosterModule,
  resolveBundledNatureSoftPosterUri,
} from "./generated/bundled-nature-posters-soft";
import {
  getBundledNatureVideoModule,
  resolveBundledNatureVideoUri,
} from "./generated/bundled-nature-videos";
import { getNatureSceneVideoFileUri } from "./natureSceneReadiness";
import { resolveNatureResourcePackUri } from "./natureResourcePackSync";
import {
  peekNatureVideoR2Src,
  markNatureVideoR2ActiveUri,
  warmNatureVideoR2Cache,
} from "./natureVideoR2Source";

export {
  preloadAdjacentNatureSceneVideos,
  preloadAllNatureSceneVideos,
} from "./natureSceneReadiness";

export function resolveNatureVideoPlaybackUri(videoId: string, remoteAbsolute: string): string {
  const id = videoId.trim();
  if (id) {
    if (Platform.OS === "android") {
      const fileUri = getNatureSceneVideoFileUri(id);
      if (fileUri) return fileUri;
    }
    const bundled = resolveBundledNatureVideoUri(id);
    if (bundled) return bundled;
    // 非首个场景：R2 直链即时播放，同时后台缓存到本机，下次直接吃本地文件。
    const r2 = peekNatureVideoR2Src(id);
    if (r2) {
      markNatureVideoR2ActiveUri(r2);
      warmNatureVideoR2Cache(id);
      return r2;
    }
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
    // Android release：只用 readiness 缓存的可播 URI；禁止 Asset.fromModule（会冲掉 localUri）。
    if (Platform.OS === "android") {
      return {
        sceneId: id,
        uri: getNatureSceneVideoFileUri(id) ?? "",
        bundledModule,
      };
    }
    const bundled = resolveBundledNatureVideoUri(id) ?? "";
    return {
      sceneId: id,
      uri: bundled,
      bundledModule,
    };
  }
  if (id) {
    const r2 = peekNatureVideoR2Src(id);
    if (r2) {
      markNatureVideoR2ActiveUri(r2);
      warmNatureVideoR2Cache(id);
      return { sceneId: id, uri: r2 };
    }
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
  opts?: { soft?: boolean },
): string {
  const id = videoId.trim();
  if (id) {
    if (opts?.soft) {
      const soft = resolveBundledNatureSoftPosterUri(id);
      if (soft) return soft;
    }
    const bundled = resolveBundledNaturePosterUri(id);
    if (bundled) return bundled;
  }
  const synced = resolveNatureResourcePackUri(remoteAbsolute);
  if (synced) return synced;
  return "";
}

export function resolveNaturePosterPlaybackModule(
  videoId: string,
  opts?: { soft?: boolean },
): number | null {
  const id = videoId.trim();
  if (!id) return null;
  if (opts?.soft) {
    const soft = getBundledNatureSoftPosterModule(id);
    if (soft != null) return soft;
  }
  return getBundledNaturePosterModule(id);
}
