import { BlurView } from "expo-blur";
import { Image, Platform, StyleSheet, View } from "react-native";
import { blurIntensityFromPx, type NatureSoftFocusPrefs } from "./natureHomePrefs";

type BlurLayerProps = {
  blurPx: number;
  posterUri?: string;
  style?: object;
};

/** Android 无法对 Surface 视频做 backdrop-blur；用场景静帧 + BlurView 模拟磨砂 */
function AndroidPosterFrostBlur({ blurPx, posterUri, style }: Required<Pick<BlurLayerProps, "blurPx" | "posterUri">> & { style?: object }) {
  // Android 上 BlurView 常表现为偏灰遮罩；改为海报本身高斯模糊，确保是“真实模糊”。
  const blurRadius = Math.max(4, Math.round(blurPx * 1.2));
  const heavy = blurPx > 12;
  const veilColor = heavy ? "rgba(245,240,232,0.14)" : "rgba(245,240,232,0.08)";

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={{ uri: posterUri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        blurRadius={blurRadius}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: veilColor }]} />
    </View>
  );
}

/** 无海报时的 Android 兜底：浅色磨砂（避免 `tint=dark` 像单纯压暗） */
function AndroidFrostScrimFallback({ blurPx, style }: { blurPx: number; style?: object }) {
  const heavy = blurPx > 12;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        style,
        { backgroundColor: heavy ? "rgba(245, 240, 232, 0.42)" : "rgba(245, 240, 232, 0.24)" },
      ]}
    />
  );
}

/** 与设置菜单背板、首页视频区共用；iOS 仍用系统 backdrop blur */
export function NatureHomeBlurBackdrop({ blurPx, posterUri, style }: BlurLayerProps) {
  if (blurPx <= 0.02) return null;
  const intensity = blurIntensityFromPx(blurPx);
  if (intensity <= 0) return null;

  const trimmedPoster = posterUri?.trim() ?? "";
  if (Platform.OS === "android") {
    if (trimmedPoster) {
      return <AndroidPosterFrostBlur blurPx={blurPx} posterUri={trimmedPoster} style={style} />;
    }
    return <AndroidFrostScrimFallback blurPx={blurPx} style={style} />;
  }

  return (
    <BlurView
      tint="dark"
      intensity={intensity}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}

type SoftFocusLayerProps = {
  prefs: NatureSoftFocusPrefs | null;
  posterUri?: string;
};

/**
 * 全屏叠在视频舞台上（与网站 `backdrop-filter` 层同位），不盖住经文 / 壳层图标。
 */
export function NatureHomeSoftFocusLayer({ prefs, posterUri }: SoftFocusLayerProps) {
  if (!prefs) return null;

  const showBlur = prefs.blurPx > 0.02;
  const showDim = prefs.overlayOpacity > 0.02;
  if (!showBlur && !showDim) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.stack]}>
      {showBlur ? <NatureHomeBlurBackdrop blurPx={prefs.blurPx} posterUri={posterUri} /> : null}
      {showDim ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${prefs.overlayOpacity})` }]}
        />
      ) : null}
    </View>
  );
}

/** 设置面板背板（Android）：与视频区同款海报磨砂 */
export function NatureHomeSettingsMenuBackdrop({
  blurPx,
  posterUri,
}: {
  blurPx: number;
  posterUri?: string;
}) {
  if (Platform.OS !== "android" || blurPx <= 0.02) return null;
  return <NatureHomeBlurBackdrop blurPx={blurPx} posterUri={posterUri} />;
}

const styles = StyleSheet.create({
  stack: { zIndex: 8 },
});
