"use client";

import { useEffect, useRef } from "react";

/** 关闭预览后延迟释放隐藏 video，便于主画面同 URL 衔接 HTTP/媒体缓存 */
const TEARDOWN_DELAY_MS = 2600;
/** metadata 暖机后再升 preload=auto，错开预览动画首帧 */
const HEAVY_PREFETCH_AFTER_MS = 520;

function connectionSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}

function stripVideo(el: HTMLVideoElement | null) {
  if (!el) return;
  try {
    el.pause();
    el.removeAttribute("src");
    el.preload = "none";
    el.load();
  } catch {
    /* ignore */
  }
}

type Props = {
  /** 当前预览选中的那条影片的 URL（同源路径即可）；空表示预览已关 */
  videoSrc: string;
  playbackRate: number;
};

/**
 * 预览展开时：在离屏 `<video>` 上对同一条 URL 做 metadata →（可选）auto 暖机，不播放、不占交互。
 * 进入全屏时主 `<video>` 使用相同 `src`，浏览器更易复用已拉取的数据。
 */
export function NaturePreviewVideoWarmup({ videoSrc, playbackRate }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (teardownTimerRef.current != null) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    const el = ref.current;
    const src = videoSrc.trim();

    if (!src) {
      teardownTimerRef.current = setTimeout(() => {
        teardownTimerRef.current = null;
        stripVideo(ref.current);
      }, TEARDOWN_DELAY_MS);
      return () => {
        if (teardownTimerRef.current != null) {
          clearTimeout(teardownTimerRef.current);
          teardownTimerRef.current = null;
        }
      };
    }

    const saveData = connectionSaveData();
    let cancelled = false;
    let idleHandle: number | null = null;
    let kickTimeout: ReturnType<typeof setTimeout> | null = null;
    let heavyTimer: ReturnType<typeof setTimeout> | null = null;

    const kick = () => {
      if (cancelled || !ref.current) return;
      const v = ref.current;
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.playbackRate = playbackRate;
      v.preload = "metadata";
      v.src = src;
      try {
        v.load();
      } catch {
        /* ignore */
      }

      if (!saveData) {
        heavyTimer = setTimeout(() => {
          heavyTimer = null;
          if (cancelled || !ref.current) return;
          const cur = ref.current.getAttribute("src") ?? ref.current.currentSrc ?? "";
          if (!cur) return;
          ref.current.preload = "auto";
          try {
            ref.current.load();
          } catch {
            /* ignore */
          }
        }, HEAVY_PREFETCH_AFTER_MS);
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      idleHandle = requestIdleCallback(
        () => {
          idleHandle = null;
          kick();
        },
        { timeout: 900 },
      );
    } else {
      kickTimeout = setTimeout(() => {
        kickTimeout = null;
        kick();
      }, 32);
    }

    return () => {
      cancelled = true;
      if (idleHandle != null && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleHandle);
      }
      if (kickTimeout != null) clearTimeout(kickTimeout);
      if (heavyTimer != null) clearTimeout(heavyTimer);
    };
  }, [videoSrc, playbackRate]);

  return (
    <video
      ref={ref}
      className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px opacity-[0.01]"
      tabIndex={-1}
      aria-hidden
      muted
      playsInline
    />
  );
}
