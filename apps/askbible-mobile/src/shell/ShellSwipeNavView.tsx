import { usePathname } from "expo-router";
import { useRef, type ReactNode } from "react";
import { View, type GestureResponderEvent } from "react-native";
import { ShellSwipeNavProvider, useShellSwipeNav } from "./ShellSwipeNavContext";
import { resolveShellSwipeSurface, shellSwipeDirection } from "./shellSwipeNav";

function ShellSwipeNavBody({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const swipe = useShellSwipeNav();
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: GestureResponderEvent) => {
    if (swipe?.isSwipeSuspended()) return;
    if (!resolveShellSwipeSurface(pathname)) return;
    if (e.nativeEvent.touches.length !== 1) return;
    const t = e.nativeEvent.touches[0]!;
    startRef.current = { x: t.pageX, y: t.pageY };
  };

  const onTouchEnd = (e: GestureResponderEvent) => {
    const s = startRef.current;
    startRef.current = null;
    if (swipe?.isSwipeSuspended()) {
      swipe?.clearExclude();
      return;
    }
    const wasExcluded = swipe?.isExcluded() ?? false;
    swipe?.clearExclude();
    if (!s || wasExcluded) return;
    if (e.nativeEvent.changedTouches.length !== 1) return;
    if (!resolveShellSwipeSurface(pathname)) return;

    const t = e.nativeEvent.changedTouches[0]!;
    const dx = t.pageX - s.x;
    const dy = t.pageY - s.y;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

    const direction = shellSwipeDirection(dx);
    if (!direction) return;

    swipe?.getSwipeAction()?.(direction);
  };

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </View>
  );
}

export function ShellSwipeNavView({ children }: { children: ReactNode }) {
  return (
    <ShellSwipeNavProvider>
      <ShellSwipeNavBody>{children}</ShellSwipeNavBody>
    </ShellSwipeNavProvider>
  );
}
