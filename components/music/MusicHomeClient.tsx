"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconRepeatAll,
  IconRepeatOne,
  IconSkipNext,
  IconSkipPrev,
  IconTimer,
  MusicHomeAlbumIconGlyph,
} from "@/components/music/MusicHomeIcons";
import { MusicHomeQueue } from "@/components/music/MusicHomeQueue";
import { MusicHomeVisuals } from "@/components/music/MusicHomeVisuals";
import { MusicHomeBackdropScene } from "@/components/music/MusicHomeBackdropScene";
import { MusicHomeProgressBar } from "@/components/music/MusicHomeProgressBar";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";
import {
  MUSIC_HOME_ALBUM_SWATCH,
  MUSIC_HOME_DEFAULT_ALBUM,
  musicHomeAlbumCssKey,
  musicHomeAlbumIcon,
} from "@/components/music/music-home-album-theme";
import type { AudioTrack, MusicCompanionStore, Scene } from "@/lib/music-companion/types";
import {
  inferTrackAlbumFromCompanionTrack,
  MUSIC_ALBUMS as KNOWN_MUSIC_ALBUMS,
} from "@/lib/music/album-playback";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useMusicHomeWideScreen } from "@/hooks/useMusicHomeWideScreen";
import { useMusicHomeSwipe } from "@/hooks/useMusicHomeSwipe";
import { useTrackAnalysis } from "@/hooks/useTrackAnalysis";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { isSelahSuperAdminEmail } from "@/lib/selah-super-admin";
import { prefetchMusicTrackBundle } from "@/lib/music/prefetch-music-track";
import { resolveLocalized } from "@/lib/i18n/localized-text";
import { setMusicAutoHideChrome } from "@/lib/music/music-auto-hide-chrome";
import {
  analysisSrcFromAudioPath,
  sampleTrackAnalysisAt,
} from "@/lib/music/track-analysis";

type Props = {
  initialStore: MusicCompanionStore;
  /**
   * `templateChrome`：外层已由 `ShellTemplateChromeLayout` 提供顶栏与主区衬底；轮播经文与首页自然层同源（`HomeVerseRotator` + `prominence="nature"`）。
   * 缺省为独立全屏音乐页（历史行为）。
   */
  layout?: "standalone" | "templateChrome";
};

const DEFAULT_ALBUM = MUSIC_HOME_DEFAULT_ALBUM;
const MUSIC_UI_AUTO_HIDE_MS = 5000;

type MusicRepeatMode = "off" | "one" | "all";

function pickScene(store: MusicCompanionStore): Scene | null {
  const { scenes, defaultSceneId } = store;
  if (scenes.length === 0) return null;
  if (defaultSceneId) {
    const s = scenes.find((x) => x.id === defaultSceneId);
    if (s) return s;
  }
  return [...scenes].sort((a, b) => a.order - b.order)[0] ?? null;
}

function formatNowClock(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function initialSceneIndex(s: MusicCompanionStore): number {
  const ord = [...s.scenes].sort((a, b) => a.order - b.order);
  if (ord.length === 0) return 0;
  if (s.defaultSceneId) {
    const i = ord.findIndex((x) => x.id === s.defaultSceneId);
    if (i >= 0) return i;
  }
  return 0;
}

/** 与壳层默认池一致：多曲随机下标；单曲为 0 */
function computeRandomTrackPoolIdx(store: MusicCompanionStore): number {
  const tracks = store.audioTracks.filter((t) => t.src?.trim());
  if (tracks.length <= 1) return 0;
  return Math.floor(Math.random() * tracks.length);
}

function urlsEqual(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return false;
  if (typeof window === "undefined") return x === y;
  try {
    return new URL(x, window.location.href).href === new URL(y, window.location.href).href;
  } catch {
    return x === y;
  }
}

function MusicHomeTrackFromQuery({
  tracksWithSrc,
  bumpUserSkip,
  setTrackPoolIdx,
}: {
  tracksWithSrc: AudioTrack[];
  bumpUserSkip: () => void;
  setTrackPoolIdx: (n: number) => void;
}) {
  const sp = useSearchParams();
  useEffect(() => {
    const tid = sp.get("track")?.trim();
    if (!tid) return;
    const idx = tracksWithSrc.findIndex((t) => t.id === tid);
    if (idx < 0) return;
    bumpUserSkip();
    setTrackPoolIdx(idx);
  }, [sp, tracksWithSrc, bumpUserSkip, setTrackPoolIdx]);
  return null;
}

function countTracksWithSrc(store: MusicCompanionStore): number {
  return store.audioTracks.filter((t) => t.src?.trim()).length;
}

export function MusicHomeClient({ initialStore, layout = "standalone" }: Props) {
  const { t, locale } = useLocale();
  const { bootstrapped, user } = useAskbibleUser();
  const showAdminMusicLink = bootstrapped && Boolean(user && isSelahSuperAdminEmail(user.email));
  const landscapeNarrow = useLandscapeNarrow();
  const musicWide = useMusicHomeWideScreen();
  const inTemplateChrome = layout === "templateChrome";

  const {
    currentSec,
    durationSec,
    seekRatio,
    setPlaybackSrc,
    effectiveSrc,
    musicStore,
    deviceLibraryPlayback,
    clearDeviceLibraryPlayback,
    pausePlayback,
    playing,
    canPlay,
    sleepTimerMinutes,
    setSleepTimerMinutes,
    getAudioElement,
    togglePlayMusic,
    canPlayMusic,
    setMusicAlbumRepeatModeOverride,
  } = useMusicShellPlayback();
  const [musicRepeatMode, setMusicRepeatMode] = useState<MusicRepeatMode>("all");
  const [uiVisible, setUiVisible] = useState(true);
  const [landscapeMenuVisible, setLandscapeMenuVisible] = useState(false);
  const [seekDragging, setSeekDragging] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const uiHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 与壳层曲库同源：避免进页再打一遍 `/api/music/companion`；壳层拉取后自动更新 */
  const store = musicStore ?? initialStore;
  const initialSi = initialSceneIndex(initialStore);
  const [sceneIndex, setSceneIndex] = useState(() => initialSi);
  const [album, setAlbum] = useState<string>(DEFAULT_ALBUM);
  const [trackPoolIdx, setTrackPoolIdx] = useState(() => computeRandomTrackPoolIdx(initialStore));
  const fullMusicSrcGateDone = useRef(false);
  /** 用户刚点上一首/下一首/随机：短时间内优先信任 trackPoolIdx，避免壳层 ended 已切歌而此处仍用旧 URL 把播放源推回去导致更新风暴 */
  const userSkipAtRef = useRef(0);
  const bumpUserSkip = useCallback(() => {
    userSkipAtRef.current = typeof performance !== "undefined" ? performance.now() : 0;
  }, []);
  const setPlaybackSrcRef = useRef(setPlaybackSrc);
  setPlaybackSrcRef.current = setPlaybackSrc;

  useEffect(() => {
    const es = effectiveSrc.trim();
    if (!es) return;
    const list = store.audioTracks.filter((t) => Boolean(t.src?.trim()));
    const j = list.findIndex((t) => urlsEqual((t.src ?? "").trim(), es));
    if (j >= 0) setTrackPoolIdx(j);
  }, [effectiveSrc, store.audioTracks]);

  const orderedScenes = useMemo(
    () => [...store.scenes].sort((a, b) => a.order - b.order),
    [store.scenes],
  );

  useEffect(() => {
    const n = orderedScenes.length;
    setSceneIndex((i) => {
      if (n <= 0) return 0;
      return Math.min(Math.max(0, i), n - 1);
    });
  }, [orderedScenes.length]);

  const scene = orderedScenes[sceneIndex] ?? pickScene(store);

  const allTracksWithSrc = useMemo(
    () => store.audioTracks.filter((t) => t.src?.trim()),
    [store.audioTracks],
  );
  const tracksWithSrc = useMemo(
    () => allTracksWithSrc.filter((t) => inferTrackAlbumFromCompanionTrack(t) === album),
    [allTracksWithSrc, album],
  );
  const albumNames = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const name of KNOWN_MUSIC_ALBUMS) {
      seen.add(name);
      ordered.push(name);
    }
    for (const t of allTracksWithSrc) {
      const name = inferTrackAlbumFromCompanionTrack(t).trim() || DEFAULT_ALBUM;
      if (seen.has(name)) continue;
      seen.add(name);
      ordered.push(name);
    }
    return ordered;
  }, [allTracksWithSrc]);
  const albumCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTracksWithSrc) {
      const name = inferTrackAlbumFromCompanionTrack(t).trim() || DEFAULT_ALBUM;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [allTracksWithSrc]);

  useEffect(() => {
    if ((albumCounts[album] ?? 0) > 0) return;
    const next = albumNames.find((name) => (albumCounts[name] ?? 0) > 0) ?? DEFAULT_ALBUM;
    if (next !== album) setAlbum(next);
  }, [album, albumCounts, albumNames]);

  useEffect(() => {
    setTrackPoolIdx(0);
  }, [album]);

  const resolvedTrackIdx = useMemo(() => {
    const tracks = tracksWithSrc;
    if (!tracks.length) return 0;
    const es = effectiveSrc.trim();
    const k = Math.min(Math.max(0, trackPoolIdx), tracks.length - 1);
    const atKSrc = (tracks[k]?.src ?? "").trim();
    if (!es) return k;
    if (urlsEqual(atKSrc, es)) return k;
    const j = tracks.findIndex((t) => urlsEqual((t.src ?? "").trim(), es));
    if (j < 0) return k;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    if (now - userSkipAtRef.current < 720) return k;
    return j;
  }, [effectiveSrc, trackPoolIdx, tracksWithSrc]);

  const resolvedTrackIdxRef = useRef(0);
  resolvedTrackIdxRef.current = resolvedTrackIdx;

  const defaultTrackPoolIdx = useMemo(() => {
    if (tracksWithSrc.length === 0) return 0;
    const want = scene?.audioTrackId ?? null;
    const i = want ? tracksWithSrc.findIndex((t) => t.id === want) : -1;
    return i >= 0 ? i : 0;
  }, [scene?.audioTrackId, tracksWithSrc]);

  const initialTrackCount = countTracksWithSrc(initialStore);
  const initialTrackCountRef = useRef(initialTrackCount);
  const prevSceneIdForPoolRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const n = tracksWithSrc.length;
    const wasN = initialTrackCountRef.current;
    if (wasN <= 1 && n > 1) {
      initialTrackCountRef.current = n;
      setTrackPoolIdx(computeRandomTrackPoolIdx(store));
    }
  }, [tracksWithSrc.length, store, sceneIndex]);

  useEffect(() => {
    const sid = scene?.id ?? null;
    const prev = prevSceneIdForPoolRef.current;
    if (prev === undefined) {
      prevSceneIdForPoolRef.current = sid;
      return;
    }
    if (prev !== sid) {
      prevSceneIdForPoolRef.current = sid;
      setTrackPoolIdx(defaultTrackPoolIdx);
    }
  }, [scene?.id, defaultTrackPoolIdx]);

  useEffect(() => {
    setTrackPoolIdx((i) =>
      tracksWithSrc.length === 0 ? 0 : Math.min(i, tracksWithSrc.length - 1),
    );
  }, [tracksWithSrc.length]);

  const track = useMemo(() => {
    if (tracksWithSrc.length === 0) return null;
    return tracksWithSrc[Math.min(resolvedTrackIdx, tracksWithSrc.length - 1)];
  }, [tracksWithSrc, resolvedTrackIdx]);
  const selectedTrackTitle = useMemo(() => {
    if (!track) return null;
    return resolveLocalized(track.title, locale).trim() || t("music.home.trackUntitled");
  }, [locale, t, track]);

  const queueRows = useMemo(
    () =>
      tracksWithSrc.map((tr) => ({
        id: tr.id,
        title: resolveLocalized(tr.title, locale).trim() || t("music.home.trackUntitled"),
      })),
    [tracksWithSrc, locale, t],
  );

  const audioSrc = track?.src?.trim() ?? "";
  const analysisSrc =
    track?.analysisSrc?.trim() ||
    (audioSrc ? analysisSrcFromAudioPath(audioSrc) : null) ||
    null;
  const analysis = useTrackAnalysis(analysisSrc);
  const musicActive =
    Boolean(audioSrc) &&
    Boolean(effectiveSrc.trim()) &&
    !isCuvChapterAudioEffectiveSrc(effectiveSrc);
  const duration = musicActive && durationSec > 0 ? durationSec : 0;
  const position = musicActive
    ? seekDragging
      ? seekPreview * (duration || 1)
      : currentSec
    : 0;
  const progressRatio = duration > 0 ? Math.min(1, position / duration) : 0;

  const coffeeRhythmPulse = useMemo(() => {
    if (album !== "下午茶" || !analysis || !musicActive || !playing) return 0;
    const s = sampleTrackAnalysisAt(analysis, currentSec);
    const e = s.low * 0.45 + s.mid * 0.25 + s.rms * 0.3;
    return Math.max(0, Math.min(1, (e - 0.12) * 1.2));
  }, [album, analysis, currentSec, musicActive, playing]);

  const sleepAutoHideEnabled = album === "睡眠";
  const sleepUiAutoHideEnabled = sleepAutoHideEnabled && musicActive && playing;
  const chromeVisible = landscapeNarrow ? landscapeMenuVisible : uiVisible;
  const nowClockText = useMemo(() => formatNowClock(new Date(nowMs)), [nowMs]);

  useEffect(() => {
    if (deviceLibraryPlayback) return;
    const want = audioSrc.trim();
    if (!want) {
      setPlaybackSrcRef.current(null);
      return;
    }
    const cur = effectiveSrc.trim();
    if (urlsEqual(want, cur)) return;

    if (!fullMusicSrcGateDone.current) {
      fullMusicSrcGateDone.current = true;
      if (cur) return;
    }

    setPlaybackSrcRef.current(want);
  }, [audioSrc, effectiveSrc, deviceLibraryPlayback]);

  const selectTrack = useCallback(
    (idx: number) => {
      clearDeviceLibraryPlayback();
      bumpUserSkip();
      setTrackPoolIdx(idx);
    },
    [clearDeviceLibraryPlayback, bumpUserSkip],
  );

  const selectAlbum = useCallback(
    (nextAlbum: string) => {
      if (nextAlbum === album) return;
      if (nextAlbum === "睡眠" || nextAlbum === "专注工作") {
        setMusicRepeatMode("one");
      } else if (nextAlbum === "安静" || nextAlbum === "下午茶") {
        setMusicRepeatMode("all");
      }
      if (nextAlbum === "睡眠") {
        if (sleepTimerMinutes === 0) setSleepTimerMinutes(30);
      } else if (sleepTimerMinutes > 0) {
        setSleepTimerMinutes(0);
      }
      setAlbum(nextAlbum);
      if (track && inferTrackAlbumFromCompanionTrack(track) === nextAlbum) return;
      const nextTracks = allTracksWithSrc.filter((tr) => inferTrackAlbumFromCompanionTrack(tr) === nextAlbum);
      if (nextTracks.length === 0) return;
      const pickIndex = Math.floor(Math.random() * nextTracks.length);
      const pick = nextTracks[pickIndex]!;
      pausePlayback();
      clearDeviceLibraryPlayback();
      bumpUserSkip();
      const src = (pick.src ?? "").trim();
      if (src) {
        prefetchMusicTrackBundle({ src: pick.src, analysisSrc: pick.analysisSrc });
        const nextPick = nextTracks[(pickIndex + 1) % nextTracks.length];
        if (nextPick && nextPick.id !== pick.id) {
          prefetchMusicTrackBundle({ src: nextPick.src, analysisSrc: nextPick.analysisSrc });
        }
        setPlaybackSrc(src);
      }
    },
    [
      album,
      allTracksWithSrc,
      bumpUserSkip,
      clearDeviceLibraryPlayback,
      pausePlayback,
      setPlaybackSrc,
      setSleepTimerMinutes,
      sleepTimerMinutes,
      track,
    ],
  );

  useEffect(() => {
    setSeekDragging(false);
    setSeekPreview(0);
  }, [resolvedTrackIdx, effectiveSrc]);

  useEffect(() => {
    if ((album === "安静" || album === "下午茶") && musicRepeatMode !== "all") {
      setMusicRepeatMode("all");
    }
  }, [album, musicRepeatMode]);

  useEffect(() => {
    if ((album === "睡眠" || album === "专注工作") && musicRepeatMode !== "one") {
      setMusicRepeatMode("one");
    }
  }, [album, musicRepeatMode]);

  useEffect(() => {
    setMusicAlbumRepeatModeOverride(musicRepeatMode);
    return () => setMusicAlbumRepeatModeOverride(null);
  }, [musicRepeatMode, setMusicAlbumRepeatModeOverride]);

  useEffect(() => {
    const audio = getAudioElement();
    if (!audio) return;
    audio.loop = musicRepeatMode === "one";
  }, [getAudioElement, musicRepeatMode, effectiveSrc]);

  useEffect(() => {
    const audio = getAudioElement();
    if (!audio) return;
    audio.volume = album === "睡眠" ? 0.3 : 1;
  }, [album, getAudioElement, effectiveSrc]);

  const resetUiAutoHide = useCallback(() => {
    if (uiHideTimeoutRef.current) {
      clearTimeout(uiHideTimeoutRef.current);
      uiHideTimeoutRef.current = null;
    }
    if (landscapeNarrow) {
      setLandscapeMenuVisible(true);
    } else {
      setUiVisible(true);
    }
    if (!sleepUiAutoHideEnabled || !audioSrc) return;
    uiHideTimeoutRef.current = setTimeout(() => {
      if (landscapeNarrow) {
        setLandscapeMenuVisible(false);
      } else {
        setUiVisible(false);
      }
      uiHideTimeoutRef.current = null;
    }, MUSIC_UI_AUTO_HIDE_MS);
  }, [audioSrc, landscapeNarrow, sleepUiAutoHideEnabled]);

  useEffect(() => {
    if (!sleepUiAutoHideEnabled || !audioSrc) {
      if (uiHideTimeoutRef.current) {
        clearTimeout(uiHideTimeoutRef.current);
        uiHideTimeoutRef.current = null;
      }
      if (!landscapeNarrow) setUiVisible(true);
      return;
    }
    resetUiAutoHide();
    return () => {
      if (uiHideTimeoutRef.current) {
        clearTimeout(uiHideTimeoutRef.current);
        uiHideTimeoutRef.current = null;
      }
    };
  }, [audioSrc, landscapeNarrow, resetUiAutoHide, sleepUiAutoHideEnabled]);

  useEffect(() => {
    if (!landscapeNarrow) {
      setLandscapeMenuVisible(false);
      return;
    }
    setLandscapeMenuVisible(false);
  }, [landscapeNarrow]);

  useEffect(() => {
    if (!landscapeNarrow && !musicWide) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [chromeVisible, landscapeNarrow, musicWide]);

  const onLandscapeStageToggle = useCallback(() => {
    if (!landscapeNarrow) return;
    if (landscapeMenuVisible) {
      setLandscapeMenuVisible(false);
      if (!playing && tracksWithSrc.length > 0 && canPlayMusic) void togglePlayMusic();
      return;
    }
    setLandscapeMenuVisible(true);
    if (playing) void togglePlayMusic();
  }, [
    canPlayMusic,
    landscapeMenuVisible,
    landscapeNarrow,
    playing,
    togglePlayMusic,
    tracksWithSrc.length,
  ]);

  useEffect(() => {
    const hideBottomNav = landscapeNarrow || (sleepUiAutoHideEnabled && !uiVisible);
    if (landscapeNarrow) {
      setMusicAutoHideChrome(true);
    } else {
      setMusicAutoHideChrome(sleepUiAutoHideEnabled && !uiVisible);
    }
    if (typeof document !== "undefined") {
      if (hideBottomNav) {
        document.documentElement.dataset.musicBottomNavHidden = "1";
      } else {
        Reflect.deleteProperty(document.documentElement.dataset, "musicBottomNavHidden");
      }
    }
    return () => {
      setMusicAutoHideChrome(false);
      if (typeof document !== "undefined") {
        Reflect.deleteProperty(document.documentElement.dataset, "musicBottomNavHidden");
      }
    };
  }, [landscapeNarrow, sleepUiAutoHideEnabled, uiVisible]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.musicHomeShell = "1";
    return () => {
      Reflect.deleteProperty(document.documentElement.dataset, "musicHomeShell");
      Reflect.deleteProperty(document.documentElement.dataset, "musicBottomNavHidden");
    };
  }, []);

  const onPrev = useCallback(() => {
    if (musicActive && currentSec > 3) {
      seekRatio(0);
      return;
    }
    if (tracksWithSrc.length <= 1) return;
    const prevIdx = resolvedTrackIdx <= 0 ? tracksWithSrc.length - 1 : resolvedTrackIdx - 1;
    selectTrack(prevIdx);
  }, [currentSec, musicActive, resolvedTrackIdx, seekRatio, selectTrack, tracksWithSrc.length]);

  const onNext = useCallback(() => {
    if (tracksWithSrc.length <= 1) return;
    const nextIdx = (resolvedTrackIdx + 1) % tracksWithSrc.length;
    selectTrack(nextIdx);
  }, [resolvedTrackIdx, selectTrack, tracksWithSrc.length]);

  const onMusicSwipe = useCallback(
    (direction: "left" | "right") => {
      if (tracksWithSrc.length === 0) return;
      if (direction === "left") onNext();
      else onPrev();
    },
    [onNext, onPrev, tracksWithSrc.length],
  );

  const swipeHandlers = useMusicHomeSwipe(
    Boolean(audioSrc) && tracksWithSrc.length > 0,
    onMusicSwipe,
  );

  const cycleSleepTimer = useCallback(() => {
    if (sleepTimerMinutes === 0) {
      setSleepTimerMinutes(15);
      return;
    }
    if (sleepTimerMinutes === 15) {
      setSleepTimerMinutes(30);
      return;
    }
    if (sleepTimerMinutes === 30) {
      setSleepTimerMinutes(60);
      return;
    }
    if (sleepTimerMinutes === 60) {
      setSleepTimerMinutes(120);
      return;
    }
    setSleepTimerMinutes(0);
  }, [setSleepTimerMinutes, sleepTimerMinutes]);

  const sleepTimerBadge = sleepTimerMinutes > 0 ? String(sleepTimerMinutes) : null;
  const albumCssKey = musicHomeAlbumCssKey(album);

  useEffect(() => {
    if (!landscapeNarrow) {
      document.documentElement.removeAttribute("data-landscape-immersive");
      return;
    }
    document.documentElement.setAttribute("data-landscape-immersive", "");
    return () => document.documentElement.removeAttribute("data-landscape-immersive");
  }, [landscapeNarrow]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isIosLikeUserAgent()) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    if (!landscapeNarrow) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    void requestFullscreenCompat(document.documentElement).catch(() => {});
  }, [landscapeNarrow]);

  const rootClass = inTemplateChrome
    ? "music-home-root min-h-0 w-full flex-1"
    : "music-home-root relative mx-auto flex h-dvh max-h-dvh w-full flex-col overflow-hidden lg:h-full lg:max-h-none lg:min-h-0 lg:flex-1";

  const backdropOrbClass =
    album === "安静" || album === "专注工作"
      ? "music-home-backdrop--no-side-orbs"
      : album === "睡眠"
        ? "music-home-backdrop--flat"
        : album === "下午茶"
          ? "music-home-backdrop--sway-center"
          : "";

  return (
    <div
      className={rootClass}
      data-shell-swipe-nav-exclude
      {...swipeHandlers}
    >
      <Suspense fallback={null}>
        <MusicHomeTrackFromQuery
          tracksWithSrc={tracksWithSrc}
          bumpUserSkip={bumpUserSkip}
          setTrackPoolIdx={setTrackPoolIdx}
        />
      </Suspense>

      {!inTemplateChrome ? <AppShellTopBar tone="onDark" landscapeImmersive={landscapeNarrow} /> : null}

      <div
        className={[
          `music-home-backdrop music-home-backdrop--${albumCssKey}`,
          backdropOrbClass,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden
      >
        {album !== "安静" && album !== "专注工作" ? (
          <>
            <span className="music-home-side-orb music-home-side-orb--left" />
            <span className="music-home-side-orb music-home-side-orb--right" />
          </>
        ) : null}
        {album !== "安静" && album !== "睡眠" && album !== "专注工作" ? (
          <span className="music-home-center-orb" />
        ) : null}
        <MusicHomeBackdropScene
          album={album}
          decorVisible={musicActive}
          decorActive={musicActive && playing}
        />
      </div>

      {musicWide && !landscapeNarrow && audioSrc ? (
        <div className="music-home-wide-clock" aria-hidden>
          <time
            className={[
              "music-home-wide-clock-text",
              album === "睡眠" ? "music-home-wide-clock-text--sleep" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {nowClockText}
          </time>
        </div>
      ) : null}

      {landscapeNarrow && !chromeVisible && audioSrc ? (
        <div className="music-home-landscape-clock" aria-hidden>
          <time
            className={[
              "music-home-landscape-clock-text",
              album === "睡眠" ? "music-home-landscape-clock-text--sleep" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {nowClockText}
          </time>
        </div>
      ) : null}

      {landscapeNarrow && !chromeVisible ? (
        <button
          type="button"
          className="music-home-landscape-tap-layer"
          aria-label="切换横屏音乐菜单"
          onClick={onLandscapeStageToggle}
        />
      ) : null}

      {landscapeNarrow && chromeVisible ? (
        <button
          type="button"
          className="music-home-landscape-center-tap"
          aria-label="隐藏横屏音乐菜单"
          onClick={onLandscapeStageToggle}
        />
      ) : null}

      {allTracksWithSrc.length === 0 ? (
        <p className="music-home-empty">
          {showAdminMusicLink ? (
            <>
              {t("music.home.noAudioBefore")}{" "}
              <Link href="/admin/music">{t("music.home.adminMusic")}</Link>{" "}
              {t("music.home.noAudioAfter")}
            </>
          ) : (
            t("music.home.noAudioPlain")
          )}
        </p>
      ) : (
        <div
          className={[
            "music-home-foreground",
            landscapeNarrow ? "music-home-foreground--landscape" : "",
            musicWide ? "music-home-foreground--wide" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onPointerDown={landscapeNarrow ? undefined : resetUiAutoHide}
        >
          <div className="music-home-upper">
            <MusicHomeVisuals
              album={album}
              centered={landscapeNarrow || musicWide}
              rhythmPulse={coffeeRhythmPulse}
              decorVisible={musicActive}
              decorActive={musicActive && playing}
            />
          </div>

          <div
            className={[
              "music-home-panel",
              landscapeNarrow ? "music-home-panel--landscape" : "",
              musicWide ? "music-home-panel--wide" : "",
              !chromeVisible ? "music-home-panel--hidden" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onPointerDown={landscapeNarrow ? resetUiAutoHide : undefined}
          >
            {tracksWithSrc.length > 0 ? (
              <div className={!chromeVisible ? "music-home-chrome-hidden" : undefined}>
                <MusicHomeQueue
                  tracks={queueRows}
                  activeIdx={resolvedTrackIdx}
                  albumKey={album}
                  onSelect={selectTrack}
                />
              </div>
            ) : (
              <p className="music-home-empty">该专辑暂无曲目</p>
            )}

            <div className={!chromeVisible ? "music-home-chrome-hidden" : undefined}>
            <div className="music-home-album-row">
              {albumNames.map((albumName) => {
                const selected = albumName === album;
                const icon = musicHomeAlbumIcon(albumName);
                const swatch = MUSIC_HOME_ALBUM_SWATCH[albumName];
                return (
                  <button
                    key={albumName}
                    type="button"
                    className={[
                      "music-home-album-btn",
                      selected ? "music-home-album-btn--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={selected}
                    aria-label={`${albumName}（${albumCounts[albumName] ?? 0}）`}
                    onClick={() => selectAlbum(albumName)}
                  >
                    <MusicHomeAlbumIconGlyph
                      kind={icon}
                      color={selected && swatch ? swatch : undefined}
                    />
                  </button>
                );
              })}
            </div>

            {selectedTrackTitle ? (
              <p className="music-home-selected-track" aria-live="polite">
                当前选中：<span>{selectedTrackTitle}</span>
              </p>
            ) : null}

            {audioSrc ? (
              <div className="music-home-transport">
                <p className="music-home-time-line">
                  {formatTime(position)}
                  <span className="music-home-time-sep"> / </span>
                  {formatTime(duration)}
                </p>
                <MusicHomeProgressBar
                  progress={progressRatio}
                  disabled={!duration}
                  ariaLabel={t("music.home.progress")}
                  onSeekStart={() => setSeekDragging(true)}
                  onSeekPreview={setSeekPreview}
                  onSeekRatio={(r) => {
                    setSeekPreview(r);
                    seekRatio(r);
                    setSeekDragging(false);
                  }}
                />
                <div
                  className={[
                    "music-home-controls",
                    landscapeNarrow ? "music-home-controls--landscape" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="music-home-icon-btn"
                    aria-label={t("music.home.prevTrack")}
                    onClick={onPrev}
                  >
                    <IconSkipPrev />
                  </button>
                  <button
                    type="button"
                    className={[
                      "music-home-icon-btn",
                      "music-home-icon-btn--play",
                      playing ? "music-home-icon-btn--on" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={playing ? t("playback.pauseMusic") : t("playback.playMusic")}
                    aria-pressed={playing}
                    disabled={!canPlay}
                    onClick={() => void togglePlayMusic()}
                  >
                    {playing ? (
                      <IconPause className="music-home-play-icon" />
                    ) : (
                      <IconPlay className="music-home-play-icon" />
                    )}
                  </button>
                  <button
                    type="button"
                    className={[
                      "music-home-icon-btn",
                      musicRepeatMode === "one" ? "music-home-icon-btn--on" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={musicRepeatMode === "one"}
                    aria-label={musicRepeatMode === "one" ? "单曲循环已开启" : "单曲循环已关闭"}
                    onClick={() =>
                      setMusicRepeatMode((mode) => (mode === "one" ? "off" : "one"))
                    }
                  >
                    <IconRepeatOne />
                  </button>
                  <button
                    type="button"
                    className={[
                      "music-home-icon-btn",
                      musicRepeatMode === "all" ? "music-home-icon-btn--on" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={musicRepeatMode === "all"}
                    aria-label={musicRepeatMode === "all" ? "全部循环已开启" : "全部循环已关闭"}
                    onClick={() =>
                      setMusicRepeatMode((mode) => (mode === "all" ? "off" : "all"))
                    }
                  >
                    <IconRepeatAll />
                  </button>
                  <button
                    type="button"
                    className={[
                      "music-home-icon-btn music-home-timer-btn",
                      sleepTimerMinutes > 0 ? "music-home-icon-btn--on" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={sleepTimerMinutes > 0}
                    aria-label={
                      sleepTimerMinutes > 0
                        ? `睡眠定时 ${sleepTimerMinutes} 分钟，点按切换`
                        : t("music.sleepTimer.watchAria")
                    }
                    onClick={cycleSleepTimer}
                  >
                    <IconTimer />
                    {sleepTimerBadge ? (
                      <span className="music-home-timer-badge">{sleepTimerBadge}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="music-home-icon-btn"
                    aria-label={t("music.home.nextTrack")}
                    onClick={onNext}
                  >
                    <IconSkipNext />
                  </button>
                </div>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
