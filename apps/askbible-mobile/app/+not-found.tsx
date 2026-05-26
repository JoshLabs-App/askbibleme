import { Redirect } from "expo-router";

/** 无效深链或旧版持久化路由：立即回首页（勿用 `/(tabs)`，会落到无叶子屏） */
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
