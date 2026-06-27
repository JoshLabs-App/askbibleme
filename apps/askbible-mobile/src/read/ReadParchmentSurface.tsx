import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { shouldUseWideParchmentScrollBackground } from "./parchmentColumnLayout";

export const READ_PARCHMENT_SCROLL_SOURCE = require("../../assets/images/read-parchment-scroll-bg.jpg");
export const READ_PARCHMENT_SCROLL_SOURCE_WIDE = require("../../assets/images/read-parchment-scroll-bg-wide.jpg");

export function resolveReadParchmentScrollSource(width: number, height: number) {
  if (shouldUseWideParchmentScrollBackground(width, height)) {
    return READ_PARCHMENT_SCROLL_SOURCE_WIDE;
  }
  return READ_PARCHMENT_SCROLL_SOURCE;
}

export function useReadParchmentScrollSource() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => resolveReadParchmentScrollSource(width, height), [width, height]);
}

const DEFAULT_EDGE_FADE_TOP_PX = 14;
const DEFAULT_EDGE_FADE_BOTTOM_PX = 18;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const n = Number.parseInt(value, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(236, 217, 185, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

type ReadParchmentBackgroundProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  /** Modal 内撑满父级高度，避免部分 Android 机型章网格高度塌缩。 */
  fill?: boolean;
} & Pick<ViewProps, "onStartShouldSetResponder">;

const styles = StyleSheet.create({
  parchmentContainer: {
    backgroundColor: c.canvas,
  },
  parchmentShell: {
    position: "relative",
    overflow: "hidden",
  },
  parchmentShellFill: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
  },
  parchmentForeground: {
    position: "relative",
    zIndex: 1,
  },
  parchmentForegroundFill: {
    flex: 1,
    width: "100%",
  },
  fillImage: {
    width: "100%",
    height: "100%",
  },
  edgeFade: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});

/** 与 {@link ReadParchmentBackground} 相同：绝对铺满父级的羊皮 JPG 实图层。 */
export function ReadParchmentFillLayer({
  style,
  imageStyle,
  source,
}: {
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  source?: number;
}) {
  const dynamicSource = useReadParchmentScrollSource();
  const resolvedSource = source ?? dynamicSource;
  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <ImageBackground
        source={resolvedSource}
        resizeMode="stretch"
        style={StyleSheet.absoluteFillObject}
        imageStyle={[styles.fillImage, imageStyle]}
      />
    </View>
  );
}

/**
 * 弹层/卡片羊皮底：实图层绝对铺满外壳，正文（含 padding）叠在上层。
 * 全屏 Tab 栈请用 {@link ReadParchmentBackground}；圆角卡片 / 自定义尺寸用本组件。
 */
export function ReadParchmentBackgroundImage({
  children,
  style,
  imageStyle,
  fill = false,
  ...viewProps
}: ReadParchmentBackgroundProps) {
  return (
    <View
      style={[styles.parchmentContainer, styles.parchmentShell, fill && styles.parchmentShellFill, style]}
      collapsable={false}
      {...viewProps}
    >
      <ReadParchmentFillLayer imageStyle={imageStyle} />
      <View
        style={[styles.parchmentForeground, fill && styles.parchmentForegroundFill]}
        pointerEvents="box-none"
      >
        {children}
      </View>
    </View>
  );
}

type ReadParchmentEdgeFadeOverlayProps = {
  colorHex?: string;
  topPx?: number;
  bottomPx?: number;
};

/** 读经滚动区默认顶/底渐隐（仅视觉，不拦截点击）。 */
export function ReadParchmentEdgeFadeOverlay({
  colorHex = c.canvas,
  topPx = DEFAULT_EDGE_FADE_TOP_PX,
  bottomPx = DEFAULT_EDGE_FADE_BOTTOM_PX,
}: ReadParchmentEdgeFadeOverlayProps) {
  const topSolid = rgbaFromHex(colorHex, 0.78);
  const bottomSolid = rgbaFromHex(colorHex, 0.82);

  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[topSolid, "rgba(0,0,0,0)"]}
        style={[styles.edgeFade, { top: 0, height: topPx }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0)", bottomSolid]}
        style={[styles.edgeFade, { bottom: 0, height: bottomPx }]}
      />
    </>
  );
}
