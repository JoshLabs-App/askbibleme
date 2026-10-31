import type { Metadata } from "next";
import { TvScreen } from "@/components/tvscreen/TvScreen";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";

export const metadata: Metadata = {
  title: { absolute: "AskBible 电视" },
  description: "电视专用：全屏自然影像、金句与音乐，遥控器数字键操作。",
};

export const dynamic = "force-dynamic";

export default async function TvPage() {
  const settings = await readNatureSettings(process.cwd());
  const videos = settings.videos.map((v) => ({ id: v.id, src: v.src, title: v.title ?? "", poster: v.previewFrameSrc ?? v.thumbSrc ?? "" }));
  return <TvScreen videos={videos} />;
}
