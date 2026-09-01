import { useCallback, type MutableRefObject } from "react";

type Session = { trackId: string; startedAt: number };

export function useMusicSessionTelemetry(musicSessionRef: MutableRefObject<Session | null>) {
  return useCallback(() => {
    musicSessionRef.current = null;
  }, [musicSessionRef]);
}
