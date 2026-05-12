import type { Metadata } from "next";
import { RelaxCalmExperience } from "@/components/relax/RelaxCalmExperience";
import { readRelaxSettings } from "@/lib/relax/read-relax-settings";

export const metadata: Metadata = {
  title: "放松",
  description: "静音画面与独立音乐层，慢下来的一小段时间。",
};

/** 独立于 `(app-shell)`：无主导航底栏；与主站共享根级 `MusicShellPlaybackProvider`。 */
export default async function RelaxPage() {
  const settings = await readRelaxSettings(process.cwd());
  return <RelaxCalmExperience initial={settings} />;
}
