import type { Metadata } from "next";
import { MusicVisualConsoleClient } from "@/components/music-visual-console/MusicVisualConsoleClient";

export const metadata: Metadata = {
  title: "播放视觉",
  description: "首页氛围与播放视觉调参、实时 drive、导入导出（统一后台内）",
};

export default function AdminVisualPage() {
  return <MusicVisualConsoleClient embeddedInAdmin />;
}
