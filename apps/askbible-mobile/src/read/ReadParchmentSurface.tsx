import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  ImageBackground,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";

const parchmentSource = require("../../assets/images/read-parchment-scroll-bg.jpg");

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

/** 读经羊皮底图默认样式：拉伸铺满容器。 */
export function ReadParchmentBackgroundImage({
  children,
  style,
  imageStyle,
}: ReadParchmentBackgroundProps) {
  return (
    <ImageBackground
      source={parchmentSource}
      resizeMode="stretch"
      style={style}
      imageStyle={imageStyle}
    >
      {children}
    </ImageBackground>
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

const styles = StyleSheet.create({
  edgeFade: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
