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
 * 场景卡上方 16:9 预览：有首帧/封面图时只显示静态图（不预拉视频）；否则回退为内联视频。
 * 切换场景：双轨交叉淡化（交替槽位）。视频与静态图各用独立状态，避免互相覆盖。
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

  const { videoSrc, posterSrc, previewStillSrc } = useMemo(
    () => resolveNaturePlayback({ ...settings, activeVideoId: previewVideoId }),
    [settings, previewVideoId],
  );
  const poster = posterSrc?.trim();
  const still = previewStillSrc?.trim();
  const useStaticPreview = Boolean(still);

  const [vSrcA, setVSrcA] = useState(videoSrc);
  const [vSrcB, setVSrcB] = useState(videoSrc);
  const [vActive, setVActive] = useState<"a" | "b">("a");
  const [vBlending, setVBlending] = useState(false);
  const vArmedRef = useRef(false);

  const [iSrcA, setISrcA] = useState(still ?? "");
  const [iSrcB, setISrcB] = useState(still ?? "");
  const [iActive, setIActive] = useState<"a" | "b">("a");
  const [iBlending, setIBlending] = useState(false);
  const iArmedRef = useRef(false);

  const dualV = vSrcA !== vSrcB;
  const dualI = iSrcA !== iSrcB;

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
  }, [applyPlayback, vSrcA, vSrcB]);

  useEffect(() => {
    if (useStaticPreview || !videoSrc) return;

    if (reduceMotion) {
      setVSrcA(videoSrc);
      setVSrcB(videoSrc);
      setVActive("a");
      setVBlending(false);
      vArmedRef.current = false;
      return;
    }

    const topSrc = vActive === "a" ? vSrcA : vSrcB;
    if (videoSrc === topSrc) {
      return;
    }

    const inactive: "a" | "b" = vActive === "a" ? "b" : "a";
    vArmedRef.current = false;
    setVBlending(false);
    if (inactive === "a") {
      setVSrcA(videoSrc);
    } else {
      setVSrcB(videoSrc);
    }
  }, [videoSrc, useStaticPreview, reduceMotion, vActive, vSrcA, vSrcB]);

  useEffect(() => {
    if (!useStaticPreview || !still) return;

    if (reduceMotion) {
      setISrcA(still);
      setISrcB(still);
      setIActive("a");
      setIBlending(false);
      iArmedRef.current = false;
      return;
    }

    const top = iActive === "a" ? iSrcA : iSrcB;
    if (still === top) {
      return;
    }

    const inactive: "a" | "b" = iActive === "a" ? "b" : "a";
    iArmedRef.current = false;
    setIBlending(false);
    if (inactive === "a") {
      setISrcA(still);
    } else {
      setISrcB(still);
    }
  }, [still, useStaticPreview, reduceMotion, iActive, iSrcA, iSrcB]);

  const onInactivePlaying = useCallback(
    (slot: "a" | "b") => {
      if (reduceMotion) return;
      if (slot === vActive) return;
      const slotSrc = slot === "a" ? vSrcA : vSrcB;
      if (slotSrc !== videoSrc) return;
      if (vArmedRef.current) return;
      vArmedRef.current = true;
      requestAnimationFrame(() => setVBlending(true));
    },
    [reduceMotion, vActive, vSrcA, vSrcB, videoSrc],
  );

  const onInactiveImgLoad = useCallback(
    (slot: "a" | "b") => {
      if (reduceMotion) return;
      if (!still) return;
      if (slot === iActive) return;
      const slotSrc = slot === "a" ? iSrcA : iSrcB;
      if (slotSrc !== still) return;
      if (iArmedRef.current) return;
      iArmedRef.current = true;
      requestAnimationFrame(() => setIBlending(true));
    },
    [reduceMotion, iActive, iSrcA, iSrcB, still],
  );

  const onVideoTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLVideoElement>, slot: "a" | "b") => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "opacity") return;
      if (!vBlending) return;
      if (slot === vActive) return;
      setVActive(slot);
      setVBlending(false);
      vArmedRef.current = false;
    },
    [vBlending, vActive],
  );

  const onImgTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLImageElement>, slot: "a" | "b") => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "opacity") return;
      if (!iBlending) return;
      if (slot === iActive) return;
      setIActive(slot);
      setIBlending(false);
      iArmedRef.current = false;
    },
    [iBlending, iActive],
  );

  const xfadeCls = reduceMotion
    ? ""
    : `transition-opacity ease-out motion-reduce:transition-none`;

  const opacityV = (slot: "a" | "b") => {
    if (reduceMotion) return 1;
    if (!dualV) return 1;
    const isActive = vActive === slot;
    if (!vBlending) {
      return isActive ? 1 : 0;
    }
    return isActive ? 0 : 1;
  };

  const opacityI = (slot: "a" | "b") => {
    if (reduceMotion) return 1;
    if (!dualI) return 1;
    const isActive = iActive === slot;
    if (!iBlending) {
      return isActive ? 1 : 0;
    }
    return isActive ? 0 : 1;
  };

  const zV = (slot: "a" | "b") => {
    if (!dualV) return 0;
    if (!vBlending) return vActive === slot ? 1 : 0;
    return vActive === slot ? 0 : 1;
  };

  const zI = (slot: "a" | "b") => {
    if (!dualI) return 0;
    if (!iBlending) return iActive === slot ? 1 : 0;
    return iActive === slot ? 0 : 1;
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
          {useStaticPreview && still ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- 动态配置 URL；首帧静态预览 */}
              <img
                src={iSrcA}
                alt=""
                loading="eager"
                decoding="async"
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center ${xfadeCls}`}
                style={
                  reduceMotion
                    ? { zIndex: zI("a") }
                    : {
                        opacity: dualI ? opacityI("a") : 1,
                        zIndex: dualI ? zI("a") : 0,
                        transitionDuration: dualI ? `${PREVIEW_CROSSFADE_MS}ms` : undefined,
                      }
                }
                aria-hidden
                onLoad={() => onInactiveImgLoad("a")}
                onTransitionEnd={(e) => onImgTransitionEnd(e, "a")}
              />
              {dualI ? (
                // eslint-disable-next-line @next/next/no-img-element -- 动态配置 URL；交叉淡化第二槽
                <img
                  src={iSrcB}
                  alt=""
                  loading="eager"
                  decoding="async"
                  className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center ${xfadeCls}`}
                  style={
                    reduceMotion
                      ? { zIndex: zI("b") }
                      : {
                          opacity: opacityI("b"),
                          zIndex: zI("b"),
                          transitionDuration: `${PREVIEW_CROSSFADE_MS}ms`,
                        }
                  }
                  aria-hidden
                  onLoad={() => onInactiveImgLoad("b")}
                  onTransitionEnd={(e) => onImgTransitionEnd(e, "b")}
                />
              ) : null}
            </>
          ) : (
            <>
              <video
                ref={slotARef}
                key={vSrcA}
                src={vSrcA}
                poster={poster || undefined}
                muted
                playsInline
                loop
                autoPlay
                preload="auto"
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center ${xfadeCls}`}
                style={
                  reduceMotion
                    ? { zIndex: zV("a") }
                    : {
                        opacity: dualV ? opacityV("a") : 1,
                        zIndex: dualV ? zV("a") : 0,
                        transitionDuration: dualV ? `${PREVIEW_CROSSFADE_MS}ms` : undefined,
                      }
                }
                aria-hidden
                onPlaying={() => onInactivePlaying("a")}
                onTransitionEnd={(e) => onVideoTransitionEnd(e, "a")}
                onError={() => onPreviewVideoError?.()}
              />
              {dualV ? (
                <video
                  ref={slotBRef}
                  key={vSrcB}
                  src={vSrcB}
                  poster={poster || undefined}
                  muted
                  playsInline
                  loop
                  autoPlay
                  preload="auto"
                  className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center ${xfadeCls}`}
                  style={
                    reduceMotion
                      ? { zIndex: zV("b") }
                      : {
                          opacity: opacityV("b"),
                          zIndex: zV("b"),
                          transitionDuration: `${PREVIEW_CROSSFADE_MS}ms`,
                        }
                  }
                  aria-hidden
                  onPlaying={() => onInactivePlaying("b")}
                  onTransitionEnd={(e) => onVideoTransitionEnd(e, "b")}
                  onError={() => onPreviewVideoError?.()}
                />
              ) : null}
            </>
          )}
        </div>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/22 via-black/[0.04] to-transparent px-2 pb-2 pt-5 text-center text-[10px] font-medium tracking-wide text-white/[0.58] drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.28)] sm:text-[11px]">
          {t("nature.previewTapHint")}
        </span>
      </button>
    </div>
  );
}
