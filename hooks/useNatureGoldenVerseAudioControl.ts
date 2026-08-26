"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHomePrayerVerseFeedContext } from "@/components/home/HomePrayerVerseFeedContext";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { useMediaPlaybackCoordinator } from "@/components/media/MediaPlaybackCoordinatorProvider";
import { buildGoldenVerseAudioSrc } from "@/lib/bible/golden-verse-audio";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import { addHomeListeningSeconds } from "@/lib/home-listening/progress";
import {
  HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT,
  readHomeGoldenVerseAudioTranslationId,
} from "@/lib/home/home-golden-verse-audio-prefs";

function normalizeAudioSrc(src: string): string {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src.trim();
  }
}

export function useNatureGoldenVerseAudioControl(verseKey?: string | null) {
  const {
    activeIndex,
    advanceVerseAudioNow,
    onVerseAudioCompleted,
    setVerseAudioSequenceActive,
  } = useHomePrayerVerseFeedContext();
  const shellPlayback = useMusicShellPlayback();
  const { policy, prepareForegroundAudioPlayback, setForegroundAudioActive } = useMediaPlaybackCoordinator();
  const getShellAudioElement = shellPlayback.getAudioElement;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [audioTranslationId, setAudioTranslationId] = useState(() =>
    readHomeGoldenVerseAudioTranslationId(),
  );
  const musicVolumeBeforeRef = useRef<number | null>(null);
  const lastAudioTimeRef = useRef(0);
  const unflushedListeningSecondsRef = useRef(0);

  const src = useMemo(
    () => (verseKey ? buildGoldenVerseAudioSrc(verseKey, audioTranslationId) : null),
    [audioTranslationId, verseKey],
  );

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const refresh = () => setAudioTranslationId(readHomeGoldenVerseAudioTranslationId());
    window.addEventListener(HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT, refresh);
    return () => window.removeEventListener(HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT, refresh);
  }, []);

  const flushListeningTime = useCallback(() => {
    const seconds = unflushedListeningSecondsRef.current;
    unflushedListeningSecondsRef.current = 0;
    if (seconds > 0) addHomeListeningSeconds(seconds);
  }, []);

  const restoreMusicVolume = useCallback(() => {
    const shellAudio = getShellAudioElement();
    const before = musicVolumeBeforeRef.current;
    musicVolumeBeforeRef.current = null;
    if (shellAudio && typeof before === "number") shellAudio.volume = before;
  }, [getShellAudioElement]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!src) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setActive(false);
      setPreparing(false);
      return;
    }

    const currentSrc = (audio.currentSrc || audio.src || "").trim();
    if (normalizeAudioSrc(currentSrc) !== normalizeAudioSrc(src)) {
      audio.pause();
      audio.src = src;
      audio.load();
      if (active) {
        audio.currentTime = 0;
        setPreparing(true);
        void audio.play().catch(() => {
          setActive(false);
          setPreparing(false);
        });
      }
    }
  }, [src, active]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (!active) return;
      flushListeningTime();
      if (verseKey) onVerseAudioCompleted(verseKey, activeIndex);
      advanceVerseAudioNow();
    };
    const onPlay = () => {
      lastAudioTimeRef.current = audio.currentTime;
      setPreparing(false);
    };
    const onTimeUpdate = () => {
      const now = audio.currentTime;
      const delta = now - lastAudioTimeRef.current;
      lastAudioTimeRef.current = now;
      if (delta > 0 && delta < 5 && !audio.paused) {
        unflushedListeningSecondsRef.current += delta;
        if (unflushedListeningSecondsRef.current >= 10) flushListeningTime();
      }
    };
    const onPause = () => flushListeningTime();
    const onError = () => {
      setActive(false);
      setPreparing(false);
    };
    const onWaiting = () => {
      if (active) setPreparing(true);
    };
    const onCanPlay = () => {
      if (active) setPreparing(false);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [active, activeIndex, advanceVerseAudioNow, flushListeningTime, onVerseAudioCompleted, verseKey]);

  useEffect(() => {
    setVerseAudioSequenceActive(active);
    setForegroundAudioActive("nature-golden-verse-audio", active);
    if (!active) {
      flushListeningTime();
      restoreMusicVolume();
      setPreparing(false);
    }
  }, [active, flushListeningTime, restoreMusicVolume, setForegroundAudioActive, setVerseAudioSequenceActive]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      flushListeningTime();
      audio?.pause();
      setVerseAudioSequenceActive(false);
      setForegroundAudioActive("nature-golden-verse-audio", false);
      restoreMusicVolume();
    };
  }, [flushListeningTime, restoreMusicVolume, setForegroundAudioActive, setVerseAudioSequenceActive]);

  const pauseVerseTransport = useCallback(() => {
    audioRef.current?.pause();
    setActive(false);
  }, []);

  const resumeVerseTransport = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    await prepareForegroundAudioPlayback("nature-golden-verse-audio");
    setPreparing(true);
    setActive(true);
    void audio.play().catch(() => {
      setActive(false);
      setPreparing(false);
    });
  }, [prepareForegroundAudioPlayback, src]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (active) {
      audio.pause();
      setActive(false);
      return;
    }

    if (normalizeAudioSrc(audio.currentSrc || audio.src || "") !== normalizeAudioSrc(src)) {
      audio.src = src;
      audio.load();
    }

    const shellAudio = getShellAudioElement();
    if (shellPlayback.playing && policy === "tvCoexist") {
      shellPlayback.pausePlayback();
    } else if (shellPlayback.playing && isCuvChapterAudioEffectiveSrc(shellPlayback.effectiveSrc)) {
      shellPlayback.pausePlayback();
    } else if (shellPlayback.playing && shellAudio) {
      musicVolumeBeforeRef.current = shellAudio.volume;
      shellAudio.volume = Math.max(0, Math.min(1, shellAudio.volume * 0.28));
    }
    audio.currentTime = 0;
    await prepareForegroundAudioPlayback("nature-golden-verse-audio");
    setPreparing(true);
    setActive(true);
    void audio.play().catch(() => {
      setActive(false);
      setPreparing(false);
    });
  }, [
    active,
    getShellAudioElement,
    policy,
    prepareForegroundAudioPlayback,
    shellPlayback,
    src,
  ]);

  const audible = active && !preparing && Boolean(audioRef.current && !audioRef.current.paused);

  return {
    src,
    ready,
    active,
    preparing,
    audible,
    toggle,
    pauseVerseTransport,
    resumeVerseTransport,
    audioRef,
  };
}
