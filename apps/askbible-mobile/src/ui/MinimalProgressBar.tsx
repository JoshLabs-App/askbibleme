import { useRef } from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  progress: number;
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
        now: Math.round(progress * 100),
      }}
    >
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: fillColor, width: `${Math.round(progress * 1000) / 10}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    flex: 1,
    minWidth: 48,
    paddingVertical: 8,
    justifyContent: "center",
  },
  track: {
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  fill: {
    height: 2,
    borderRadius: 1,
  },
});
