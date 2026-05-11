import type { Metadata } from "next";
import { NatureAdminClient } from "@/components/admin/NatureAdminClient";

export const metadata: Metadata = {
  title: "自然",
  description: "自然全屏背景影片、专辑式预览与前台对照。",
};

export default function AdminMusicNaturePage() {
  return <NatureAdminClient />;
}
