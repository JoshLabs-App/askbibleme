import { Redirect } from "expo-router";

/** 旧版「旅程」Tab 已移除；恢复持久化路由时重定向到首页 */
export default function JourneyTabRedirect() {
  return <Redirect href="/" />;
}
