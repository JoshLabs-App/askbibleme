import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { noteListenTick } from "@/lib/achievements/achievement-store-web";
import { MEDAL_XP } from "@/lib/achievements/medal-catalog";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import {
  defaultRepeatModeForAlbum,
  inferTrackAlbumFromCompanionTrack,
  pickRandomNextTrackIndexInAlbum,
  type MusicAlbumRepeatMode,
} from "@/lib/music/album-playback";
import { prefetchMusicTrackBundle } from "@/lib/music/prefetch-music-track";
import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import { addScriptureListenSecondsWeb } from "@/lib/read/scripture-listen-totals-web";
import { audioUrlEquals, type ScriptureListenTarget } from "./music-shell-playback-types";

export function useMusicShellAudioEvents({
  audioRef,
  scriptureListenTargetRef,
  setCurrentSec,
  setDurationSec,
  setPlaying,
  t,
  playing,
  store,
  effectiveSrc,
  musicAlbumRepeatModeOverrideRef,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  scriptureListenTargetRef: MutableRefObject<ScriptureListenTarget | null>;
  setCurrentSec: Dispatch<SetStateAction<number>>;
  setDurationSec: Dispatch<SetStateAction<number>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  t: (path: string, vars?: Record<string, string>) => string;
  playing: boolean;
  store: MusicCompanionStore | null;
  effectiveSrc: string;
  musicAlbumRepeatModeOverrideRef: MutableRefObject<MusicAlbumRepeatMode | null>;
}) {
  const lastUnavailableKjvSrcRef = useRef("");

  /**
   * 听读计时：每满 MEDAL_XP.listenTickSeconds（15 秒）记一片，同时喂
   * 「累计听读时长」和成就 XP。三重约束和原生一致：页面在前台、确实在播、
   * 且同一章的片数上限由 AchievementStore 自己卡（防挂机刷分）。
   * 用媒体时间的增量而不是墙钟：暂停 / 拖动 / 后台节流都不会虚增。
   */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const TICK_SEC = MEDAL_XP.listenTickSeconds;
    let lastTime = 0;
    let carry = 0;
    const onTime = () => {
      const target = scriptureListenTargetRef.current;
      const el = audioRef.current;
      if (!el || !target || el.paused) {
        lastTime = el?.currentTime ?? 0;
        return;
      }
      if (!audioUrlEquals(el, target.src)) {
        scriptureListenTargetRef.current = null;
        return;
      }
      if (document.visibilityState !== "visible") {
        lastTime = el.currentTime;
        return;
      }
      const delta = el.currentTime - lastTime;
      lastTime = el.currentTime;
      // 拖动进度条会产生大跳，只认正常推进的那一段
      if (!(delta > 0 && delta < 2)) return;
      carry += delta;
      while (carry >= TICK_SEC) {
        carry -= TICK_SEC;
        addScriptureListenSecondsWeb(TICK_SEC);
        noteListenTick(target.bookId, target.chapter);
      }
    };
    const onSeekOrPlay = () => {
      lastTime = audioRef.current?.currentTime ?? 0;
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onSeekOrPlay);
    a.addEventListener("seeked", onSeekOrPlay);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onSeekOrPlay);
      a.removeEventListener("seeked", onSeekOrPlay);
    };
  }, [audioRef, scriptureListenTargetRef]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    let rafId = 0;
    const onTime = () => {
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const el = audioRef.current;
        if (el) setCurrentSec(el.currentTime);
      });
    };
    const onMeta = () => setDurationSec(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      const src = (a.currentSrc || a.src || "").trim();
      if (
        src.toLowerCase().includes("audiotreasure.com/content/kjv_at/") &&
        lastUnavailableKjvSrcRef.current !== src
      ) {
        lastUnavailableKjvSrcRef.current = src;
        window.alert(t("pages.read.chapterAudioUnavailable"));
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("error", onError);
    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("error", onError);
    };
  }, [audioRef, setCurrentSec, setDurationSec, setPlaying, t]);

  useEffect(() => {
    if (!playing || !store || !effectiveSrc.trim() || isCuvChapterAudioEffectiveSrc(effectiveSrc)) {
      return;
    }
    const tracks = store.audioTracks.filter((tr) => Boolean(tr.src?.trim()));
    const idx = tracks.findIndex((tr) =>
      shellPlaybackUrlsEqual((tr.src ?? "").trim(), effectiveSrc.trim()),
    );
    if (idx < 0) return;
    const album = inferTrackAlbumFromCompanionTrack(tracks[idx]!);
    const repeatMode =
      musicAlbumRepeatModeOverrideRef.current ?? defaultRepeatModeForAlbum(album) ?? "all";
    if (repeatMode !== "all") return;
    const nextIdx = pickRandomNextTrackIndexInAlbum(tracks, idx, album);
    const next = tracks[nextIdx];
    if (!next || next.id === tracks[idx]!.id) return;
    prefetchMusicTrackBundle({ src: next.src, analysisSrc: next.analysisSrc });
  }, [playing, store, effectiveSrc, musicAlbumRepeatModeOverrideRef]);
}
