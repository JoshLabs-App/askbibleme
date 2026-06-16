import { redirect } from "next/navigation";

/** 年日与永恒已并入数算年日；保留路由以兼容旧链接。 */
export default function ExploreYearsDaysEternityPage() {
  redirect("/explore/year-day-count");
}
