import { useNavigation } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { useShellSwipeNav } from "./ShellSwipeNavContext";
import type { ShellSwipeDirection } from "./shellSwipeNav";

/** 前台页注册左右滑动作（离开页面自动注销） */
export function useShellSwipeAction(
  enabled: boolean,
  onSwipe: (direction: ShellSwipeDirection) => void,
) {
  const swipe = useShellSwipeNav();
  const navigation = useNavigation();
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const register = useCallback(() => {
    if (!swipe || !enabled) return;
    swipe.setSwipeAction((direction) => onSwipeRef.current(direction));
  }, [enabled, swipe]);

  const unregister = useCallback(() => {
    swipe?.setSwipeAction(null);
  }, [swipe]);

  useEffect(() => {
    if (!swipe || !enabled) {
      unregister();
      return;
    }

    if (navigation.isFocused()) register();

    const onFocus = navigation.addListener("focus", register);
    const onBlur = navigation.addListener("blur", unregister);

    return () => {
      onFocus();
      onBlur();
      unregister();
    };
  }, [enabled, navigation, register, unregister, swipe]);
}
