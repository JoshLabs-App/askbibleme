import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShellFullBleedFrame } from "../shell/shellLayout";
import { shellPlaybackDockBottomPad } from "../shell/shellPlaybackTransportLayout";

export function useMusicHomeLayout(layout: "tab" | "stack") {
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const fullBleedFrame = useShellFullBleedFrame();
  const inTab = layout === "tab";
  const isLandscape = windowW > windowH;
  const compactLandscape = inTab && isLandscape;
  /** 与读经计划播放坞同底距，Tab 切换时播放键垂直对齐 */
  const bottomPad = inTab ? shellPlaybackDockBottomPad(insets.bottom) : 16 + insets.bottom;
  const contentBottomPad = compactLandscape ? Math.max(insets.bottom, 12) : bottomPad;
  const viewportHeight = inTab ? fullBleedFrame.height : windowH;
  const viewportTop = compactLandscape ? 0 : insets.top + 8;

  const landscapeSafeHorizontal = useMemo(
    () => (compactLandscape ? { left: insets.left, right: insets.right } : null),
    [compactLandscape, insets.left, insets.right],
  );
  const landscapeCenterTapPosition = useMemo(
    () =>
      compactLandscape
        ? {
            left: insets.left + (windowW - insets.left - insets.right - 260) / 2,
            top: insets.top + (windowH - insets.top - insets.bottom - 260) / 2,
          }
        : null,
    [compactLandscape, insets.bottom, insets.left, insets.right, insets.top, windowH, windowW],
  );

  return {
    insets,
    windowW,
    windowH,
    fullBleedFrame,
    inTab,
    compactLandscape,
    contentBottomPad,
    viewportHeight,
    viewportTop,
    landscapeSafeHorizontal,
    landscapeCenterTapPosition,
  };
}
