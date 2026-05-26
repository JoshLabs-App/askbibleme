import { getNativeSourceFromSource } from "expo-av/build/AV";
import ExponentVideo from "expo-av/build/ExponentVideo";
import type { AVPlaybackSource, AVPlaybackStatus } from "expo-av";
import type { VideoReadyForDisplayEvent } from "expo-av/build/Video.types";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ANDROID_NATIVE_LEFT_CENTER_CROP } from "./natureHomePortraitCoverLayout";

const WRAPPER_STYLES = StyleSheet.create({
  base: {
    overflow: "hidden",
    pointerEvents: "box-none",
  },
  video: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
});

type Props = {
  source: AVPlaybackSource | null;
  style?: StyleProp<ViewStyle>;
  videoStyle?: StyleProp<ViewStyle>;
  rate?: number;
  isLooping?: boolean;
  isMuted?: boolean;
  shouldPlay?: boolean;
  onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
  onReadyForDisplay?: (event: VideoReadyForDisplayEvent) => void;
};

/**
 * Android 竖屏首页：绕过 expo-av `Video` 的 resizeMode 映射（COVER → CENTER_CROP），
 * 直接向原生传入 LEFT_CENTER_CROP（ordinal 15）。
 */
export function AndroidLeftCropExponentVideo({
  source,
  style,
  videoStyle,
  rate = 1,
  isLooping = true,
  isMuted = true,
  shouldPlay = true,
  onPlaybackStatusUpdate,
  onReadyForDisplay,
}: Props) {
  const nativeSource = getNativeSourceFromSource(source) ?? undefined;
  if (nativeSource == null) return null;

  return (
    <View style={[WRAPPER_STYLES.base, style]}>
      <ExponentVideo
        source={nativeSource}
        style={[WRAPPER_STYLES.video, videoStyle]}
        resizeMode={ANDROID_NATIVE_LEFT_CENTER_CROP}
        useNativeControls={false}
        status={{
          shouldPlay,
          isMuted,
          isLooping,
          rate,
          progressUpdateIntervalMillis: 200,
        }}
        onStatusUpdate={(event: { nativeEvent: AVPlaybackStatus }) => {
          onPlaybackStatusUpdate?.(event.nativeEvent);
        }}
        onReadyForDisplay={(event: { nativeEvent: VideoReadyForDisplayEvent }) => {
          onReadyForDisplay?.(event.nativeEvent);
        }}
      />
    </View>
  );
}
