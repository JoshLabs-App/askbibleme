import { MusicHomeClient } from "@/components/music/MusicHomeClient";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { filterPublicMusicCompanionStore } from "@/lib/music-companion/public-store";
import { readMusicCompanionStore } from "@/lib/music-companion/store-file";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "./music-home.css";


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
