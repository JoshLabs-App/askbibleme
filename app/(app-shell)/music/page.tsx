import { MusicHomeClient } from "@/components/music/MusicHomeClient";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { buildHomeVerseRotationByLocale } from "@/lib/bible/home-verse-ref-rotation";
import { readMusicCompanionStore } from "@/lib/music-companion/store-file";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "音乐 · Selah.my",
  description: "安静回到经文的入口 — 正在成型。",
};

export default async function MusicPage() {
  const cwd = process.cwd();
  const store = await readMusicCompanionStore(cwd);
  const homeVerseRotation = buildHomeVerseRotationByLocale(cwd);
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <MusicHomeClient initialStore={store} layout="templateChrome" homeVerseRotation={homeVerseRotation} />
    </ShellTemplateChromeLayout>
  );
}
