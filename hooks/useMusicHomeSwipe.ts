"use client";

import { useCallback, useRef } from "react";

const SWIPE_MIN_DX = 56;

/** 音乐页内左右滑切歌（与 iOS useShellSwipeAction + onMusicSwipe 一致） */
export function useMusicHomeSwipe(
  active: boolean,
  onSwipe: (direction: "left" | "right") => void,
) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      startRef.current = { x: t.clientX, y: t.clientY };
    },
    [active],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = startRef.current;
      startRef.current = null;
      if (!active || !s || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0]!;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      onSwipe(dx < 0 ? "left" : "right");
    },
    [active, onSwipe],
  );

  return { onTouchStart, onTouchEnd };
}
