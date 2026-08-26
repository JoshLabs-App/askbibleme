import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
/** 缩略图下方场景名行高（首页已不再展示） */
export const HOME_SCENE_THUMB_LABEL_H = 0;
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
/** 未选中略缩小、60% 不透明；选中满尺寸、不描边 */
const SCALE_REST = 0.9;
const SCALE_SELECTED = 1;
const OPACITY_REST = 0.6;
const OPACITY_SELECTED = 1;

function thumbSlotHeight(slotPad: number): number {
  return HOME_SCENE_THUMB_SIZE + slotPad * 2 + HOME_SCENE_THUMB_LABEL_H;
}

type Props = {
  selected: boolean;
  thumbModule: number | null;
  thumbUri?: string;
  fallbackLabel: string;
  /** 无缩略图时用图标代替首字；场景条功能钮（模糊等） */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** 图下文字；默认用 fallbackLabel */
  caption?: string;
  onPress: () => void;
  /** 横屏沉浸：缩小槽位上下留白，场景条更贴底 */
  slotPad?: number;
};

/** 首页底部场景缩略图：选中满不透明，未选中 60% */
export function HomeSceneThumb({
  selected,
  thumbModule,
  thumbUri,
  fallbackLabel,
  icon,
  caption,
  onPress,
  slotPad = HOME_SCENE_THUMB_SLOT_PAD,
}: Props) {
  const focus = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const [thumbFailed, setThumbFailed] = useState(false);
  const underLabel = (caption ?? fallbackLabel).trim();

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
    <Pressable
      onPress={handlePress}
      style={[styles.slot, { height: thumbSlotHeight(slotPad) }]}
      accessibilityRole="button"
      accessibilityLabel={underLabel || fallbackLabel}
      accessibilityState={{ selected }}
    >
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
          {/*
            Android：Pressable 上 overflow+borderRadius 首帧常不裁切，会闪方角/多边形底。
            裁切放在 View（collapsable=false），图片与底自身也带圆角。
          */}
          <View style={styles.core} collapsable={false}>
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
                {icon ? (
                  <MaterialCommunityIcons
                    name={icon}
                    size={28}
                    color="rgba(255,255,255,0.88)"
                  />
                ) : (
                  <Text style={styles.fallbackText}>{fallbackLabel.slice(0, 1) || "·"}</Text>
                )}
              </View>
            ) : null}
            <View
              style={styles.hit}
              pointerEvents="none"
              // Android ripple 仍由外层 Pressable；圆角裁切在 core。
            />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: HOME_SCENE_THUMB_SLOT_WIDTH,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  animWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  shadowWrap: {
    borderRadius: CORNER,
    // iOS 阴影只吃本层不透明像素；透明底会导致系统 shadow 完全消失
    backgroundColor: "rgba(28,24,20,0.9)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  shadowWrapSelected: Platform.select({
    ios: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.34,
      shadowRadius: 7,
    },
    android: {
      elevation: 5,
    },
    default: {},
  }),
  core: {
    width: HOME_SCENE_THUMB_SIZE,
    height: HOME_SCENE_THUMB_SIZE,
    borderRadius: CORNER,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  hit: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CORNER,
  },
  img: {
    width: "100%",
    height: "100%",
    borderRadius: CORNER,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CORNER,
    backgroundColor: "rgba(28,24,20,0.75)",
  },
    fallbackText: {
      fontSize: 18,
      ...parchmentSans(500),
      color: "rgba(255,255,255,0.35)",
    },
});
