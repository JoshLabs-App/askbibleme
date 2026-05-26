import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
} from "react-native";
import { EdgeFadeHorizontalScrollMask } from "./edgeFadeScrollMask";

function nativeMaskedViewAvailable(): boolean {
  if (Platform.OS === "web") return false;
  return (
    typeof UIManager.hasViewManagerConfig === "function" &&
    UIManager.hasViewManagerConfig("RNCMaskedView")
  );
}

type Props = ScrollViewProps & {
  fadeLeftPx?: number;
  fadeRightPx?: number;
  /** Mask 不可用时的叠层色（与底栏背景接近） */
  fallbackScrimColor?: string;
};

/**
 * 左/右缘渐隐横向滚动区。需 RNCMaskedView（`expo run:ios` / `expo run:android`）；
 * 未编入时用半透明叠层近似。
 */
export const EdgeFadeHorizontalScrollView = forwardRef<ScrollView, Props>(
  function EdgeFadeHorizontalScrollView(
    {
      style,
      children,
      fadeLeftPx = 24,
      fadeRightPx = 24,
      fallbackScrimColor = "rgba(0,0,0,0.55)",
      horizontal = true,
      ...rest
    },
    ref,
  ) {
    const [viewportWidth, setViewportWidth] = useState(0);
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
      const next = Math.round(e.nativeEvent.layout.width);
      if (next > 0) setViewportWidth(next);
    };

    const scroll = (
      <ScrollView ref={ref} horizontal={horizontal} style={[styles.scroll, style]} {...rest}>
        {children}
      </ScrollView>
    );

    const showMask = canMask && viewportWidth > 0 && MaskedView;

    return (
      <View style={styles.wrap} onLayout={onLayout}>
        {showMask ? (
          <MaskedView
            style={styles.flex}
            maskElement={
              <EdgeFadeHorizontalScrollMask
                viewportWidth={viewportWidth}
                fadeLeftPx={fadeLeftPx}
                fadeRightPx={fadeRightPx}
              />
            }
          >
            {scroll}
          </MaskedView>
        ) : (
          scroll
        )}
        {!showMask && viewportWidth > 0 ? (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={[fallbackScrimColor, "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.edgeScrim, styles.edgeScrimLeft, { width: fadeLeftPx }]}
            />
            <LinearGradient
              pointerEvents="none"
              colors={["transparent", fallbackScrimColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.edgeScrim, styles.edgeScrimRight, { width: fadeRightPx }]}
            />
          </>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden",
    alignSelf: "stretch",
  },
  flex: { flexGrow: 0, flexShrink: 1, alignSelf: "stretch" },
  scroll: {
    flexGrow: 0,
    backgroundColor: "transparent",
  },
  edgeScrim: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 2,
  },
  edgeScrimLeft: {
    left: 0,
  },
  edgeScrimRight: {
    right: 0,
  },
});
