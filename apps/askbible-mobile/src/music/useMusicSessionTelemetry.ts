import { useCallback, type MutableRefObject } from "react";
import { trackTelemetry } from "../telemetry/client";

type Session = { trackId: string; startedAt: number };

export function useMusicSessionTelemetry(musicSessionRef: MutableRefObject<Session | null>) {
  return useCallback(() => {
    const s = musicSessionRef.current;
    if (!s) return;
    musicSessionRef.current = null;
    trackTelemetry("music_session", {
      track_id: s.trackId,
      duration_ms: Date.now() - s.startedAt,
    });
  }, [musicSessionRef]);
}
