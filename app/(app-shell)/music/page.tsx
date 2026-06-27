import { MusicHomeClient } from "@/components/music/MusicHomeClient";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { filterPublicMusicCompanionStore } from "@/lib/music-companion/public-store";
import { readMusicCompanionStore } from "@/lib/music-companion/store-file";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "./music-home.css";

/** 曲库 JSON 变更不必秒级反映：略长缓存减轻每次打开音乐页的 RSC 读盘 */
export const revalidate = 45;

export const metadata = {
  title: sitePageTitle("音乐"),
  description: "安静回到经文的入口 — 正在成型。",
};

export default async function MusicPage() {
  const cwd = process.cwd();
  const store = filterPublicMusicCompanionStore(await readMusicCompanionStore(cwd));
  return (
    <ShellTemplateChromeLayout
      contentClassName="gap-0"
      immersive
      topBarTone="onDark"
      appShellBackground="#0a0908"
    >
      <MusicHomeClient initialStore={store} layout="templateChrome" />
    </ShellTemplateChromeLayout>
  );
}
