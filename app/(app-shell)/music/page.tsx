import { MusicHomeClient } from "@/components/music/MusicHomeClient";
import { readMusicCompanionStore } from "@/lib/music-companion/store-file";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "音乐 · Selah.my",
  description: "安静回到经文的入口 — 正在成型。",
};

export default async function MusicPage() {
  const store = await readMusicCompanionStore(process.cwd());
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full flex-1 flex-col overflow-hidden bg-ink lg:h-full lg:max-h-none lg:bg-[radial-gradient(125%_90%_at_50%_-5%,#3d3228_0%,#1c1610_42%,#0c0a08_100%)]">
      <MusicHomeClient initialStore={store} />
    </div>
  );
}
