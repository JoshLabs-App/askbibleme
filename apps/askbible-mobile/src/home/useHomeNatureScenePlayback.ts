import { useCallback, useEffect, useMemo } from "react";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { writeNatureActiveSceneId } from "../nature/natureActiveScenePrefs";
import { resolveNaturePlayback } from "../nature/resolveNaturePlayback";
import type { NatureSettingsV2 } from "../types/nature";
import {
  resolveNatureCoverPlayback,
  resolveNaturePosterPlaybackModule,
  resolveNaturePosterPlaybackUri,
} from "../media/bundledNatureMedia";
import { isNatureCoverPlaybackPlayable, type NatureCoverPlayback } from "./natureCoverPlayback";

type Args = {
  baseUrl: string;
  naturePackRev: number;
  loading: boolean;
  error: string | null;
  settings: NatureSettingsV2 | null;
  localActiveId: string;
  setLocalActiveId: React.Dispatch<React.SetStateAction<string>>;
  /** 静帧模式用预烘焙柔焦海报 */
  preferSoftPoster?: boolean;
};

export function useHomeNatureScenePlayback({
  baseUrl,
  naturePackRev,
  loading,
  error,
  settings,
  localActiveId,
  setLocalActiveId,
  preferSoftPoster = false,
}: Args) {
  const rawSceneId = (localActiveId || settings?.activeVideoId || "").trim();
  const sceneId = useMemo(() => {
    if (!settings?.videos.length) return rawSceneId;
    if (rawSceneId && settings.videos.some((v) => v.id === rawSceneId)) return rawSceneId;
    return settings.videos[0]?.id ?? "";
  }, [rawSceneId, settings]);

  useEffect(() => {
    if (!settings?.videos.length) return;
    if (!sceneId || localActiveId === sceneId) return;
    setLocalActiveId(sceneId);
    void writeNatureActiveSceneId(sceneId);
  }, [sceneId, localActiveId, settings, setLocalActiveId]);

  const playback = useMemo(() => {
    if (!settings) return null;
    return resolveNaturePlayback({
      ...settings,
      activeVideoId: sceneId,
    });
  }, [settings, sceneId]);

  const resolveScenePlayback = useCallback(
    (id: string): NatureCoverPlayback | null => {
      void naturePackRev;
      if (!settings?.videos.length) return null;
      const row = settings.videos.find((v) => v.id === id) ?? null;
      if (!row) return null;
      const pb = resolveNaturePlayback({ ...settings, activeVideoId: id });
      const remote = pb?.videoSrc ? toAbsoluteUrl(baseUrl, pb.videoSrc) : "";
      const resolved = resolveNatureCoverPlayback(id, remote);
      if (resolved.bundledModule != null || (resolved.uri ?? "").trim()) return resolved;
      if (!pb?.videoSrc) return null;
      return resolved;
    },
    [settings, baseUrl, naturePackRev],
  );

  const currentPlayback = useMemo(
    () => (sceneId ? resolveScenePlayback(sceneId) : null),
    [sceneId, resolveScenePlayback],
  );

  const posterUri = useMemo(() => {
    void naturePackRev;
    if (!sceneId.trim()) return "";
    const remote = playback?.posterSrc?.trim()
      ? toAbsoluteUrl(baseUrl, playback.posterSrc.trim())
      : "";
    return resolveNaturePosterPlaybackUri(sceneId.trim(), remote, { soft: preferSoftPoster }) || remote;
  }, [sceneId, playback?.posterSrc, baseUrl, naturePackRev, preferSoftPoster]);

  const posterModule = useMemo(
    () =>
      sceneId.trim()
        ? resolveNaturePosterPlaybackModule(sceneId.trim(), { soft: preferSoftPoster })
        : null,
    [sceneId, naturePackRev, preferSoftPoster],
  );

  const clampedRate = Math.min(2, Math.max(0.5, settings?.playbackRate ?? 1));

  const hasVideoStage =
    !loading &&
    !error &&
    Boolean(settings && playback && isNatureCoverPlaybackPlayable(currentPlayback));

  return {
    sceneId,
    playback,
    resolveScenePlayback,
    currentPlayback,
    posterUri,
    posterModule,
    clampedRate,
    hasVideoStage,
  };
}
