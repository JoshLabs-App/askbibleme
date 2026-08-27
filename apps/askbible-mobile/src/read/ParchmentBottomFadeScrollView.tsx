import { useIsFocused } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ScrollViewProps,
} from "react-native";
import {
  type ReadParchmentFadePreset,
  readParchmentFadeSafePadding,
  ReadParchmentScrollMask,
} from "./readParchmentScrollMask";
import { nativeMaskedViewAvailable } from "../ui/nativeMaskedViewAvailable";

type Props = ScrollViewProps & {
  /** auto：按路由自动判定；prose：探索长文；tabbar：更重；default：更轻 */
  fadePreset?: ReadParchmentFadePreset | "auto";
  /** Android 上 MaskedView + TextInput 可能触发原生崩溃，搜索等输入页可关闭 */
  maskEnabled?: boolean;
};

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isShellTabRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (p === "/" || p === "/index") return true;
  if (/^\/?\(tabs\)(\/|$)/.test(p)) return true;
  return /^\/(music|read|explore|prayer|journey)(\/|$)/.test(p);
}

/**
 * 羊皮卷滚动区：顶/底 MaskedView 让正文渐隐。
 * 需 RNCMaskedView（`npx expo run:ios`）；未编入时与普通 ScrollView 相同。
 */
export const ParchmentBottomFadeScrollView = forwardRef<ScrollView, Props>(
  function ParchmentBottomFadeScrollView(
    { style, children, contentContainerStyle, fadePreset = "auto", maskEnabled = true, ...rest },
    ref,
  ) {
    const pathname = usePathname();
    const focused = useIsFocused();
    const { height: windowHeight } = useWindowDimensions();
    const rootRef = useRef<View>(null);
    const lastViewportHeightRef = useRef(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const canMask = maskEnabled && nativeMaskedViewAvailable();

    const remeasureViewport = () => {
      rootRef.current?.measure((_x, _y, _w, h) => {
        const next = Math.round(h);
        if (next > 0) setViewportHeight(next);
      });
    };

    useEffect(() => {
      if (!focused) return;
      requestAnimationFrame(remeasureViewport);
    }, [focused]);

    useEffect(() => {
      if (viewportHeight > 0) lastViewportHeightRef.current = viewportHeight;
    }, [viewportHeight]);

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

    const resolvedPreset: ReadParchmentFadePreset =
      fadePreset === "auto"
        ? isShellTabRoute(pathname || "") ? "tabbar" : "default"
        : fadePreset;
    const safePadding = readParchmentFadeSafePadding(resolvedPreset);

    const scroll = (
      <ScrollView
        ref={ref}
        style={[styles.scroll, style]}
        contentContainerStyle={[
          {
            paddingTop: safePadding.top,
            paddingBottom: safePadding.bottom,
          },
          contentContainerStyle,
        ]}
        {...rest}
      >
        {children}
      </ScrollView>
    );

    const effectiveViewportHeight =
      viewportHeight > 0
        ? viewportHeight
        : lastViewportHeightRef.current > 0
          ? lastViewportHeightRef.current
          : Math.round(windowHeight);
    const showScrollMask = canMask && MaskedView && effectiveViewportHeight > 0;

    return (
      <View ref={rootRef} style={styles.flex} onLayout={onLayout} collapsable={false}>
        {showScrollMask ? (
          <MaskedView
            style={styles.maskedScroll}
            needsOffscreenAlphaCompositing={Platform.OS === "ios"}
            maskElement={
              <ReadParchmentScrollMask
                viewportHeight={effectiveViewportHeight}
                preset={resolvedPreset}
              />
            }
          >
            {scroll}
          </MaskedView>
        ) : (
          scroll
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  maskedScroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: { flex: 1, backgroundColor: "transparent" },
});
