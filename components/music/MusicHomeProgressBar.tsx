"use client";

import { useCallback, useRef } from "react";

type Props = {
  progress: number;
  disabled?: boolean;
  ariaLabel: string;
  onSeekStart?: () => void;
  onSeekPreview?: (ratio: number) => void;
  onSeekRatio: (ratio: number) => void;
};

/** 对齐 iOS MinimalProgressBar：2px 细线，拖拽预览，松手 seek */
export function MusicHomeProgressBar({
  progress,
  disabled = false,
  ariaLabel,
  onSeekStart,
  onSeekPreview,
  onSeekRatio,
}: Props) {
  const trackRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);

  const ratioAt = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }, []);

  const finishSeek = useCallback(
    (clientX: number) => {
      if (disabled) return;
      const ratio = ratioAt(clientX);
      draggingRef.current = false;
      onSeekRatio(ratio);
    },
    [disabled, onSeekRatio, ratioAt],
  );

  return (
    <button
      ref={trackRef}
      type="button"
      className="music-home-progress"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onClick={(e) => {
        if (draggingRef.current) return;
        onSeekRatio(ratioAt(e.clientX));
      }}
      onPointerDown={(e) => {
        if (disabled) return;
        draggingRef.current = true;
        onSeekStart?.();
        onSeekPreview?.(ratioAt(e.clientX));
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (disabled || !draggingRef.current) return;
        onSeekPreview?.(ratioAt(e.clientX));
      }}
      onPointerUp={(e) => {
        if (!draggingRef.current) return;
        finishSeek(e.clientX);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      <span className="music-home-progress-fill" style={{ width: `${progress * 100}%` }} />
    </button>
  );
}
