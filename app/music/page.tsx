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
    <div className="flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden bg-canvas lg:h-full lg:max-h-none">
      <MusicHomeClient initialStore={store} />
    </div>
  );
}
