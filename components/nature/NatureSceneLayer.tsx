"use client";

import { useCallback, useMemo } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { IconPlay } from "@/components/ui/MediaPlaybackIcons";
import type { NatureSettingsV2, NatureVideoEntry } from "@/lib/nature/types";

type Props = {
  className?: string;
  settings: NatureSettingsV2;
  activeVideoId: string;
  onSelectVideo: (id: string) => void;
};

function cardTitle(v: NatureVideoEntry, fallback: string) {
  const t = v.title?.trim();
  return t || fallback;
}

/**
 * 自然页第二层：横向展示后台配置的影片「产品」；点击切换当前全屏背景与该片混音。
 */
export function NatureSceneLayer({ className = "", settings, activeVideoId, onSelectVideo }: Props) {
  const { t } = useLocale();
  const videos = settings.videos;

  /** 正在播放的一条排在最后，其余保持配置中的顺序 */
  const orderedVideos = useMemo(() => {
    const active = activeVideoId.trim();
    if (!active) return videos;
    const hit = videos.find((v) => v.id === active);
    if (!hit) return videos;
    const rest = videos.filter((v) => v.id !== active);
    return [...rest, hit];
  }, [videos, activeVideoId]);

  const select = useCallback(
    (id: string) => {
      if (id === activeVideoId) return;
      onSelectVideo(id);
    },
    [activeVideoId, onSelectVideo],
  );

  if (!videos.length) return null;

  return (
    <section className={`w-full ${className}`} aria-label={t("nature.scenes.sectionAria")}>
      <div
        className="-mx-1 flex gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {orderedVideos.map((v) => {
          const selected = v.id === activeVideoId;
          const thumb = v.thumbSrc?.trim();
          const title = cardTitle(v, t("nature.scenes.unnamedProduct"));
          return (
            <button
              key={v.id}
              type="button"
              aria-current={selected ? "true" : undefined}
              aria-label={t("nature.scenes.ariaSwitch", { name: title })}
              onClick={() => select(v.id)}
              className={
                "group relative aspect-square w-[min(42vw,10.5rem)] shrink-0 snap-start overflow-hidden rounded-[1.35rem] text-left shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.14] transition hover:ring-white/30"
              }
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/80 via-slate-900/75 to-slate-950/90" aria-hidden />
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-95 transition group-hover:opacity-100"
                />
              ) : (
                <video
                  src={v.src}
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                  aria-hidden
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-white/[0.04] backdrop-blur-[1px]" aria-hidden />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

              <span
                className="pointer-events-none absolute right-2.5 top-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_2px_14px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.06] transition group-hover:bg-white group-hover:text-slate-900"
                aria-hidden
              >
                <IconPlay className="h-[14px] w-[14px] translate-x-[1px]" />
              </span>

              <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pt-8">
                <span className="block text-[15px] font-semibold leading-snug tracking-tight text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)] sm:text-[15px]">
                  {title}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
