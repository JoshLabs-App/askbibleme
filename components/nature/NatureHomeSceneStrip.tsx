"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HomeSceneThumb } from "@/components/nature/HomeSceneThumb";
import { homeSceneStripContentWidth, homeSceneStripScrollX } from "@/lib/nature/home-scene-strip-metrics";
import type { NatureVideoEntry } from "@/lib/nature/types";

type Props = {
  scenes: NatureVideoEntry[];
  activeVideoId: string;
  liveVideoActive: boolean;
  onToggleLiveVideo: () => void;
  onSelectScene: (id: string) => void;
};

function sceneTitle(v: NatureVideoEntry, fallback: string): string {
  const t = v.title?.trim();
  return t || fallback;
}

/** 首页底部场景条：模糊静帧 + 场景缩略图（对齐 App，无「全部循环」） */
export function NatureHomeSceneStrip({
  scenes,
  activeVideoId,
  liveVideoActive,
  onToggleLiveVideo,
  onSelectScene,
}: Props) {
  const { t } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const unnamed = t("nature.scenes.unnamedProduct");
  const itemCount = scenes.length + 1;
  const blurLabel = t("music.blur");

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el || viewportWidth < 1 || index < 0) return;
      el.scrollTo({ left: homeSceneStripScrollX(index, viewportWidth, itemCount), behavior });
    },
    [itemCount, viewportWidth],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportWidth(Math.round(el.clientWidth));
    });
    ro.observe(el);
    setViewportWidth(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!activeVideoId) return;
    const index = Math.max(0, scenes.findIndex((v) => v.id === activeVideoId) + 1);
    scrollToIndex(index, "auto");
  }, [activeVideoId, scenes, scrollToIndex]);

  if (!scenes.length) return null;

  const contentMinWidth = Math.max(homeSceneStripContentWidth(itemCount), viewportWidth);

  return (
    <div className="nature-home-scene-strip-wrap" data-shell-swipe-nav-exclude>
      <div ref={scrollRef} className="nature-home-edge-fade-scroll">
        <div className="nature-home-scene-row" style={{ minWidth: contentMinWidth }}>
          <HomeSceneThumb
            key="scene-blur-toggle"
            selected={!liveVideoActive}
            icon="blur"
            fallbackLabel={blurLabel}
            ariaLabel={blurLabel}
            onPress={onToggleLiveVideo}
          />
          {scenes.map((v) => {
            const selected = v.id === activeVideoId;
            const title = sceneTitle(v, unnamed);
            const thumb = v.thumbSrc?.trim() || v.previewFrameSrc?.trim() || "";
            return (
              <HomeSceneThumb
                key={v.id}
                selected={selected}
                thumbSrc={thumb}
                fallbackLabel={title}
                ariaLabel={t("nature.scenes.ariaSwitch", { name: title })}
                onPress={() => onSelectScene(v.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
