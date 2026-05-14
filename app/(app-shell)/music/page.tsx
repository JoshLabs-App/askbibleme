import { MusicHomeClient } from "@/components/music/MusicHomeClient";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readMusicCompanionStore } from "@/lib/music-companion/store-file";

/** 曲库 JSON 变更不必秒级反映：略长缓存减轻每次打开音乐页的 RSC 读盘 */
export const revalidate = 45;

export const metadata = {
  title: "音乐 · Selah.my",
  description: "安静回到经文的入口 — 正在成型。",
};

export default async function MusicPage() {
  const cwd = process.cwd();
  const store = await readMusicCompanionStore(cwd);
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <MusicHomeClient initialStore={store} layout="templateChrome" />
    </ShellTemplateChromeLayout>
  );
}
