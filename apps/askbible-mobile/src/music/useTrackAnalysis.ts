import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import {
  BUNDLED_MUSIC_ANALYSIS_PREFIX,
} from "../media/bundledMusicMedia";
import { getBundledMusicAnalysis } from "../media/generated/bundled-music-analysis";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { parseTrackAnalysisJson, type TrackAudioAnalysisV1 } from "./trackAnalysis";

const cache = new Map<string, TrackAudioAnalysisV1>();

export function useTrackAnalysis(analysisUrl: string | null, enabled = true) {
  const [analysis, setAnalysis] = useState<TrackAudioAnalysisV1 | null>(() =>
    analysisUrl ? (cache.get(analysisUrl) ?? null) : null,
  );

  useEffect(() => {
    if (!enabled) return;
    if (!analysisUrl) {
      setAnalysis(null);
      return;
    }
    const hit = cache.get(analysisUrl);
    if (hit) {
      setAnalysis(hit);
      return;
    }

    if (analysisUrl.startsWith(BUNDLED_MUSIC_ANALYSIS_PREFIX)) {
      const trackId = analysisUrl.slice(BUNDLED_MUSIC_ANALYSIS_PREFIX.length);
      const raw = getBundledMusicAnalysis(trackId);
      const parsed = parseTrackAnalysisJson(raw);
      if (parsed) cache.set(analysisUrl, parsed);
      setAnalysis(parsed);
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        if (cancelled || !(await isNetworkAvailable())) return;
        try {
          const res = await fetch(analysisUrl, { headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error(String(res.status));
          const raw: unknown = await res.json();
          const parsed = parseTrackAnalysisJson(raw);
          if (parsed) cache.set(analysisUrl, parsed);
          if (!cancelled) setAnalysis(parsed);
        } catch {
          if (!cancelled) setAnalysis(null);
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [analysisUrl, enabled]);

  return analysis;
}
