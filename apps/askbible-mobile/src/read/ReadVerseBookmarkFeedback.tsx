import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { useSafeAreaInsets } from "react-native-safe-area-context";
type Props = {
  message: string | null;
  onClear: () => void;
};

/** 收藏/取消收藏后的轻提示（不挡阅读） */
export function ReadVerseBookmarkFeedback({ message, onClear }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClear();
    });
  }, [message, onClear, opacity]);

  if (!visible || !message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          bottom: 108 + insets.bottom,
          opacity,
        },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    left: 24,
    right: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(28, 20, 16, 0.82)",
    alignItems: "center",
  },
  text: {
    fontSize: 14,
    ...parchmentSans(500),
    color: "#f7f4ef",
    textAlign: "center",
  },
});
