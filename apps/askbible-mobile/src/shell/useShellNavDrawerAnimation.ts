import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { DRAWER_ANIM_MS, DRAWER_EASING } from "./shellNavDrawerConstants";

export function useShellNavDrawerAnimation(open: boolean, panelW: number) {
  const slideX = useRef(new Animated.Value(-panelW)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      slideX.setValue(-panelW);
      setVisible(true);
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: 0,
          duration: DRAWER_ANIM_MS,
          easing: DRAWER_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: DRAWER_ANIM_MS,
          easing: DRAWER_EASING,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (!visible) return;
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: -panelW,
        duration: DRAWER_ANIM_MS,
        easing: DRAWER_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: DRAWER_ANIM_MS,
        easing: DRAWER_EASING,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [open, panelW, slideX, backdropOpacity, visible]);

  return { slideX, backdropOpacity, visible };
}
