import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicShellSleepTimerMinutes } from "./music-shell-playback-types";

export function useMusicShellSleepAndPlayHooks({
  pausePlayback,
  setPlaying,
}: {
  pausePlayback: () => void;
  setPlaying: (playing: boolean) => void;
}) {
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<MusicShellSleepTimerMinutes>(0);
  const [sleepTimerDeadlineAt, setSleepTimerDeadlineAt] = useState<number | null>(null);
  const sleepTimerDeadlineRef = useRef<number | null>(null);
  const sleepPauseHandlersRef = useRef(new Set<() => void>());
  const beforeShellPlayHandlersRef = useRef(new Set<() => void | Promise<void>>());
  const afterShellPlayHandlersRef = useRef(new Set<() => void | Promise<void>>());

  const setSleepTimerMinutes = useCallback((minutes: MusicShellSleepTimerMinutes) => {
    setSleepTimerMinutesState(minutes);
    if (minutes === 0) {
      sleepTimerDeadlineRef.current = null;
      setSleepTimerDeadlineAt(null);
      return;
    }
    const until = Date.now() + minutes * 60 * 1000;
    sleepTimerDeadlineRef.current = until;
    setSleepTimerDeadlineAt(until);
  }, []);

  const registerSleepPauseHandler = useCallback((handler: () => void) => {
    sleepPauseHandlersRef.current.add(handler);
    return () => {
      sleepPauseHandlersRef.current.delete(handler);
    };
  }, []);

  const registerBeforeShellPlayHandler = useCallback((handler: () => void | Promise<void>) => {
    beforeShellPlayHandlersRef.current.add(handler);
    return () => {
      beforeShellPlayHandlersRef.current.delete(handler);
    };
  }, []);

  const registerAfterShellPlayHandler = useCallback((handler: () => void | Promise<void>) => {
    afterShellPlayHandlersRef.current.add(handler);
    return () => {
      afterShellPlayHandlersRef.current.delete(handler);
    };
  }, []);

  const runBeforeShellPlayHandlers = useCallback(async () => {
    for (const fn of beforeShellPlayHandlersRef.current) {
      try {
        await fn();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const runAfterShellPlayHandlers = useCallback(async () => {
    for (const fn of afterShellPlayHandlersRef.current) {
      try {
        await fn();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const attemptShellPlay = useCallback(
    (a: HTMLAudioElement) => {
      const playNow = () => {
        let playPromise: Promise<void> | undefined;
        try {
          playPromise = a.play();
        } catch {
          setPlaying(false);
          void runAfterShellPlayHandlers();
          return;
        }
        void Promise.resolve(playPromise)
          .then(() => {
            setPlaying(true);
          })
          .catch(() => {
            setPlaying(false);
          })
          .finally(() => {
            void runAfterShellPlayHandlers();
          });
      };

      if (beforeShellPlayHandlersRef.current.size > 0) {
        void runBeforeShellPlayHandlers().then(playNow, playNow);
        return;
      }
      playNow();
    },
    [runBeforeShellPlayHandlers, runAfterShellPlayHandlers, setPlaying],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = sleepTimerDeadlineRef.current;
      if (d == null || Date.now() < d) return;
      sleepTimerDeadlineRef.current = null;
      setSleepTimerMinutesState(0);
      setSleepTimerDeadlineAt(null);
      pausePlayback();
      sleepPauseHandlersRef.current.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pausePlayback]);

  return {
    sleepTimerMinutes,
    sleepTimerDeadlineAt,
    setSleepTimerMinutes,
    registerSleepPauseHandler,
    registerBeforeShellPlayHandler,
    registerAfterShellPlayHandler,
    attemptShellPlay,
  };
}
