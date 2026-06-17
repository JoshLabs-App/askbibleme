import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  UIManager,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  type ReadParchmentFadePreset,
  ReadParchmentScrollMask,
  SHELL_TAB_SCROLL_FADE_PRESET,
} from "../read/readParchmentScrollMask";

/** 每秒上移像素 */
const AUTO_SCROLL_PX_PER_SEC = 9;

function nativeMaskedViewAvailable(): boolean {
  if (Platform.OS === "web") return false;
  return (
    typeof UIManager.hasViewManagerConfig === "function" &&
    UIManager.hasViewManagerConfig("RNCMaskedView")
  );
}

type Props = {
  height: number;
  children: ReactNode;
  fadePreset?: ReadParchmentFadePreset;
  /** 缓慢上滚并无缝循环 */
  autoScroll?: boolean;
  /** 单圈经文块高度（由父级 onLayout 测量） */
  loopSegmentHeight?: number;
};

/**
 * 经文区：mask 让文字在顶/底缘渐隐（与读经 / 探索主 scroll 同一 preset）。
 * autoScroll 用 translate 动画，避免 MaskedView 内 scrollTo 卡住。
 */
export function ExploreScriptureFadeScroll({
  height,
  children,
  fadePreset = SHELL_TAB_SCROLL_FADE_PRESET,
  autoScroll = false,
  loopSegmentHeight = 0,
}: Props) {
  const [viewportHeight, setViewportHeight] = useState(height);
  const translateY = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const canMask = nativeMaskedViewAvailable();
  const MaskedView = useMemo(
    () =>
      canMask
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("@react-native-masked-view/masked-view").default
        : null,
    [canMask],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    if (next > 0) setViewportHeight(next);
  };

  const startMarquee = useCallback(() => {
    animRef.current?.stop();
    if (!autoScroll || loopSegmentHeight <= 0) return;
    translateY.setValue(0);
    const durationMs = Math.max(8000, (loopSegmentHeight / AUTO_SCROLL_PX_PER_SEC) * 1000);
    const anim = Animated.loop(
      Animated.timing(translateY, {
        toValue: -loopSegmentHeight,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animRef.current = anim;
    anim.start();
  }, [autoScroll, loopSegmentHeight, translateY]);

  useEffect(() => {
    startMarquee();
    return () => {
      animRef.current?.stop();
      animRef.current = null;
    };
  }, [startMarquee]);

  useFocusEffect(
    useCallback(() => {
      startMarquee();
      return () => {
        animRef.current?.stop();
        animRef.current = null;
      };
    }, [startMarquee]),
  );

  const body = autoScroll ? (
    <Animated.View style={[styles.marqueeTrack, { transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  ) : (
    children
  );

  const showMask = canMask && viewportHeight > 0 && MaskedView;

  return (
    <View style={[styles.wrap, { height }]} onLayout={onLayout} collapsable={false}>
      {showMask ? (
        <MaskedView
          style={[styles.masked, { height: viewportHeight }]}
          maskElement={
            <ReadParchmentScrollMask viewportHeight={viewportHeight} preset={fadePreset} />
          }
        >
          <View style={[styles.viewport, { height: viewportHeight }]}>{body}</View>
        </MaskedView>
      ) : (
        <View style={[styles.viewport, { height: viewportHeight }]}>{body}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
  },
  masked: {
    width: "100%",
  },
  viewport: {
    overflow: "hidden",
  },
  marqueeTrack: {
    width: "100%",
  },
});
