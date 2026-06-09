import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  ImageBackground,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";

export const READ_PARCHMENT_SCROLL_SOURCE = require("../../assets/images/read-parchment-scroll-bg.jpg");

const parchmentSource = READ_PARCHMENT_SCROLL_SOURCE;

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
};

const styles = StyleSheet.create({
  parchmentContainer: {
    backgroundColor: c.canvas,
  },
  parchmentShell: {
    position: "relative",
    overflow: "hidden",
  },
  parchmentForeground: {
    position: "relative",
    zIndex: 1,
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
}: {
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}) {
  return (
    <ImageBackground
      source={parchmentSource}
      resizeMode="stretch"
      style={[StyleSheet.absoluteFillObject, style]}
      imageStyle={[styles.fillImage, imageStyle]}
      pointerEvents="none"
    />
  );
}

/**
 * 弹层/卡片羊皮底：实图层绝对铺满外壳，正文（含 padding）叠在上层。
 * 避免 ImageBackground 包裹子节点时在 Modal 内高度不同步，或 padding 区露出纯色底。
 */
export function ReadParchmentBackgroundImage({
  children,
  style,
  imageStyle,
}: ReadParchmentBackgroundProps) {
  return (
    <View style={[styles.parchmentContainer, styles.parchmentShell]} collapsable={false}>
      <ReadParchmentFillLayer imageStyle={imageStyle} />
      <View style={[styles.parchmentForeground, style]} pointerEvents="box-none">
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
