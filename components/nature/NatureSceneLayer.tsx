"use client";

import { useCallback, useMemo } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { NatureSettingsV2, NatureVideoEntry } from "@/lib/nature/types";

type Props = {
  className?: string;
  settings: NatureSettingsV2;
  activeVideoId: string;
  /** 正在整段下载、尚未切入主画面的场景 id；无则为 null */
  prepareSceneId: string | null;
  /** 0–1；无 Content-Length 时为 null（卡片内用不确定进度样式） */
  prepareProgress: number | null;
  onSceneCardPress: (id: string) => void;
};

function cardTitle(v: NatureVideoEntry, fallback: string) {
  const t = v.title?.trim();
  return t || fallback;
}

/**
 * 自然页第二层：横向场景小图（缩略 / 封面）；当前片置末。窄屏约多张露出暗示横滑；宽屏单块上限约 5rem。
 */
export function NatureSceneLayer({
  className = "",
  settings,
  activeVideoId,
  prepareSceneId,
  prepareProgress,
  onSceneCardPress,
}: Props) {
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
      onSceneCardPress(id);
    },
    [onSceneCardPress],
  );

  if (!videos.length) return null;

  return (
    <section
      className={`@container relative w-full ${className}`}
      aria-label={t("nature.scenes.sectionAria")}
      data-shell-swipe-nav-exclude
    >
      <div
        className="w-full overflow-x-auto overscroll-x-contain pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex min-w-full justify-center">
          <div className="flex w-max min-w-0 flex-nowrap snap-x snap-mandatory gap-2 sm:gap-2.5">
          {orderedVideos.map((v) => {
            const selected = v.id === activeVideoId;
            const preparing = prepareSceneId !== null && v.id === prepareSceneId;
            /** 方卡：先用户方图，再首帧静图；避免无图时依赖小 `<video>` 解码（iOS 常空白） */
            const cardStill = v.thumbSrc?.trim() || v.previewFrameSrc?.trim() || "";
            const title = cardTitle(v, t("nature.scenes.unnamedProduct"));

            return (
              <button
                key={v.id}
                type="button"
                aria-current={selected ? "true" : undefined}
                aria-busy={preparing ? true : undefined}
                aria-label={
                  preparing ? t("nature.scenes.ariaPreparing", { name: title }) : t("nature.scenes.ariaSwitch", { name: title })
                }
                onClick={() => select(v.id)}
                className={
                  "group relative aspect-square w-[min(5rem,calc((100cqi-1.5rem)/4.5))] shrink-0 snap-start overflow-hidden rounded-[0.75rem] text-left shadow-[0_6px_18px_-10px_rgba(0,0,0,0.45)] ring-1 ring-inset transition hover:ring-white/30 sm:w-[min(5rem,calc((100cqi-2.25rem)/4.5))] sm:rounded-[0.85rem] " +
                  (selected ? "ring-2 ring-sky-400/70 ring-inset " : "ring-white/[0.14] ")
                }
              >
                <div className="absolute inset-0 bg-slate-950" aria-hidden />
                {cardStill ? (
                  <img
                    src={cardStill}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <video
                    src={v.src}
                    muted
                    playsInline
                    preload="none"
                    className="absolute inset-0 h-full w-full object-cover"
                    aria-hidden
                  />
                )}
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"
                  aria-hidden
                />
                {preparing ? (
                  <div className="pointer-events-none absolute inset-0 z-[15] flex flex-col justify-end bg-black/40 px-2 pb-2 pt-8">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-white/20"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        prepareProgress != null ? Math.round(prepareProgress * 100) : undefined
                      }
                    >
                      {prepareProgress != null ? (
                        <div
                          className="h-full rounded-full bg-sky-400/95 transition-[width] duration-150 ease-out"
                          style={{ width: `${Math.max(2, Math.round(prepareProgress * 100))}%` }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="h-full w-[38%] min-w-[1.75rem] rounded-full bg-sky-400/90 motion-safe:animate-pulse" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
          </div>
        </div>
      </div>
    </section>
  );
}
