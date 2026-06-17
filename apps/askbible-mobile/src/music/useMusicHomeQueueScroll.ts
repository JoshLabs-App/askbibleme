import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ScrollView } from "react-native";
import {
  animateMusicHomeQueueScroll,
  stabilizeMusicHomeQueueScrollY,
} from "./musicHomeQueueScrollAnimate";
import {
  MUSIC_HOME_QUEUE_ROW_HEIGHT,
  MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT,
} from "./musicHomeQueueScroll";

const QUEUE_RECENTER_IDLE_MS = 5000;

type Args = {
  album: string;
  trackIndex: number;
  filteredTrackIndices: number[];
};

export function useMusicHomeQueueScroll({ album, trackIndex, filteredTrackIndices }: Args) {
  const [queueScrollY, setQueueScrollY] = useState(0);
  const queueScrollRef = useRef<ScrollView | null>(null);
  const recenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recenterAnimRafRef = useRef<number | null>(null);
  const queueScrollYRef = useRef(0);
  queueScrollYRef.current = queueScrollY;

  const queueLoopBlockHeight = useMemo(
    () => filteredTrackIndices.length * MUSIC_HOME_QUEUE_ROW_HEIGHT,
    [filteredTrackIndices.length],
  );

  const queueDisplayIndices = useMemo(() => {
    if (filteredTrackIndices.length <= 1) return filteredTrackIndices;
    return [...filteredTrackIndices, ...filteredTrackIndices, ...filteredTrackIndices];
  }, [filteredTrackIndices]);

  useEffect(() => {
    if (filteredTrackIndices.length <= 1 || queueLoopBlockHeight <= 0) {
      setQueueScrollY(0);
      return;
    }
    const y = queueLoopBlockHeight;
    requestAnimationFrame(() => {
      queueScrollRef.current?.scrollTo({ y, animated: false });
      setQueueScrollY(y);
    });
  }, [album, filteredTrackIndices.length, queueLoopBlockHeight]);

  const animateQueueScrollTo = useCallback(
    (targetY: number, durationMs = 4000) => {
      animateMusicHomeQueueScroll({
        scrollRef: queueScrollRef,
        startY: queueScrollYRef.current,
        targetY,
        durationMs,
        animRafRef: recenterAnimRafRef,
        onY: setQueueScrollY,
      });
    },
    [],
  );

  const scrollActiveToCenter = useCallback(
    (animated: boolean) => {
      if (filteredTrackIndices.length <= 0 || queueLoopBlockHeight <= 0) return;
      const activeLocalIdx = filteredTrackIndices.findIndex((idx) => idx === trackIndex);
      if (activeLocalIdx < 0) return;
      const middleBlockOffset = queueLoopBlockHeight;
      const rowCenter =
        middleBlockOffset + activeLocalIdx * MUSIC_HOME_QUEUE_ROW_HEIGHT + MUSIC_HOME_QUEUE_ROW_HEIGHT / 2;
      const targetY = Math.max(0, rowCenter - MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT / 2);
      if (Math.abs(targetY - queueScrollYRef.current) < 1) return;
      if (animated) {
        animateQueueScrollTo(targetY);
      } else {
        queueScrollRef.current?.scrollTo({ y: targetY, animated: false });
        setQueueScrollY(targetY);
      }
    },
    [animateQueueScrollTo, filteredTrackIndices, queueLoopBlockHeight, trackIndex],
  );

  useEffect(() => {
    scrollActiveToCenter(true);
  }, [scrollActiveToCenter, trackIndex, album]);

  useEffect(() => {
    return () => {
      if (recenterTimeoutRef.current) {
        clearTimeout(recenterTimeoutRef.current);
        recenterTimeoutRef.current = null;
      }
      if (recenterAnimRafRef.current != null) {
        cancelAnimationFrame(recenterAnimRafRef.current);
        recenterAnimRafRef.current = null;
      }
    };
  }, []);

  const scheduleAutoRecenter = useCallback(() => {
    if (recenterTimeoutRef.current) clearTimeout(recenterTimeoutRef.current);
    recenterTimeoutRef.current = setTimeout(() => {
      scrollActiveToCenter(true);
      recenterTimeoutRef.current = null;
    }, QUEUE_RECENTER_IDLE_MS);
  }, [scrollActiveToCenter]);

  const onQueueScroll = useCallback(
    (y: number) => {
      if (recenterAnimRafRef.current != null) {
        cancelAnimationFrame(recenterAnimRafRef.current);
        recenterAnimRafRef.current = null;
      }
      if (filteredTrackIndices.length <= 1 || queueLoopBlockHeight <= 0) {
        setQueueScrollY(y);
        scheduleAutoRecenter();
        return;
      }
      const stableY = stabilizeMusicHomeQueueScrollY(y, queueLoopBlockHeight, queueScrollRef);
      setQueueScrollY(stableY);
      scheduleAutoRecenter();
    },
    [filteredTrackIndices.length, queueLoopBlockHeight, scheduleAutoRecenter],
  );

  return {
    queueScrollY,
    queueScrollRef: queueScrollRef as RefObject<ScrollView | null>,
    queueLoopBlockHeight,
    queueDisplayIndices,
    onQueueScroll,
  };
}
