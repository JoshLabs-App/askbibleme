import { Redirect } from "expo-router";

/** 年日与永恒已并入数算年日；保留路由以兼容旧链接。 */
export function ExploreYearsDaysEternityScreen() {
  return <Redirect href="/explore/year-day-count" />;
}
