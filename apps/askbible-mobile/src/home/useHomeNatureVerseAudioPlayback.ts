import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Audio } from "expo-av";
import { buildGoldenVerseAudioRelativePath } from "@/lib/bible/golden-verse-audio";
import {
  registerHomeVerseAudioRemoteController,
  registerHomeVerseAudioStopper,
} from "../audio/audioPlaybackExclusivity";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { configureShellAudioMode, shellSoundDownloadFirst } from "../audio/shellAudioMode";
import { safeStopAndUnloadSound } from "../audio/safeShellSound";
import { addHomeListeningSeconds } from "./homeListeningProgress";
import {
  refreshShellMediaSession,
} from "../audio/shellMediaSessionPayload";
import {
  syncShellMediaSession,
  syncShellMediaSessionExplicit,
} from "../audio/shellMediaControls";
import {
  getHomeGoldenVerseAudioTranslationId,
  hydrateHomeGoldenVerseAudioTranslationId,
  subscribeHomeGoldenVerseAudioTranslationId,
} from "./homeGoldenVerseAudioPrefs";

type Args = {
  baseUrl: string;
  verseKey: string | null;
  active: boolean;
  advanceNow: () => Promise<void>;
  onActiveChange: (active: boolean) => void;
};

function resolveGoldenVerseAudioUrl(
  baseUrl: string,
  verseKey: string | null,
  translationId: "cuv-simp" | "web-en",
): string | null {
  if (!verseKey) return null;
  const relative = buildGoldenVerseAudioRelativePath(verseKey, translationId);
  if (!relative) return null;
  return toAbsoluteUrl(baseUrl, `/audio/${relative}`);
}

export function useHomeNatureVerseAudioPlayback({
  baseUrl,
  verseKey,
  active,
  advanceNow,
  onActiveChange,
}: Args) {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioTranslationId = useSyncExternalStore(
    subscribeHomeGoldenVerseAudioTranslationId,
    getHomeGoldenVerseAudioTranslationId,
    getHomeGoldenVerseAudioTranslationId,
  );
  const soundRef = useRef<Audio.Sound | null>(null);
  const backgroundKeeperRef = useRef<Audio.Sound | null>(null);
  const advanceNowRef = useRef(advanceNow);
  const activeRef = useRef(active);
  const onActiveChangeRef = useRef(onActiveChange);
  const lastPositionMillisRef = useRef(0);
  const unflushedMillisRef = useRef(0);
  const finishHandledRef = useRef(false);

  const src = useMemo(
    () => resolveGoldenVerseAudioUrl(baseUrl, verseKey, audioTranslationId),
    [audioTranslationId, baseUrl, verseKey],
  );

  useEffect(() => {
    void hydrateHomeGoldenVerseAudioTranslationId();
  }, []);

  useEffect(() => {
    advanceNowRef.current = advanceNow;
  }, [advanceNow]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
  }, [onActiveChange]);

  const flushListeningTime = useCallback(() => {
    const millis = unflushedMillisRef.current;
    unflushedMillisRef.current = 0;
    if (millis > 0) void addHomeListeningSeconds(millis / 1000);
  }, []);

  const stopCurrent = useCallback(async () => {
    flushListeningTime();
    setPlaying(false);
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      await safeStopAndUnloadSound(sound);
    }
    syncShellMediaSession(null);
    refreshShellMediaSession();
  }, [flushListeningTime]);

  useEffect(() => {
    if (!active) {
      const keeper = backgroundKeeperRef.current;
      backgroundKeeperRef.current = null;
      if (keeper) void safeStopAndUnloadSound(keeper);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await configureShellAudioMode();
        const created = await Audio.Sound.createAsync(
          require("../../assets/audio/background-silence-60.mp3"),
          {
            shouldPlay: true,
            isLooping: true,
            volume: 1,
            isMuted: false,
          },
        );
        if (cancelled) {
          await safeStopAndUnloadSound(created.sound);
          return;
        }
        backgroundKeeperRef.current = created.sound;
      } catch {
        // Verse playback remains usable in the foreground if the keeper fails.
      }
    })();

    return () => {
      cancelled = true;
      const keeper = backgroundKeeperRef.current;
      backgroundKeeperRef.current = null;
      if (keeper) void safeStopAndUnloadSound(keeper);
    };
  }, [active]);

  useEffect(() => {
    if (!src || !active) {
      setReady(false);
      void stopCurrent();
      return;
    }

    let cancelled = false;
    void (async () => {
      await stopCurrent();
      finishHandledRef.current = false;
      lastPositionMillisRef.current = 0;
      try {
        await configureShellAudioMode();
        const created = await Audio.Sound.createAsync(
          { uri: src },
          {
            shouldPlay: true,
            progressUpdateIntervalMillis: 250,
            volume: 1,
            isMuted: false,
          },
          undefined,
          shellSoundDownloadFirst({ uri: src }),
        );
        if (cancelled) {
          await safeStopAndUnloadSound(created.sound);
          return;
        }
        soundRef.current = created.sound;
        setReady(true);
        setPlaying(true);
        if (created.status.isLoaded) {
          syncShellMediaSessionExplicit({
            title: verseKey ?? "首页金句",
            artist: "AskBible.me",
            album: "首页金句",
            assetUri: src,
            durationSec: (created.status.durationMillis ?? 0) / 1000,
            positionSec: Math.floor(created.status.positionMillis / 1000),
            playing: true,
          });
        }
        created.sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          const position = status.positionMillis;
          const delta = position - lastPositionMillisRef.current;
          lastPositionMillisRef.current = position;
          if (status.isPlaying && delta > 0 && delta < 5000) {
            unflushedMillisRef.current += delta;
            if (unflushedMillisRef.current >= 10_000) flushListeningTime();
          }
          if (status.isPlaying) setPlaying(true);
          if (!status.isPlaying && !status.didJustFinish) setPlaying(false);
          syncShellMediaSessionExplicit({
            title: verseKey ?? "首页金句",
            artist: "AskBible.me",
            album: "首页金句",
            assetUri: src,
            durationSec: (status.durationMillis ?? 0) / 1000,
            positionSec: Math.floor(status.positionMillis / 1000),
            playing: status.isPlaying,
          });
          const reachedEnd =
            status.didJustFinish ||
            (!status.isPlaying &&
              (status.durationMillis ?? 0) > 0 &&
              // iOS can report the final stopped position rounded down by almost
              // one second instead of setting didJustFinish. Keep this tolerance
              // narrow enough to avoid treating an ordinary pause as completion.
              status.positionMillis >= (status.durationMillis ?? 0) - 1_500);
          if (reachedEnd && !finishHandledRef.current) {
            finishHandledRef.current = true;
            setPlaying(false);
            flushListeningTime();
            if (!activeRef.current) return;
            void advanceNowRef.current().catch(() => undefined);
          }
        });
      } catch {
        setReady(false);
        setPlaying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, flushListeningTime, src, stopCurrent, verseKey]);

  useEffect(() => {
    return () => {
      void stopCurrent();
    };
  }, [stopCurrent]);

  useEffect(() => {
    registerHomeVerseAudioStopper(stopCurrent);
    return () => registerHomeVerseAudioStopper(null);
  }, [stopCurrent]);

  useEffect(() => {
    if (!active) {
      registerHomeVerseAudioRemoteController(null);
      return;
    }
    registerHomeVerseAudioRemoteController({
      pause: () => onActiveChangeRef.current(false),
      toggle: () => onActiveChangeRef.current(false),
      next: () => advanceNowRef.current(),
      previous: () => advanceNowRef.current(),
    });
    return () => registerHomeVerseAudioRemoteController(null);
  }, [active]);

  return {
    ready,
    playing,
    src,
  };
}
