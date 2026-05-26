import { useWindowDimensions } from "react-native";

/**
 * 与网站 `useLandscapeNarrow` 一致：手机式横屏（窄且矮），用于首页沉浸全屏视频。
 */
export function useLandscapeNarrow(): boolean {
  const { width, height } = useWindowDimensions();
  return width > height && width <= 956 && height <= 500;
}
