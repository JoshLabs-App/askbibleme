import { HomePrayerVerseFeedProvider } from "@/components/home/HomePrayerVerseFeedContext";
import { buildHomeVerseRotationFromShellCookies } from "@/lib/bible/home-verse-rotation-rsc";

/** 电视专用页：不套手机壳层（底栏 / 安全区 / 顶栏），只带金句轮播的数据。 */
export default async function TvLayout({ children }: { children: React.ReactNode }) {
  const verseFallbackByLocale = await buildHomeVerseRotationFromShellCookies(process.cwd());
  return <HomePrayerVerseFeedProvider fallbackByLocale={verseFallbackByLocale}>{children}</HomePrayerVerseFeedProvider>;
}
