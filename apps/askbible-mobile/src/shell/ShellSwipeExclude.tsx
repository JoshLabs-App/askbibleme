import { useCallback, useMemo, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { useShellSwipeNav } from "./ShellSwipeNavContext";

/** 横向场景条等：触控区内不触发壳层左右滑（由 `ShellSwipeNavView` 在 gesture 结束时统一 clear） */
export function ShellSwipeExclude({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  const swipe = useShellSwipeNav();
  const markExclude = useCallback(() => swipe?.markExclude(), [swipe]);

  return (
    <View {...rest} style={style} onTouchStart={markExclude}>
      {children}
    </View>
  );
}

/** 传给横向 `ScrollView`：`ScrollView` 抢 responder 时外层 `onTouchStart` 可能收不到 */
export function useShellSwipeExcludeHandlers() {
  const swipe = useShellSwipeNav();
  return useMemo(
    () => ({
      onTouchStart: () => swipe?.markExclude(),
      onScrollBeginDrag: () => swipe?.markExclude(),
    }),
    [swipe],
  );
}
