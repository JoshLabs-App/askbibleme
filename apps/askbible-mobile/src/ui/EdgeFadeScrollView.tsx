import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
} from "react-native";
import { EdgeFadeScrollMask } from "./edgeFadeScrollMask";
import { nativeMaskedViewAvailable } from "./nativeMaskedViewAvailable";

type Props = ScrollViewProps & {
  fadeTopPx?: number;
  fadeBottomPx?: number;
  /** Mask 不可用时的叠层底色（与页面背景一致） */
  fallbackScrimColor?: string;
};

/**
 * 顶/底缘渐隐滚动区。需 RNCMaskedView（`expo run:ios` / `expo run:android`）；
 * 未编入时用半透明叠层近似。
 */
export const EdgeFadeScrollView = forwardRef<ScrollView, Props>(function EdgeFadeScrollView(
  {
    style,
    children,
    fadeTopPx = 28,
    fadeBottomPx = 36,
    fallbackScrimColor = "#0a0908",
    ...rest
  },
  ref,
) {
  const [viewportHeight, setViewportHeight] = useState(0);
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

  const scroll = (
    <ScrollView ref={ref} style={[styles.scroll, style]} {...rest}>
      {children}
    </ScrollView>
  );

  const showMask = canMask && viewportHeight > 0 && MaskedView;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {showMask ? (
        <MaskedView
          style={styles.flex}
          maskElement={
            <EdgeFadeScrollMask
              viewportHeight={viewportHeight}
              fadeTopPx={fadeTopPx}
              fadeBottomPx={fadeBottomPx}
            />
          }
        >
          {scroll}
        </MaskedView>
      ) : (
        scroll
      )}
      {!showMask && viewportHeight > 0 ? (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[fallbackScrimColor, "transparent"]}
            style={[styles.edgeScrim, { height: fadeTopPx }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", fallbackScrimColor]}
            style={[styles.edgeScrim, styles.edgeScrimBottom, { height: fadeBottomPx }]}
          />
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden",
  },
  flex: { flex: 1 },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  edgeScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
  },
  edgeScrimBottom: {
    top: undefined,
    bottom: 0,
  },
});
