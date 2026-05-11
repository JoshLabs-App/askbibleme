"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { DockChromeCollapse, useHomeDockChrome } from "@/components/home/HomeDockChromeContext";
import { HomeMusicRelaxShortcuts } from "@/components/home/HomeMusicRelaxShortcuts";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { NatureAmbientMixAudio } from "@/components/nature/NatureAmbientMixAudio";
import { NatureSceneLayer } from "@/components/nature/NatureSceneLayer";
import type { NatureSettingsV2 } from "@/lib/nature/types";
import { resolveNaturePlayback } from "@/lib/nature/resolve-nature-playback";

const NATURE_TOP_ICON_BTN =
  "flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] text-white/[0.9] hover:bg-white/[0.1]";

function IconBell(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 3a5 5 0 0 0-5 5v2.09l-.78 1.56A1 1 0 0 0 7 13h10a1 1 0 0 0 .89-1.45L17 10.09V8a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBellMuted(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M4 4 20 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 8.5V8a3.5 3.5 0 0 1 6.24-2.17M13 13v.09l.78 1.56A1 1 0 0 1 12.9 16H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  initial: NatureSettingsV2;
};

/**
 * 自然：全屏静音循环影像 + 轮播经文 + 第二层场景卡；顶栏 `AppShellTopBar`。
 */
export function NatureVideoExperience({ initial }: Props) {
  const { t } = useLocale();
  const { dockChromeVisible, toggleDockChrome, setDockChromeVisible } = useHomeDockChrome();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ambientMuted, setAmbientMuted] = useState(false);
  const [videoBroken, setVideoBroken] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState(
    () => initial.activeVideoId.trim() || initial.videos[0]?.id || "",
  );

  useEffect(() => {
    const next = initial.activeVideoId.trim() || initial.videos[0]?.id || "";
    setActiveVideoId(next);
  }, [initial]);

  const playbackSettings = useMemo(
    () => ({
      ...initial,
      activeVideoId: activeVideoId.trim() || initial.activeVideoId.trim() || initial.videos[0]?.id || "",
    }),
    [initial, activeVideoId],
  );

  const selectVideoAndImmersive = useCallback(
    (id: string) => {
      setActiveVideoId(id);
      setDockChromeVisible(false);
    },
    [setDockChromeVisible],
  );

  const { videoSrc, posterSrc, ambientLayers } = useMemo(
    () => resolveNaturePlayback(playbackSettings),
    [playbackSettings],
  );
  const hasAmbientAudio = ambientLayers.length > 0;
  const poster = posterSrc?.trim();
  const rate = initial.playbackRate;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc || videoBroken) return;
    el.muted = true;
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
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-950 text-white">
      {/* 天青轻雾，压暗底部，便于读白字 */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-300/25 via-teal-950/15 to-slate-950/88"
        aria-hidden
      />

      {videoSrc && !videoBroken ? (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-slate-900">
          <video
            ref={videoRef}
            key={videoSrc}
            className="absolute left-0 top-1/2 h-full min-h-full w-full min-w-full -translate-y-1/2 border-0 object-cover object-left outline-none motion-reduce:animate-none max-sm:animate-nature-widescreen-pan sm:left-1/2 sm:-translate-x-1/2 sm:object-center"
            style={{ maxWidth: "none" }}
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
          <NatureAmbientMixAudio
            layers={ambientLayers}
            videoRef={videoRef}
            playbackRate={rate}
            ambientMuted={ambientMuted}
          />
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-b from-slate-950/25 via-transparent to-slate-950/60"
        aria-hidden
      />

      <AppShellTopBar
        tone="onDark"
        rightAccessory={
          hasAmbientAudio && videoSrc && !videoBroken ? (
            <button
              type="button"
              onClick={() => setAmbientMuted((m) => !m)}
              aria-pressed={ambientMuted}
              aria-label={ambientMuted ? t("chrome.unmuteAmbient") : t("chrome.muteAmbient")}
              className={NATURE_TOP_ICON_BTN}
            >
              {ambientMuted ? (
                <IconBellMuted className="h-[1.25rem] w-[1.25rem] opacity-90" />
              ) : (
                <IconBell className="h-[1.25rem] w-[1.25rem] opacity-90" />
              )}
            </button>
          ) : null
        }
      />

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,calc(env(safe-area-inset-top)+3.5rem))] sm:max-w-xl sm:px-6 sm:pb-[max(2rem,env(safe-area-inset-bottom))]">
        {!videoSrc || videoBroken ? (
          <>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                aria-expanded={dockChromeVisible}
                aria-label={t("nature.toggleDockChrome")}
                onClick={() => toggleDockChrome()}
              />
              <div className="relative z-10 flex min-h-0 flex-1 flex-col pointer-events-none">
                <div className="mx-auto mt-6 max-w-sm rounded-3xl bg-white/[0.14] px-5 py-6 text-center ring-1 ring-white/[0.22] backdrop-blur-2xl sm:mt-8">
                  <p className="text-[15px] font-medium leading-snug text-white/90 sm:text-[16px]">{t("nature.emptyTitle")}</p>
                  <p className="mt-3 text-[12px] leading-relaxed text-white/55 sm:text-[13px]">{t("nature.emptyHint")}</p>
                </div>
              </div>
            </div>
            <DockChromeCollapse>
              <HomeMusicRelaxShortcuts className="mx-auto mt-6 shrink-0 sm:mt-8" />
            </DockChromeCollapse>
          </>
        ) : (
          <>
            <p className="sr-only">{t("nature.videoBgAnnounced")}</p>
            <div className="relative flex min-h-0 flex-1 flex-col justify-center">
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                aria-expanded={dockChromeVisible}
                aria-label={t("nature.toggleDockChrome")}
                onClick={() => toggleDockChrome()}
              />
              <div className="relative z-10 min-h-[6.5rem] w-full sm:min-h-[7.5rem] pointer-events-none">
                <HomeVerseRotator variant="dark" prominence="nature" className="min-h-[6.5rem] w-full sm:min-h-[7.5rem]" />
              </div>
            </div>
            <DockChromeCollapse>
              <NatureSceneLayer
                className="mt-6 shrink-0 sm:mt-7"
                settings={initial}
                activeVideoId={playbackSettings.activeVideoId}
                onSelectVideo={selectVideoAndImmersive}
              />
              <HomeMusicRelaxShortcuts className="mx-auto mt-5 w-full max-w-md shrink-0 sm:mt-6" />
            </DockChromeCollapse>
          </>
        )}
      </main>
    </div>
  );
}
