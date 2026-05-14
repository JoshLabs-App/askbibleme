import { redirect } from "next/navigation";

/** 播放视觉功能已移除；旧链接重定向到后台首页 */
export default function AdminVisualPage() {
  redirect("/admin");
}
