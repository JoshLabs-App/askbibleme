import { useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

type Props = {
  /**
   * 0～1。传 Animated.Value 时填充完全由原生驱动，组件不会因进度变化重渲染。
   * scaleX 是 transform，不像 width 百分比那样每次都要重新布局。
   */
  progress: number | Animated.Value;
  /** progress 为 Animated.Value 时的无障碍读数（0～100），可低频更新。 */
  accessibilityPercent?: number;
  disabled?: boolean;
  onSeekRatio: (ratio: number) => void;
  onSeekStart?: () => void;
  onSeekPreview?: (ratio: number) => void;
  onSeekEnd?: (ratio: number) => void;
  accessibilityLabel: string;
  trackColor?: string;
  fillColor?: string;
};

/** 2px 细线进度：点按跳转，无滑块 */
export function MinimalProgressBar({
  progress,
  accessibilityPercent,
  disabled = false,
  onSeekRatio,
  onSeekStart,
  onSeekPreview,
  onSeekEnd,
  accessibilityLabel,
  trackColor = "rgba(255,255,255,0.14)",
  fillColor = "rgba(255,255,255,0.78)",
}: Props) {
  const trackW = useRef(0);
  const draggingRef = useRef(false);

  const ratioAt = (x: number) => {
    if (trackW.current <= 0) return 0;
    return Math.max(0, Math.min(1, x / trackW.current));
  };

  return (
    <View
      onLayout={(e) => {
        trackW.current = e.nativeEvent.layout.width;
      }}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={(e) => {
        if (disabled) return;
        draggingRef.current = true;
        onSeekStart?.();
        onSeekPreview?.(ratioAt(e.nativeEvent.locationX));
      }}
      onResponderMove={(e) => {
        if (disabled || !draggingRef.current) return;
        onSeekPreview?.(ratioAt(e.nativeEvent.locationX));
      }}
      onResponderRelease={(e) => {
        if (disabled) return;
        const ratio = ratioAt(e.nativeEvent.locationX);
        draggingRef.current = false;
        onSeekEnd?.(ratio);
        onSeekRatio(ratio);
      }}
      onResponderTerminate={(e) => {
        if (disabled || !draggingRef.current) return;
        const ratio = ratioAt(e.nativeEvent.locationX);
        draggingRef.current = false;
        onSeekEnd?.(ratio);
        onSeekRatio(ratio);
      }}
      style={styles.hit}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: accessibilityPercent ?? (typeof progress === "number" ? Math.round(progress * 100) : 0),
      }}
    >
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: fillColor, transform: [{ scaleX: progress }] }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: "100%",
    alignSelf: "stretch",
    minWidth: 48,
    minHeight: 23,
    // 细线视觉保留，触控区加高，避免点进度条时总是点空。
    paddingVertical: 10,
    justifyContent: "center",
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
    // scaleX 默认绕中心缩放；锚到左边才是进度条该有的增长方向。
    transformOrigin: "left",
  },
});
