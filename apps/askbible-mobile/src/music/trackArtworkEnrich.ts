import {
  resolveMusicAnalysisPlaybackUri,
  resolveMusicTrackPlayback,
} from "../media/bundledMusicMedia";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { analysisSrcFromAudioPath } from "./trackAnalysis";
import type { BackgroundVisual, MusicCompanionStore, PlaybackTrack } from "./types";
import { resolveMusicLocalizedField } from "../i18n/site-copy";
import { gradientColorsForTrackId, colorsFromCssGradient, visualForTrack, inferTrackAlbum, FALLBACK_GRADIENTS } from "./trackArtworkGradients";

export function enrichPlaybackTracks(
  store: MusicCompanionStore,
  baseUrl: string,
): PlaybackTrack[] {
  const tracks: PlaybackTrack[] = [];
  for (const [index, t] of store.audioTracks.entries()) {
      const catalogSrc = toAbsoluteUrl(baseUrl, t.src);
      const playback = resolveMusicTrackPlayback(t.id, catalogSrc);
      const localReady = playback.localReady;
      const visual = visualForTrack(store, t.id);
      let artworkUri: string | null = null;
      let gradientColors = gradientColorsForTrackId(t.id);

      if (visual?.type === "image" && visual.imageSrc?.trim() && !isMobileBundledOnly()) {
        artworkUri = toAbsoluteUrl(baseUrl, visual.imageSrc.trim());
      } else if (visual?.type === "gradient") {
        const parsed = colorsFromCssGradient(visual.cssGradient);
        if (parsed) gradientColors = parsed;
      } else {
        gradientColors = FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length]!;
      }

      const relAnalysis = t.analysisSrc?.trim() || analysisSrcFromAudioPath(t.src);
      const remoteAnalysis = relAnalysis ? toAbsoluteUrl(baseUrl, relAnalysis) : "";
      const analysisSrc = relAnalysis
        ? resolveMusicAnalysisPlaybackUri(t.id, remoteAnalysis)
        : null;

      const next: PlaybackTrack = {
        id: t.id,
        title: resolveMusicLocalizedField(t.title) || "",
        artist: resolveMusicLocalizedField(t.artist) || "",
        album: inferTrackAlbum(t),
        src: playback.src,
        catalogSrc,
        localReady,
        analysisSrc,
        artworkUri,
        gradientColors,
        ...(typeof t.durationSec === "number" && t.durationSec > 0 ? { durationSec: t.durationSec } : {}),
        ...(playback.bundledModule != null ? { bundledModule: playback.bundledModule } : {}),
      };
      tracks.push(next);
  }
  return tracks;
}

