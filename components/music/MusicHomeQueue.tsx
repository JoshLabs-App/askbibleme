"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const QUEUE_VIEWPORT_HEIGHT = 168;
export const QUEUE_ROW_HEIGHT = 40;
const QUEUE_FADE_BAND = 46;
const QUEUE_RECENTER_IDLE_MS = 5000;

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function rowOpacityByScroll(rowIndex: number, scrollY: number, active: boolean): number {
  const rowCenter = rowIndex * QUEUE_ROW_HEIGHT + QUEUE_ROW_HEIGHT / 2 - scrollY;
  if (rowCenter <= 0 || rowCenter >= QUEUE_VIEWPORT_HEIGHT) return 0;
  const topFade = clamp01(rowCenter / QUEUE_FADE_BAND);
  const bottomFade = clamp01((QUEUE_VIEWPORT_HEIGHT - rowCenter) / QUEUE_FADE_BAND);
  const edgeFade = Math.min(topFade, bottomFade);
  const base = Math.pow(edgeFade, 1.05);
  if (active) return Math.min(1, base * 0.96 + 0.04);
  return Math.max(0, base * 0.92);
}

export function rowScaleByScroll(rowIndex: number, scrollY: number, active: boolean): number {
  const rowCenter = rowIndex * QUEUE_ROW_HEIGHT + QUEUE_ROW_HEIGHT / 2 - scrollY;
  const center = QUEUE_VIEWPORT_HEIGHT / 2;
  const nearCenter = 1 - clamp01(Math.abs(rowCenter - center) / Math.max(1, center * 0.85));
  const base = 1 + nearCenter * 0.08;
  if (active) return Math.max(base, 1.14);
  return base;
}

type TrackRow = { id: string; title: string };

type Props = {
  tracks: TrackRow[];
  activeIdx: number;
  albumKey: string;
  onSelect: (idx: number) => void;
};

export function MusicHomeQueue({ tracks, activeIdx, albumKey, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const scrollYRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const recenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recenterAnimRafRef = useRef<number | null>(null);

  const blockHeight = tracks.length * QUEUE_ROW_HEIGHT;
  const loopEnabled = tracks.length > 1;

  const displayTracks = useMemo(() => {
    if (!loopEnabled) return tracks;
    return [...tracks, ...tracks, ...tracks];
  }, [tracks, loopEnabled]);

  const commitScrollY = useCallback((nextY: number) => {
    if (Math.abs(nextY - scrollYRef.current) < 0.5) return false;
    scrollYRef.current = nextY;
    setScrollY(nextY);
    return true;
  }, []);

  const animateScrollTo = useCallback((targetY: number, durationMs = 4000) => {
    const el = scrollRef.current;
    if (!el) return;
    if (recenterAnimRafRef.current != null) {
      cancelAnimationFrame(recenterAnimRafRef.current);
      recenterAnimRafRef.current = null;
    }
    const startY = scrollYRef.current;
    const delta = targetY - startY;
    if (Math.abs(delta) < 1) {
      el.scrollTop = targetY;
      scrollYRef.current = targetY;
      setScrollY(targetY);
      return;
    }
    const startAt = Date.now();
    const step = () => {
      const elapsed = Date.now() - startAt;
      const t = Math.min(1, elapsed / Math.max(1, durationMs));
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const y = startY + delta * eased;
      programmaticScrollRef.current = true;
      el.scrollTop = y;
      commitScrollY(y);
      if (t < 1) {
        recenterAnimRafRef.current = requestAnimationFrame(step);
      } else {
        recenterAnimRafRef.current = null;
        requestAnimationFrame(() => {
          programmaticScrollRef.current = false;
        });
      }
    };
    recenterAnimRafRef.current = requestAnimationFrame(step);
  }, [commitScrollY]);

  const scrollActiveToCenter = useCallback(
    (animated: boolean) => {
      if (tracks.length === 0 || blockHeight <= 0) return;
      const middleOffset = loopEnabled ? blockHeight : 0;
      const rowCenter = middleOffset + activeIdx * QUEUE_ROW_HEIGHT + QUEUE_ROW_HEIGHT / 2;
      const targetY = Math.max(0, rowCenter - QUEUE_VIEWPORT_HEIGHT / 2);
      if (Math.abs(targetY - scrollYRef.current) < 1) return;
      const el = scrollRef.current;
      if (!el) return;
      if (animated) {
        animateScrollTo(targetY);
      } else {
        programmaticScrollRef.current = true;
        el.scrollTop = targetY;
        commitScrollY(targetY);
        requestAnimationFrame(() => {
          programmaticScrollRef.current = false;
        });
      }
    },
    [activeIdx, animateScrollTo, blockHeight, commitScrollY, loopEnabled, tracks.length],
  );

  const scheduleAutoRecenter = useCallback(() => {
    if (recenterTimeoutRef.current) clearTimeout(recenterTimeoutRef.current);
    recenterTimeoutRef.current = setTimeout(() => {
      scrollActiveToCenter(true);
      recenterTimeoutRef.current = null;
    }, QUEUE_RECENTER_IDLE_MS);
  }, [scrollActiveToCenter]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (programmaticScrollRef.current) {
      commitScrollY(el.scrollTop);
      return;
    }
    if (recenterAnimRafRef.current != null) {
      cancelAnimationFrame(recenterAnimRafRef.current);
      recenterAnimRafRef.current = null;
    }
    let y = el.scrollTop;
    if (loopEnabled && blockHeight > 0) {
      if (y < blockHeight * 0.5) {
        y += blockHeight;
        el.scrollTop = y;
      } else if (y > blockHeight * 1.5) {
        y -= blockHeight;
        el.scrollTop = y;
      }
    }
    commitScrollY(y);
    scheduleAutoRecenter();
  }, [blockHeight, commitScrollY, loopEnabled, scheduleAutoRecenter]);

  useEffect(() => {
    scrollYRef.current = scrollY;
  }, [scrollY]);

  useEffect(() => {
    if (!loopEnabled || blockHeight <= 0) {
      scrollYRef.current = 0;
      setScrollY(0);
      return;
    }
    const y = blockHeight;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (Math.abs(el.scrollTop - y) < 1) {
        commitScrollY(y);
        return;
      }
      programmaticScrollRef.current = true;
      el.scrollTop = y;
      commitScrollY(y);
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    });
  }, [albumKey, blockHeight, commitScrollY, loopEnabled]);

  useEffect(() => {
    scrollActiveToCenter(false);
  }, [activeIdx, scrollActiveToCenter]);

  useEffect(() => {
    return () => {
      if (recenterTimeoutRef.current) clearTimeout(recenterTimeoutRef.current);
      if (recenterAnimRafRef.current != null) cancelAnimationFrame(recenterAnimRafRef.current);
    };
  }, []);

  if (tracks.length === 0) return null;

  return (
    <div className="music-home-queue-wrap">
      <div ref={scrollRef} className="music-home-queue" onScroll={onScroll}>
        {displayTracks.map((tr, displayIdx) => {
          const idx = loopEnabled ? displayIdx % tracks.length : displayIdx;
          const active = idx === activeIdx;
          const opacity = rowOpacityByScroll(displayIdx, scrollY, active);
          const scale = rowScaleByScroll(displayIdx, scrollY, active);
          return (
            <button
              key={`${tr.id}-${displayIdx}`}
              type="button"
              className={["music-home-queue-row", active ? "music-home-queue-row--active" : ""]
                .filter(Boolean)
                .join(" ")}
              style={{
                opacity,
                transform: `scale(${scale})`,
              }}
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(idx)}
            >
              {tr.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
