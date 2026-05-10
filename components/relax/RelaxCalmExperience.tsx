"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import type { RelaxSettingsV1 } from "@/lib/relax/types";
import {
  parseRelaxVisualEffectId,
  RELAX_EFFECT_TAB_I18N_KEY,
  RELAX_VISUAL_EFFECT_IDS,
  RELAX_VISUAL_EFFECT_DEFAULT,
  RELAX_VISUAL_EFFECT_STORAGE_KEY,
  type RelaxVisualEffectId,
} from "@/lib/relax/visual-effects";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  initial: RelaxSettingsV1;
};

function RelaxOrbVisual() {
  return (
    <div
      className="animate-relax-breathe pointer-events-none h-[min(56vw,15.5rem)] w-[min(56vw,15.5rem)] rounded-full bg-gradient-to-br from-indigo-400/40 via-violet-500/[0.28] to-fuchsia-400/15 shadow-[0_0_100px_rgba(99,102,241,0.28)] sm:h-64 sm:w-64"
      aria-hidden
    />
  );
}

function RelaxRippleVisual() {
  return (
    <div
      className="pointer-events-none relative flex h-[min(56vw,17rem)] w-[min(56vw,17rem)] items-center justify-center sm:h-64 sm:w-64"
      aria-hidden
    >
      <span className="absolute inset-0 rounded-full border border-white/[0.15] animate-relax-ripple-ring" />
      <span className="absolute inset-0 rounded-full border border-indigo-300/[0.18] animate-relax-ripple-ring animate-relax-ripple-ring-delay-a" />
      <span className="absolute inset-0 rounded-full border border-violet-300/[0.14] animate-relax-ripple-ring animate-relax-ripple-ring-delay-b" />
      <span className="relative h-3 w-3 rounded-full bg-white/[0.38] shadow-[0_0_28px_rgba(255,255,255,0.22)]" />
    </div>
  );
}

function RelaxAfterglowVisual() {
  return (
    <div
      className="pointer-events-none relative flex h-[min(48vw,12rem)] w-[min(94vw,24rem)] items-center justify-center sm:h-52 sm:max-w-xl"
      aria-hidden
    >
      <div className="animate-relax-afterglow h-[8px] w-full rounded-full bg-gradient-to-r from-transparent via-violet-200/[0.38] to-transparent shadow-[0_0_60px_rgba(167,139,250,0.35)]" />
    </div>
  );
}

function RelaxFloatVisual() {
  return (
    <div
      className="pointer-events-none relative h-[min(54vw,16rem)] w-[min(82vw,21rem)] sm:h-64 sm:w-[28rem]"
      aria-hidden
    >
      <span className="animate-relax-float-mote absolute bottom-[20%] left-[12%] h-1.5 w-1.5 rounded-full bg-indigo-200/55 blur-[2px] shadow-[0_0_14px_rgba(165,180,252,0.48)]" />
      <span className="animate-relax-float-mote animate-relax-float-mote-delay-a absolute bottom-[26%] left-[38%] h-2 w-2 rounded-full bg-violet-200/48 blur-[3px] shadow-[0_0_18px_rgba(196,181,253,0.42)]" />
      <span className="animate-relax-float-mote animate-relax-float-mote-delay-b absolute bottom-[18%] left-[58%] h-1 w-1 rounded-full bg-fuchsia-200/45 blur-[2px] shadow-[0_0_12px_rgba(232,121,249,0.35)]" />
      <span className="animate-relax-float-mote animate-relax-float-mote-delay-c absolute bottom-[24%] left-[72%] h-2.5 w-2.5 rounded-full bg-white/40 blur-[4px] shadow-[0_0_20px_rgba(255,255,255,0.28)]" />
      <span className="animate-relax-float-mote animate-relax-float-mote-delay-d absolute bottom-[22%] left-[88%] h-1.5 w-1.5 rounded-full bg-indigo-100/50 blur-[2px] shadow-[0_0_14px_rgba(224,231,255,0.4)]" />
    </div>
  );
}

function RelaxPillarVisual() {
  return (
    <div
      className="pointer-events-none flex h-[min(54vw,16rem)] min-h-[12rem] w-[min(76vw,18rem)] items-center justify-center sm:h-64 sm:min-h-[14rem] sm:w-80"
      aria-hidden
    >
      <div className="animate-relax-pillar h-[min(48vw,14rem)] w-[8px] rounded-full bg-gradient-to-b from-transparent via-violet-200/[0.4] to-transparent shadow-[0_0_52px_rgba(167,139,250,0.38)] sm:h-56" />
    </div>
  );
}

function RelaxVisualByEffect({ id }: { id: RelaxVisualEffectId }) {
  switch (id) {
    case "orb":
      return <RelaxOrbVisual />;
    case "ripple":
      return <RelaxRippleVisual />;
    case "afterglow":
      return <RelaxAfterglowVisual />;
    case "float":
      return <RelaxFloatVisual />;
    case "pillar":
      return <RelaxPillarVisual />;
  }
}

/**
 * Calm 式放松会话：全屏静音影像（可选）+ 壳层音乐；底栏在外层对该路由隐藏。
 */
export function RelaxCalmExperience({ initial }: Props) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoBroken, setVideoBroken] = useState(false);
  const [visualEffect, setVisualEffect] = useState<RelaxVisualEffectId>(RELAX_VISUAL_EFFECT_DEFAULT);
  const { canPlay, playing, togglePlay, currentSec, durationSec, seekRatio } = useMusicShellPlayback();

  useLayoutEffect(() => {
    try {
      setVisualEffect(parseRelaxVisualEffectId(localStorage.getItem(RELAX_VISUAL_EFFECT_STORAGE_KEY)));
    } catch {
      /* ignore */
    }
  }, []);

  const persistVisualEffect = (id: RelaxVisualEffectId) => {
    setVisualEffect(id);
    try {
      localStorage.setItem(RELAX_VISUAL_EFFECT_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const videoSrc = initial.videoSrc.trim();
  const poster = initial.posterSrc?.trim();
  const rate = initial.playbackRate;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc || videoBroken) return;
    try {
      el.playbackRate = rate;
    } catch {
      /* ignore */
    }
  }, [rate, videoSrc, videoBroken]);

  useEffect(() => {
    setVideoBroken(false);
  }, [videoSrc]);

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-1 flex-col bg-[#0b1020] text-white supports-[height:100dvh]:min-h-[100dvh]">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#0f172a]"
        aria-hidden
      />

      {videoSrc && !videoBroken ? (
        <video
          ref={videoRef}
          key={videoSrc}
          className="absolute inset-0 z-[1] h-full w-full object-cover"
          src={videoSrc}
          poster={poster || undefined}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          aria-hidden
          onError={() => setVideoBroken(true)}
        />
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-b from-black/35 via-transparent to-black/[0.58]"
        aria-hidden
      />

      <header className="relative z-20 mx-auto flex w-full max-w-xl shrink-0 items-center justify-between gap-4 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          className="rounded-full px-3.5 py-2.5 text-[14px] font-medium leading-snug text-white/72 transition hover:bg-white/[0.07] hover:text-white sm:text-[15px]"
        >
          ← {t("relax.back")}
        </Link>
        <span className="shrink-0 text-[10px] font-medium tracking-[0.28em] text-white/38 sm:text-[11px] sm:tracking-[0.32em]">
          {t("relax.sessionLabel")}
        </span>
      </header>

      <div
        className="relative z-20 mx-auto flex w-full max-w-xl shrink-0 justify-center px-4 pt-4 sm:px-5 sm:pt-5"
        role="tablist"
        aria-label={t("relax.effectPickerLabel")}
      >
        <div className="flex max-w-full overflow-x-auto rounded-full bg-white/[0.055] p-1 ring-1 ring-white/[0.09] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {RELAX_VISUAL_EFFECT_IDS.map((id) => {
            const selected = visualEffect === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => persistVisualEffect(id)}
                className={`shrink-0 rounded-full px-3 py-2 text-[12px] font-medium tracking-wide transition sm:px-3.5 sm:py-2 sm:text-[12.5px] ${
                  selected ? "bg-white/[0.15] text-white shadow-sm" : "text-white/44 hover:bg-white/[0.06] hover:text-white/78"
                }`}
              >
                {t(RELAX_EFFECT_TAB_I18N_KEY[id])}
              </button>
            );
          })}
        </div>
      </div>

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-5 sm:py-11">
        <div className="flex flex-col items-center gap-y-11 sm:gap-y-14">
          <div className="flex shrink-0 items-center justify-center">
            <RelaxVisualByEffect id={visualEffect} />
          </div>
          <HomeVerseRotator
            variant="dark"
            prominence="relax"
            className="min-h-[7.75rem] w-full sm:min-h-[9rem]"
          />
        </div>
      </main>

      <footer className="relative z-20 mx-auto mt-auto flex w-full max-w-md shrink-0 flex-col gap-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pt-5">
        {canPlay ? (
          <div className="flex items-center gap-3.5 text-[12px] tabular-nums text-white/48 sm:text-[13px]">
            <span className="min-w-[2.75rem] shrink-0">{formatTime(currentSec)}</span>
            <button
              type="button"
              aria-label={t("music.home.progress")}
              className="group relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.13] sm:h-[5px]"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seekRatio((e.clientX - r.left) / r.width);
              }}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-white/[0.82] transition-[width] duration-150 ease-out group-hover:bg-white/90"
                style={{
                  width: `${durationSec ? Math.min(100, (currentSec / durationSec) * 100) : 0}%`,
                }}
              />
            </button>
            <span className="min-w-[2.75rem] shrink-0 text-right">{formatTime(durationSec)}</span>
          </div>
        ) : (
          <p className="text-center text-[12px] leading-relaxed text-white/38 sm:text-[13px]">{t("relax.noMusicHint")}</p>
        )}

        <div className="flex justify-center pb-0.5">
          <button
            type="button"
            disabled={!canPlay}
            aria-label={
              !canPlay ? t("playback.noTrack") : playing ? t("playback.pauseMusic") : t("playback.playMusic")
            }
            onClick={() => togglePlay()}
            className="music-reactive-play-btn flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full bg-white/[0.14] text-white shadow-[0_10px_44px_-14px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.14] transition hover:bg-white/[0.18] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35 sm:h-16 sm:w-16"
          >
            {playing ? (
              <IconPause className="h-6 w-6 shrink-0 opacity-95 sm:h-[26px] sm:w-[26px]" />
            ) : (
              <IconPlay className="h-6 w-6 shrink-0 translate-x-[2px] opacity-95 sm:h-[26px] sm:w-[26px]" />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
