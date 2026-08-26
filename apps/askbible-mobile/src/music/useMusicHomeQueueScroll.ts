import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from "react-native";
import { animateMusicHomeQueueScroll } from "./musicHomeQueueScrollAnimate";
import {
  MUSIC_HOME_QUEUE_CENTER_PAD,
  MUSIC_HOME_QUEUE_ROW_HEIGHT,
  MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT,
} from "./musicHomeQueueScroll";

const QUEUE_RECENTER_IDLE_MS = 5000;

type Args = {
  album: string;
  trackIndex: number;
  filteredTrackIndices: number[];
};

/**
 * 滚动位置只以 Animated.Value 存在，不进 React state——行的淡入淡出由它在原生侧驱动。
 * JS 这边的监听只做空闲后自动回中的计时，不触发重渲染。
 */
export function useMusicHomeQueueScroll({ album, trackIndex, filteredTrackIndices }: Args) {
  const queueScrollV = useRef(new Animated.Value(0)).current;
  const queueScrollRef = useRef<ScrollView | null>(null);
  const recenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recenterAnimRafRef = useRef<number | null>(null);
  const queueScrollYRef = useRef(0);

  const setScrollY = useCallback(
    (y: number) => {
      queueScrollYRef.current = y;
      queueScrollV.setValue(y);
    },
    [queueScrollV],
  );

  const scrollActiveToCenter = useCallback(
    (animated: boolean) => {
      const activeLocalIdx = filteredTrackIndices.findIndex((idx) => idx === trackIndex);
      if (activeLocalIdx < 0) return;
      // 内容顶部有 CENTER_PAD 留白，所以第一行也能滚到正中。
      const rowTop = MUSIC_HOME_QUEUE_CENTER_PAD + activeLocalIdx * MUSIC_HOME_QUEUE_ROW_HEIGHT;
      const targetY = Math.max(
        0,
        rowTop + MUSIC_HOME_QUEUE_ROW_HEIGHT / 2 - MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT / 2,
      );
      if (Math.abs(targetY - queueScrollYRef.current) < 1) return;
      if (animated) {
        animateMusicHomeQueueScroll({
          scrollRef: queueScrollRef,
          startY: queueScrollYRef.current,
          targetY,
          durationMs: 4000,
          animRafRef: recenterAnimRafRef,
          onY: setScrollY,
        });
      } else {
        queueScrollRef.current?.scrollTo({ y: targetY, animated: false });
        setScrollY(targetY);
      }
    },
    [filteredTrackIndices, setScrollY, trackIndex],
  );

  useEffect(() => {
    scrollActiveToCenter(true);
  }, [scrollActiveToCenter, trackIndex, album]);

  useEffect(() => {
    return () => {
      if (recenterTimeoutRef.current) clearTimeout(recenterTimeoutRef.current);
      if (recenterAnimRafRef.current != null) cancelAnimationFrame(recenterAnimRafRef.current);
    };
  }, []);

  const onQueueScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (recenterAnimRafRef.current != null) {
        cancelAnimationFrame(recenterAnimRafRef.current);
        recenterAnimRafRef.current = null;
      }
      setScrollY(e.nativeEvent.contentOffset.y);
      if (recenterTimeoutRef.current) clearTimeout(recenterTimeoutRef.current);
      recenterTimeoutRef.current = setTimeout(() => {
        scrollActiveToCenter(true);
        recenterTimeoutRef.current = null;
      }, QUEUE_RECENTER_IDLE_MS);
    },
    [scrollActiveToCenter, setScrollY],
  );

  return {
    queueScrollV,
    queueScrollRef: queueScrollRef as RefObject<ScrollView | null>,
    onQueueScroll,
  };
}
