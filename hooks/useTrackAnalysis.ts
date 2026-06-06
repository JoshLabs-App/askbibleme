"use client";

import { useEffect, useState } from "react";
import { parseTrackAnalysisJson, type TrackAudioAnalysisV1 } from "@/lib/music/track-analysis";

const cache = new Map<string, TrackAudioAnalysisV1>();

export function useTrackAnalysis(analysisUrl: string | null | undefined) {
  const url = analysisUrl?.trim() || null;
  const [analysis, setAnalysis] = useState<TrackAudioAnalysisV1 | null>(() =>
    url ? (cache.get(url) ?? null) : null,
  );

  useEffect(() => {
    if (!url) {
      setAnalysis(null);
      return;
    }
    const hit = cache.get(url);
    if (hit) {
      setAnalysis(hit);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        const raw: unknown = await res.json();
        const parsed = parseTrackAnalysisJson(raw);
        if (parsed) cache.set(url, parsed);
        if (!cancelled) setAnalysis(parsed);
      } catch {
        if (!cancelled) setAnalysis(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return analysis;
}
