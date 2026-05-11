"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { NatureSettingsV2 } from "@/lib/nature/types";
import { resolveNaturePlayback } from "@/lib/nature/resolve-nature-playback";

const PREVIEW_CROSSFADE_MS = 450;

type Props = {
  settings: NatureSettingsV2;
  previewVideoId: string;
  playbackRate: number;
  onEnterImmersive: () => void;
  onPreviewVideoError?: () => void;
};

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduce;
}

/**
 * 场景卡上方 16:9 预览：以外框为界用 cover 铺满（按容器宽度对齐），非 16:9 源上下裁切、避免左右黑边；点按进入全屏沉浸。
 * 切换场景：双轨交叉淡化（交替槽位），避免单 video 改 src 或收尾换 src 造成的硬切/重载闪断。
 */
export function NatureScenePreviewPanel({
  settings,
  previewVideoId,
  playbackRate,
  onEnterImmersive,
  onPreviewVideoError,
}: Props) {
  const { t } = useLocale();
  const reduceMotion = usePrefersReducedMotion();
  const slotARef = useRef<HTMLVideoElement>(null);
  const slotBRef = useRef<HTMLVideoElement>(null);

  const { videoSrc, posterSrc } = useMemo(
    () => resolveNaturePlayback({ ...settings, activeVideoId: previewVideoId }),
    [settings, previewVideoId],
  );
  const poster = posterSrc?.trim();

  const [srcA, setSrcA] = useState(videoSrc);
  const [srcB, setSrcB] = useState(videoSrc);
  const [activeSlot, setActiveSlot] = useState<"a" | "b">("a");
  const [blending, setBlending] = useState(false);
  const blendArmedRef = useRef(false);

  const dualLayer = srcA !== srcB;

  const applyPlayback = useCallback(() => {
    for (const el of [slotARef.current, slotBRef.current]) {
      if (!el) continue;
      el.muted = true;
      try {
        el.playbackRate = playbackRate;
      } catch {
        /* ignore */
      }
    }
  }, [playbackRate]);

  useEffect(() => {
    applyPlayback();
  }, [applyPlayback, srcA, srcB]);

  useEffect(() => {
    if (!videoSrc) return;

    if (reduceMotion) {
      setSrcA(videoSrc);
      setSrcB(videoSrc);
      setActiveSlot("a");
      setBlending(false);
      blendArmedRef.current = false;
      return;
    }

    const topSrc = activeSlot === "a" ? srcA : srcB;
    if (videoSrc === topSrc) {
      return;
    }

    const inactive: "a" | "b" = activeSlot === "a" ? "b" : "a";
    blendArmedRef.current = false;
    setBlending(false);
    if (inactive === "a") {
      setSrcA(videoSrc);
    } else {
      setSrcB(videoSrc);
    }
  }, [videoSrc, reduceMotion, activeSlot, srcA, srcB]);

  const onInactivePlaying = useCallback(
    (slot: "a" | "b") => {
      if (reduceMotion) return;
      if (slot === activeSlot) return;
      const slotSrc = slot === "a" ? srcA : srcB;
      if (slotSrc !== videoSrc) return;
      if (blendArmedRef.current) return;
      blendArmedRef.current = true;
      requestAnimationFrame(() => setBlending(true));
    },
    [reduceMotion, activeSlot, srcA, srcB, videoSrc],
  );

  const onSlotTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLVideoElement>, slot: "a" | "b") => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "opacity") return;
      if (!blending) return;
      if (slot === activeSlot) return;
      setActiveSlot(slot);
      setBlending(false);
      blendArmedRef.current = false;
    },
    [blending, activeSlot],
  );

  const xfadeCls = reduceMotion
    ? ""
    : `transition-opacity ease-out motion-reduce:transition-none`;

  const opacityFor = (slot: "a" | "b") => {
    if (reduceMotion) return 1;
    if (!dualLayer) return 1;
    const isActive = activeSlot === slot;
    if (!blending) {
      return isActive ? 1 : 0;
    }
    return isActive ? 0 : 1;
  };

  const zFor = (slot: "a" | "b") => {
    if (!dualLayer) return 0;
    if (!blending) return activeSlot === slot ? 1 : 0;
    return activeSlot === slot ? 0 : 1;
  };

  if (!videoSrc) return null;

  return (
    <div className="mt-1 w-full sm:mt-2 [@media(max-height:500px)]:mt-0">
      <button
        type="button"
        onClick={onEnterImmersive}
        className="group relative aspect-video w-full overflow-hidden rounded-[0.85rem] text-left shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.14] transition hover:ring-white/30 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 sm:rounded-[0.95rem]"
        aria-label={t("nature.previewEnterFullScreen")}
      >
        <div className="pointer-events-none relative z-0 h-full w-full bg-slate-950">
          <video
            ref={slotARef}
            key={srcA}
            src={srcA}
            poster={poster || undefined}
            muted
            playsInline
            loop
            autoPlay
            preload="auto"
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center ${xfadeCls}`}
            style={
              reduceMotion
                ? { zIndex: zFor("a") }
                : {
                    opacity: dualLayer ? opacityFor("a") : 1,
                    zIndex: dualLayer ? zFor("a") : 0,
                    transitionDuration: dualLayer ? `${PREVIEW_CROSSFADE_MS}ms` : undefined,
                  }
            }
            aria-hidden
            onPlaying={() => onInactivePlaying("a")}
            onTransitionEnd={(e) => onSlotTransitionEnd(e, "a")}
            onError={() => onPreviewVideoError?.()}
          />
          {dualLayer ? (
            <video
              ref={slotBRef}
              key={srcB}
              src={srcB}
              poster={poster || undefined}
              muted
              playsInline
              loop
              autoPlay
              preload="auto"
              className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center ${xfadeCls}`}
              style={
                reduceMotion
                  ? { zIndex: zFor("b") }
                  : {
                      opacity: opacityFor("b"),
                      zIndex: zFor("b"),
                      transitionDuration: `${PREVIEW_CROSSFADE_MS}ms`,
                    }
              }
              aria-hidden
              onPlaying={() => onInactivePlaying("b")}
              onTransitionEnd={(e) => onSlotTransitionEnd(e, "b")}
              onError={() => onPreviewVideoError?.()}
            />
          ) : null}
        </div>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/22 via-black/[0.04] to-transparent px-2 pb-2 pt-5 text-center text-[10px] font-medium tracking-wide text-white/[0.58] drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.28)] sm:text-[11px]">
          {t("nature.previewTapHint")}
        </span>
      </button>
    </div>
  );
}
