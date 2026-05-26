"use client";

import { useCallback } from "react";
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

const SCENE_CARD_CLASS =
  "group relative aspect-square w-[4.25rem] shrink-0 overflow-hidden rounded-[0.75rem] text-left shadow-[0_6px_18px_-10px_rgba(0,0,0,0.45)] ring-1 ring-inset transition hover:ring-white/30 sm:w-[4.75rem] sm:rounded-[0.85rem]";

type SceneCardProps = {
  v: NatureVideoEntry;
  selected: boolean;
  preparing: boolean;
  prepareProgress: number | null;
  unnamedLabel: string;
  onSelect: (id: string) => void;
  ariaPreparing: (name: string) => string;
  ariaSwitch: (name: string) => string;
};

function SceneCard({
  v,
  selected,
  preparing,
  prepareProgress,
  unnamedLabel,
  onSelect,
  ariaPreparing,
  ariaSwitch,
}: SceneCardProps) {
  const cardStill = v.thumbSrc?.trim() || v.previewFrameSrc?.trim() || "";
  const title = cardTitle(v, unnamedLabel);

  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      aria-busy={preparing ? true : undefined}
      aria-label={preparing ? ariaPreparing(title) : ariaSwitch(title)}
      onClick={() => onSelect(v.id)}
      className={
        SCENE_CARD_CLASS +
        (selected ? " ring-2 ring-sky-400/70 ring-inset " : " ring-white/[0.14] ")
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
            aria-valuenow={prepareProgress != null ? Math.round(prepareProgress * 100) : undefined}
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
}

/** 场景页：按后台配置中的 videos 顺序连成一片网格，当前片仅高亮不挪位。 */
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
  const orderedVideos = videos;

  const select = useCallback(
    (id: string) => {
      onSceneCardPress(id);
    },
    [onSceneCardPress],
  );

  const unnamed = t("nature.scenes.unnamedProduct");
  const ariaPreparing = useCallback(
    (name: string) => t("nature.scenes.ariaPreparing", { name }),
    [t],
  );
  const ariaSwitch = useCallback((name: string) => t("nature.scenes.ariaSwitch", { name }), [t]);

  if (!videos.length) return null;

  return (
    <section
      className={`@container relative flex w-full flex-wrap justify-center gap-2 pb-0.5 pt-0.5 sm:gap-2.5 ${className}`}
      aria-label={t("nature.scenes.sectionAria")}
      data-shell-swipe-nav-exclude
    >
      {orderedVideos.map((v) => (
        <SceneCard
          key={v.id}
          v={v}
          selected={v.id === activeVideoId}
          preparing={prepareSceneId !== null && v.id === prepareSceneId}
          prepareProgress={prepareProgress}
          unnamedLabel={unnamed}
          onSelect={select}
          ariaPreparing={ariaPreparing}
          ariaSwitch={ariaSwitch}
        />
      ))}
    </section>
  );
}
