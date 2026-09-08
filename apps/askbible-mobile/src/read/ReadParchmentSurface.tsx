import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useShellFullBleedBackdropStyle, useShellFullBleedFrame } from "../shell/shellLayout";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { shouldUseWideParchmentScrollBackground } from "./parchmentColumnLayout";

const READ_PARCHMENT_SCROLL_SOURCE = require("../../assets/images/read-parchment-scroll-bg.jpg");
export const READ_PARCHMENT_SCROLL_SOURCE_WIDE = require("../../assets/images/read-parchment-scroll-bg-wide.jpg");

function resolveReadParchmentScrollSource(width: number, height: number) {
  if (shouldUseWideParchmentScrollBackground(width, height)) {
    return READ_PARCHMENT_SCROLL_SOURCE_WIDE;
  }
  return READ_PARCHMENT_SCROLL_SOURCE;
}

export function useReadParchmentScrollSource() {
  const frame = useShellFullBleedFrame();
  return useMemo(
    () => resolveReadParchmentScrollSource(frame.width, frame.height),
    [frame.width, frame.height],
  );
}


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
  parchmentShellAndroid: {
    // 允许底图向下伸出覆盖系统导航/底栏后方，避免只剩 canvas 实色条
    overflow: "visible",
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
  /** 贴屏幕底对齐（读经音频坞等浮层复用全屏羊皮底图，纹理与正文连续） */
  pinBottom = false,
}: {
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  source?: number;
  pinBottom?: boolean;
}) {
  const frame = useShellFullBleedFrame();
  const backdropStyle = useShellFullBleedBackdropStyle(frame);
  const dynamicSource = useReadParchmentScrollSource();
  const resolvedSource = source ?? dynamicSource;
  const positionStyle = pinBottom
    ? {
        position: "absolute" as const,
        left: 0,
        bottom: 0,
        width: frame.width,
        height: frame.height,
        zIndex: 0,
      }
    : { ...backdropStyle, width: frame.width, height: frame.height };
  return (
    <View style={[positionStyle, style]} pointerEvents="none" collapsable={false}>
      <Image
        source={resolvedSource}
        resizeMode="stretch"
        style={[
          StyleSheet.absoluteFillObject,
          styles.fillImage,
          { width: frame.width, height: frame.height },
          imageStyle,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no"
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
      style={[
        styles.parchmentContainer,
        styles.parchmentShell,
        Platform.OS === "android" && styles.parchmentShellAndroid,
        fill && styles.parchmentShellFill,
        style,
      ]}
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
