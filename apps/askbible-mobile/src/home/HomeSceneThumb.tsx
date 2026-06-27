import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";

export const HOME_SCENE_THUMB_SIZE = 64;
export const HOME_SCENE_THUMB_GAP = 10;
/** 单侧留白（阴影）；`slot` 总宽 = SIZE + SLOT_PAD */
export const HOME_SCENE_THUMB_SLOT_PAD = 10;
export const HOME_SCENE_THUMB_SLOT_WIDTH =
  HOME_SCENE_THUMB_SIZE + HOME_SCENE_THUMB_SLOT_PAD;
/** 相邻缩略图起点间距（含 gap） */
export const HOME_SCENE_THUMB_STRIDE =
  HOME_SCENE_THUMB_SLOT_WIDTH + HOME_SCENE_THUMB_GAP;

/** 横向场景条内容总宽（n 个缩略图 + gap） */
export function homeSceneStripContentWidth(itemCount: number): number {
  if (itemCount <= 0) return 0;
  return (
    itemCount * HOME_SCENE_THUMB_SLOT_WIDTH +
    Math.max(0, itemCount - 1) * HOME_SCENE_THUMB_GAP
  );
}

/** 将第 index 项滚入视口（可含左右 content padding，与缘渐隐对齐） */
export function homeSceneStripScrollX(
  index: number,
  viewportWidth: number,
  itemCount: number,
  edgePadding = 0,
): number {
  if (itemCount <= 0 || viewportWidth < 1 || index < 0) return 0;
  const contentW = homeSceneStripContentWidth(itemCount) + edgePadding * 2;
  const x = edgePadding + index * HOME_SCENE_THUMB_STRIDE;
  const maxScroll = Math.max(0, contentW - viewportWidth);
  const centered = x - (viewportWidth - HOME_SCENE_THUMB_SLOT_WIDTH) / 2;
  return Math.max(0, Math.min(centered, maxScroll));
}

const CORNER = HOME_SCENE_THUMB_SIZE / 2;
/** 未选中略缩小、降透明度；选中满尺寸——接近照片/Apple TV 胶片条，不用描边与下点 */
const SCALE_REST = 0.9;
const SCALE_SELECTED = 1;
const OPACITY_REST = 0.55;
const OPACITY_SELECTED = 1;

function thumbSlotHeight(slotPad: number): number {
  return HOME_SCENE_THUMB_SIZE + slotPad * 2;
}

type Props = {
  selected: boolean;
  thumbModule: number | null;
  thumbUri?: string;
  fallbackLabel: string;
  onPress: () => void;
  /** 横屏沉浸：缩小槽位上下留白，场景条更贴底 */
  slotPad?: number;
};

/** 首页底部场景缩略图：iOS 式 scale + opacity，无描边/指示点 */
export function HomeSceneThumb({
  selected,
  thumbModule,
  thumbUri,
  fallbackLabel,
  onPress,
  slotPad = HOME_SCENE_THUMB_SLOT_PAD,
}: Props) {
  const focus = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const [thumbFailed, setThumbFailed] = useState(false);

  useEffect(() => {
    setThumbFailed(false);
  }, [thumbModule, thumbUri]);

  useEffect(() => {
    Animated.spring(focus, {
      toValue: selected ? 1 : 0,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [focus, selected]);

  const scale = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [SCALE_REST, SCALE_SELECTED],
  });
  const opacity = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [OPACITY_REST, OPACITY_SELECTED],
  });

  const normalizedUri = typeof thumbUri === "string" ? thumbUri.trim() : "";
  const thumbSource: ImageSourcePropType | null =
    thumbModule != null ? thumbModule : normalizedUri ? { uri: normalizedUri } : null;
  const showImage = thumbSource != null && !thumbFailed;
  const showFallback = thumbSource == null || thumbFailed;

  const handlePress = () => {
    if (!selected) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <View style={[styles.slot, { height: thumbSlotHeight(slotPad) }]}>
      <Animated.View
        style={[
          styles.animWrap,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={[styles.shadowWrap, selected && styles.shadowWrapSelected]}>
          <Pressable
            onPress={handlePress}
            style={({ pressed }) => [styles.core, pressed && styles.corePressed]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            android_ripple={{
              color: "rgba(255,255,255,0.1)",
              borderless: false,
              radius: CORNER,
            }}
          >
            {showImage ? (
              <Image
                source={thumbSource!}
                style={styles.img}
                resizeMode="cover"
                onError={() => setThumbFailed(true)}
              />
            ) : null}
            {showFallback ? (
              <View style={[styles.img, styles.fallback]}>
                <Text style={styles.fallbackText}>{fallbackLabel.slice(0, 1) || "·"}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: HOME_SCENE_THUMB_SLOT_WIDTH,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  animWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  shadowWrap: {
    borderRadius: CORNER,
    backgroundColor: "transparent",
  },
  shadowWrapSelected: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 7,
    },
    android: { elevation: 2 },
    default: {},
  }),
  core: {
    width: HOME_SCENE_THUMB_SIZE,
    height: HOME_SCENE_THUMB_SIZE,
    borderRadius: CORNER,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  corePressed: {
    opacity: 0.88,
  },
  img: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28,24,20,0.75)",
  },
  fallbackText: {
    fontSize: 18,
    ...parchmentSans(500),
    color: "rgba(255,255,255,0.35)",
  },
});
