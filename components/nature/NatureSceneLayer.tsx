"use client";

import { useCallback, useMemo } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { NatureSettingsV2, NatureVideoEntry } from "@/lib/nature/types";

type Props = {
  className?: string;
  settings: NatureSettingsV2;
  activeVideoId: string;
  /** 16:9 预览中选中的影片（可与 active 不同） */
  previewVideoId: string | null;
  /** 点卡片：打开或替换预览，不直接全屏 */
  onSceneCardPress: (id: string) => void;
};

function cardTitle(v: NatureVideoEntry, fallback: string) {
  const t = v.title?.trim();
  return t || fallback;
}

/**
 * 自然页第二层：影片「产品」卡；当前片置末。窄屏按版块宽度约 3.5 张露出暗示横滑；宽屏单卡上限 6.5rem。
 * 大屏横条内整体水平居中（外层滚动 + 内层 `w-max` + `lg:justify-center`）。
 */
export function NatureSceneLayer({
  className = "",
  settings,
  activeVideoId,
  previewVideoId,
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
    >
      <div
        className="w-full overflow-x-auto overscroll-x-contain pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex lg:justify-center [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex w-max min-w-0 flex-nowrap snap-x snap-mandatory gap-2 sm:gap-3">
          {orderedVideos.map((v) => {
            const selected = v.id === activeVideoId;
            const previewing = previewVideoId !== null && v.id === previewVideoId;
            const thumb = v.thumbSrc?.trim();
            const title = cardTitle(v, t("nature.scenes.unnamedProduct"));

            return (
              <button
                key={v.id}
                type="button"
                aria-current={selected ? "true" : undefined}
                aria-pressed={previewing ? true : undefined}
                aria-label={
                  previewing ? t("nature.scenes.ariaCollapsePreview", { name: title }) : t("nature.scenes.ariaSwitch", { name: title })
                }
                onClick={() => select(v.id)}
                className={
                  "group relative aspect-square w-[min(6.5rem,calc((100cqi-1.5rem)/3.5))] shrink-0 snap-start overflow-hidden rounded-[0.85rem] text-left shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)] ring-1 ring-inset transition hover:ring-white/30 sm:w-[min(6.5rem,calc((100cqi-2.25rem)/3.5))] sm:rounded-[0.95rem] " +
                  (previewing ? "ring-2 ring-sky-400/70 ring-inset " : "ring-white/[0.14] ")
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
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
